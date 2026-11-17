import { describe, expect, it } from 'vitest'

import {
	applyBeatmapMods,
	applyLegacyBeatmapMods,
	computeManiaHitWindows,
	createTimingResolver,
	LegacyModBit,
	parseBeatmap,
	parseReplay,
	serializeBeatmap,
	serializeReplay,
} from '../src'
import type { Replay } from '../src'

const BEATMAP_LINES = [
	'osu file format v14',
	'',
	'[General]',
	'AudioFilename: audio.mp3',
	'AudioLeadIn: 0',
	'PreviewTime: 1000',
	'Countdown: 0',
	'SampleSet: Soft',
	'StackLeniency: 0.7',
	'Mode: 3',
	'LetterboxInBreaks: 0',
	'SpecialStyle: 0',
	'WidescreenStoryboard: 1',
	'',
	'[Metadata]',
	'Title:Test',
	'Artist:Test',
	'Creator:Test',
	'Version:Test',
	'',
	'[Difficulty]',
	'HPDrainRate:7',
	'CircleSize:4',
	'OverallDifficulty:7',
	'ApproachRate:9',
	'SliderMultiplier:1.4',
	'SliderTickRate:1',
	'',
	'[Events]',
	'0,0,"bg.jpg",12,-8',
	'1,1000,"video.avi",0,0',
	'2,2000,3000',
	'Sprite,Foreground,Centre,"bg.jpg",320,240',
	'',
	'[TimingPoints]',
	'0,500,4,2,1,60,1,0',
	'1000,-50,4,2,1,60,0,0',
	'',
	'[Colours]',
	'Combo1 : 255,0,0',
	'Combo2 : 0,255,0',
	'',
	'[HitObjects]',
	'64,192,1000,1,0,0:0:0:0:',
	'192,192,1500,128,0,2500:0:0:0:0:',
]

function beatmapText(overrides: readonly (readonly [string, string])[] = []): string {
	let text = BEATMAP_LINES.join('\n')

	for (const [from, to] of overrides) {
		text = text.replace(from, to)
	}

	return text
}

describe('beatmap serialization fidelity', () => {
	it('writes the mania mode and the general/difficulty keys it used to drop', () => {
		const serialized = serializeBeatmap(parseBeatmap(beatmapText()))

		expect(serialized).toContain('Mode: 3')
		expect(serialized).toContain('StackLeniency: 0.7')
		expect(serialized).toContain('WidescreenStoryboard: 1')
		expect(serialized).toContain('SampleSet: Soft')
		expect(serialized).toContain('ApproachRate: 9')
	})

	it('round-trips events, colours and the [Colours] section', () => {
		const original = parseBeatmap(beatmapText())
		const reparsed = parseBeatmap(serializeBeatmap(original))

		expect(reparsed.events).toEqual(original.events)
		expect(reparsed.events?.background).toEqual({ filename: 'bg.jpg', xOffset: 12, yOffset: -8 })
		expect(reparsed.events?.video).toEqual({ startTime: 1000, filename: 'video.avi', xOffset: 0, yOffset: 0 })
		expect(reparsed.events?.storyboardLines).toEqual(['Sprite,Foreground,Centre,"bg.jpg",320,240'])
		expect(reparsed.colours).toEqual(original.colours)
		expect(reparsed.colours?.combo).toEqual([[255, 0, 0], [0, 255, 0]])
	})

	it('keeps hold hit samples intact instead of shifting them by one field', () => {
		const beatmap = parseBeatmap(beatmapText())
		const hold = beatmap.hitObjects[1]!

		expect(hold.endTime).toBe(2500)
		expect(hold.sample).toEqual({
			bank: 'default',
			additionBank: 'default',
			customIndex: 0,
			volume: 0,
			filename: undefined,
		})

		const serialized = serializeBeatmap(beatmap)

		expect(serialized).toContain('192,192,1500,128,0,2500:0:0:0:')
		expect(serialized).not.toContain('2500:0:0:0:0:0')
	})

	it('preserves unknown sections and the source file format version', () => {
		const text = beatmapText().replace('[HitObjects]', '[Variables]\n0 file("bg.jpg")\n\n[HitObjects]')
		const beatmap = parseBeatmap(text)

		expect(beatmap.extraSections).toEqual([{ name: 'Variables', lines: ['0 file("bg.jpg")'] }])
		expect(serializeBeatmap(beatmap)).toContain('[Variables]')

		const lazerBeatmap = parseBeatmap(beatmapText().replace('osu file format v14', 'osu file format v128'))

		expect(lazerBeatmap.fileFormat).toBe(128)
		expect(serializeBeatmap(lazerBeatmap).startsWith('osu file format v128')).toBe(true)
	})

	it('writes hit objects at the centre of their lane', () => {
		const beatmap = parseBeatmap(beatmapText())

		expect(beatmap.hitObjects.map((hitObject) => hitObject.column)).toEqual([0, 1])
	})
})

describe('strict beatmap parsing', () => {
	it('rejects beatmaps that are not osu!mania', () => {
		expect(() => parseBeatmap(beatmapText([['Mode: 3', 'Mode: 0']]))).toThrow(/Mode: 3/)
	})

	it('accepts non-mania beatmaps when strict parsing is disabled', () => {
		expect(parseBeatmap(beatmapText([['Mode: 3', 'Mode: 0']]), { strict: false }).general.mode).toBe(0)
	})

	it('rejects malformed numeric values', () => {
		expect(() => parseBeatmap(beatmapText([['CircleSize:4', 'CircleSize:four']]))).toThrow(/CircleSize/)
	})
})

describe('timing lookups', () => {
	it('resolves BPM and scroll velocity over time', () => {
		const resolver = createTimingResolver(parseBeatmap(beatmapText()).controlPoints)

		expect(resolver.bpmAt(0)).toBe(120)
		expect(resolver.scrollVelocityAt(500)).toBe(1)
		expect(resolver.scrollVelocityAt(1000)).toBe(2)
		expect(resolver.scrollVelocityPointAt(0)).toBeUndefined()
	})
})

describe('mod application', () => {
	const beatmap = parseBeatmap(beatmapText())

	it('applies Difficulty Adjust and reports mods without a beatmap effect', () => {
		const modded = applyBeatmapMods(beatmap, [
			{ acronym: 'DA', settings: { overallDifficulty: 9.4 } },
			{ acronym: 'HR' },
			{ acronym: 'CL' },
		])

		expect(modded.difficulty.overallDifficulty).toBe(9.4)
		expect(modded.difficulty.hpDrainRate).toBeCloseTo(9.8)
		expect(modded.difficultyMultiplier).toBeCloseTo(1.4)
		expect(modded.appliedMods).toEqual(['DA', 'HR'])
		expect(modded.ignoredMods).toEqual(['CL'])
	})

	it('requires a seed for the random mod', () => {
		expect(() => applyBeatmapMods(beatmap, [{ acronym: 'RD' }])).toThrow(/seed/)
		expect(() => applyLegacyBeatmapMods(beatmap, LegacyModBit.Random)).toThrow(/seed/)
	})

	it('applies stable random mods with a seed', () => {
		const modded = applyLegacyBeatmapMods(beatmap, LegacyModBit.Random, { randomSeed: 1234 })

		expect(modded.appliedMods).toEqual(['RD'])
		expect(modded.hitObjects).toHaveLength(beatmap.hitObjects.length)
	})

	it('converts notes to holds for the invert mod and drops breaks', () => {
		const modded = applyBeatmapMods(beatmap, [{ acronym: 'IN' }])

		expect(modded.appliedMods).toEqual(['IN'])
		expect(modded.events?.breaks).toBeUndefined()
		// Each column only has a single object, so no inverted hold can exist.
		expect(modded.hitObjects).toEqual([])
	})

	it('strips hold tails for the hold off mod', () => {
		const modded = applyBeatmapMods(beatmap, [{ acronym: 'HO' }])

		expect(modded.hitObjects.every((hitObject) => hitObject.endTime === undefined)).toBe(true)
		expect(modded.hitObjects).toHaveLength(2)
	})
})

describe('mania hit windows', () => {
	it('matches osu!lazer windows for OD 7', () => {
		const windows = computeManiaHitWindows({ overallDifficulty: 7 })

		expect(windows.perfect).toBe(17.5)
		expect(windows.great).toBe(43.5)
		expect(windows.miss).toBe(167.5)
	})

	it('tightens windows for HR and widens them for DT', () => {
		expect(computeManiaHitWindows({ overallDifficulty: 7, difficultyMultiplier: 1.4 }).perfect).toBe(12.5)
		// 17.2 x 1.5 = 25.8, floored to 25 and landed on 25.5.
		expect(computeManiaHitWindows({ overallDifficulty: 7, speedMultiplier: 1.5 }).perfect).toBe(25.5)
	})
})

describe('replay container versions', () => {
	const replay: Replay = {
		gameVersion: 20140101,
		beatmapHash: 'beatmap-hash',
		username: 'player',
		replayHash: 'replay-hash',
		mods: 0,
		statistics: [1, 2, 3, 4, 5, 6],
		totalScore: 123456,
		maxCombo: 789,
		playedAt: new Date('2020-01-01T00:00:00Z'),
		frames: [
			{ time: 100, columns: [true, false, false, false] },
			{ time: 200, columns: [false, false, false, false] },
		],
	}

	it('omits the online score id for pre-20140721 clients', () => {
		const parsed = parseReplay(serializeReplay(replay), 4)

		expect(parsed.gameVersion).toBe(20140101)
		expect(parsed.onlineScoreId).toBeUndefined()
		expect(parsed.frames).toEqual(replay.frames)
		expect(parsed.statistics).toEqual(replay.statistics)
	})

	it('rejects lazer score data on a legacy version', () => {
		expect(() => serializeReplay({
			...replay,
			lazer: {
				onlineId: 1,
				mods: [],
				statistics: [0, 0, 0, 0, 0, 0],
				maximumStatistics: [0, 0, 0, 0, 0, 0],
				clientVersion: '2026.101.0',
				userId: 1,
				pauses: [],
			},
		})).toThrow(/gameVersion/)
	})
})
