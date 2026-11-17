import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { applyBeatmapMods, computeManiaHitWindows, parseBeatmap } from '../src'
import { readBeatmapFile, readReplayFile, serializeBeatmap } from '../src/node'
import type { Replay } from '../src'

const fixtureDirectory = join(import.meta.dirname, 'fixtures')
const pupaDirectory = join(fixtureDirectory, 'pupa')
const pupaBeatmapPath = join(pupaDirectory, 'another.osu')
const pupaBeatmap = readBeatmapFile(pupaBeatmapPath)
const pupaBeatmapHash = createHash('md5').update(readFileSync(pupaBeatmapPath)).digest('hex')

/**
 * Hit object lines reduced to everything a mania replay/analysis tool cares
 * about. The `type` field only keeps its mania bit, so the new-combo flag is
 * intentionally excluded.
 */
function objectSignatures(text: string): string[] {
	return (text.split('[HitObjects]')[1] ?? '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const parts = line.split(',')

			return [parts[0], parts[2], parts[4], ...parts.slice(5)].join('|')
		})
}

interface PlayedPress {
	time: number
	column: number
}

interface PlayedHold {
	column: number
	startTime: number
	endTime: number
}

function readPlayedInput(replay: Replay): { presses: PlayedPress[]; holds: PlayedHold[] } {
	const keyCount = replay.frames[0]?.columns.length ?? 0
	const pressStarts = Array<number | undefined>(keyCount).fill(undefined)
	const previous = Array<boolean>(keyCount).fill(false)
	const presses: PlayedPress[] = []
	const holds: PlayedHold[] = []

	for (const frame of replay.frames) {
		for (let column = 0; column < keyCount; column += 1) {
			const pressed = frame.columns[column] ?? false

			if (pressed && !previous[column]) {
				pressStarts[column] = frame.time
				presses.push({ time: frame.time, column })
			}

			if (!pressed && previous[column]) {
				const startTime = pressStarts[column]

				if (startTime !== undefined) {
					holds.push({ column, startTime, endTime: frame.time })
				}

				pressStarts[column] = undefined
			}

			previous[column] = pressed
		}
	}

	return { presses, holds }
}

interface ModRunFixture {
	replay: Replay
	fileName: string
}

/**
 * Finds the first replay under tests/fixtures/pupa that was played with `acronym`.
 *
 * osu!lazer stores the mods a score was played with, so fixtures are claimed by
 * their mod rather than by a naming convention.
 */
function findModRun(acronym: string): ModRunFixture | undefined {
	const replayFiles = readdirSync(pupaDirectory, { recursive: true })
		.map((entry) => String(entry))
		.filter((entry) => entry.toLowerCase().endsWith('.osr'))
		.sort()
	const failures: string[] = []

	for (const fileName of replayFiles) {
		let replay: Replay

		try {
			replay = readReplayFile(join(pupaDirectory, fileName), pupaBeatmap)
		} catch (error) {
			failures.push(`${fileName}: ${(error as Error).message}`)
			continue
		}

		if (!replay.lazer?.mods.some((mod) => mod.acronym === acronym)) {
			continue
		}

		if (replay.beatmapHash !== pupaBeatmapHash) {
			throw new Error(
				`${fileName} was played on a different beatmap (hash ${replay.beatmapHash}, expected ${pupaBeatmapHash}).`,
			)
		}

		return { replay, fileName }
	}

	if (failures.length > 0) {
		throw new Error(`Replay fixtures exist but could not be read:\n${failures.join('\n')}`)
	}

	return undefined
}

describe('real keysound beatmap (AAAA + Umeboshi Chazuke - Cait Sith [4K])', () => {
	const beatmapPath = join(fixtureDirectory, 'keysound', 'keysound-4k.osu')
	const beatmap = readBeatmapFile(beatmapPath)

	it('parses custom hit sample filenames on notes and holds', () => {
		expect(beatmap.difficulty.keyCount).toBe(4)
		expect(beatmap.hitObjects).toHaveLength(2553)

		const holds = beatmap.hitObjects.filter((hitObject) => hitObject.endTime !== undefined)
		const withFilename = beatmap.hitObjects.filter((hitObject) => hitObject.sample?.filename !== undefined)

		expect(holds).toHaveLength(758)
		expect(withFilename).toHaveLength(419)

		// Regression: hold samples used to be shifted by one field, so the end time
		// leaked into the sample bank and the last field became a numeric filename.
		for (const hitObject of withFilename) {
			expect(hitObject.sample?.filename).toMatch(/\.wav$/)
		}

		expect(holds.some((hitObject) => hitObject.sample?.filename === 'tom03_loud.wav')).toBe(true)
		expect(beatmap.hitObjects.some((hitObject) => hitObject.sample?.volume === 30)).toBe(true)
		expect(new Set(beatmap.hitObjects.map((hitObject) => hitObject.hitSoundFlags))).toContain(2)
		expect(new Set(beatmap.hitObjects.map((hitObject) => hitObject.hitSoundFlags))).toContain(8)
	})

	it('round-trips lane positions, times, hit sounds and samples exactly', () => {
		const serialized = serializeBeatmap(beatmap)

		expect(objectSignatures(serialized)).toEqual(objectSignatures(readFileSync(beatmapPath, 'utf8')))
	})

	it('preserves storyboard sound samples and the background event', () => {
		expect(beatmap.events?.background?.filename).toBe('70943022_p0.jpg')
		expect(beatmap.events?.storyboardLines).toHaveLength(54)

		const serialized = serializeBeatmap(beatmap)

		for (const line of beatmap.events?.storyboardLines ?? []) {
			expect(serialized).toContain(line)
		}
	})
})

describe('real 10K beatmap (Colorful Sounds Port - CHERRY DOLL [Beginner])', () => {
	const beatmapPath = join(fixtureDirectory, 'keycount', 'keycount-10k.osu')
	const beatmap = readBeatmapFile(beatmapPath)

	it('maps every lane of a 10 key chart', () => {
		expect(beatmap.difficulty.keyCount).toBe(10)
		expect(beatmap.hitObjects).toHaveLength(162)
		expect(new Set(beatmap.hitObjects.map((hitObject) => hitObject.column))).toEqual(
			new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
		)
		expect(serializeBeatmap(beatmap)).toContain('CircleSize: 10')
	})

	it('round-trips lane positions and times exactly', () => {
		const serialized = serializeBeatmap(beatmap)

		expect(objectSignatures(serialized)).toEqual(objectSignatures(readFileSync(beatmapPath, 'utf8')))
	})
})

function median(values: readonly number[]): number {
	if (values.length === 0) {
		return 0
	}

	const sorted = [...values].sort((left, right) => left - right)

	return sorted[Math.floor(sorted.length / 2)] ?? 0
}

/**
 * Number of objects whose head lines up with a real key press.
 *
 * Used as the denominator control: comparing against the source beatmap keeps
 * the assertion independent of how many notes the player actually missed.
 */
function countHitHeads(
	hitObjects: readonly { column: number; startTime: number }[],
	presses: readonly PlayedPress[],
	tolerance = 60,
): number {
	return hitObjects.filter((hitObject) => presses.some((press) => (
		press.column === hitObject.column
		&& Math.abs(press.time - hitObject.startTime) <= tolerance
	))).length
}

describe('real v128 beatmap with a video (25-ji, Nightcord de. x Hatsune Miku - Keitai Renwa [Easy])', () => {
	const beatmapPath = join(fixtureDirectory, 'video', 'keitai-renwa-7k.osu')
	const beatmap = readBeatmapFile(beatmapPath)

	it('reads a lazer export that starts with a byte order mark', () => {
		expect(beatmap.fileFormat).toBe(128)
		expect(beatmap.general.mode).toBe(3)
		expect(beatmap.difficulty.keyCount).toBe(7)
		expect(beatmap.hitObjects).toHaveLength(338)
		expect(beatmap.colours?.combo).toHaveLength(4)
	})

	it('parses the named video event together with its start time', () => {
		expect(beatmap.events?.video).toEqual({
			startTime: 1000,
			filename: 'keitaimv.mp4',
			xOffset: 0,
			yOffset: 0,
		})
		expect(beatmap.events?.background?.filename).toBe('BG.jpg')
	})

	it('round-trips the video, the format version and the lazer editor presets', () => {
		const serialized = serializeBeatmap(beatmap)

		expect(serialized.startsWith('osu file format v128')).toBe(true)
		expect(serialized).toContain('1,1000,"keitaimv.mp4",0,0')
		expect(serialized).toContain('VelocityPresets: 0.75,1,1.5')
		expect(parseBeatmap(serialized).events).toEqual(beatmap.events)
	})
})

// Replays are claimed by the mods osu!lazer recorded inside them, so dropping an
// IN or HO play anywhere under tests/fixtures/pupa is enough to enable these.
const invertRun = findModRun('IN')

describe.skipIf(invertRun === undefined)(
	'invert mod against a real play (tests/fixtures/pupa)',
	() => {
		it('creates one hold per note except each column tail', () => {
			if (!invertRun) {
				throw new Error('The invert run fixture is missing.')
			}

			const modded = applyBeatmapMods(pupaBeatmap, [{ acronym: 'IN' }])
			const usedColumns = new Set(pupaBeatmap.hitObjects.map((hitObject) => hitObject.column))

			expect(modded.hitObjects.every((hitObject) => hitObject.endTime !== undefined)).toBe(true)
			expect(modded.hitObjects).toHaveLength(pupaBeatmap.hitObjects.length - usedColumns.size)
			expect(invertRun.replay.lazer?.mods.map((mod) => mod.acronym)).toEqual(['IN'])
		})

		it('keeps every note head that the player hit', () => {
			if (!invertRun) {
				throw new Error('The invert run fixture is missing.')
			}

			const modded = applyBeatmapMods(pupaBeatmap, [{ acronym: 'IN' }])
			const { presses } = readPlayedInput(invertRun.replay)
			const lastObjectByColumn = new Map<number, number>()

			for (const hitObject of pupaBeatmap.hitObjects) {
				const current = lastObjectByColumn.get(hitObject.column)

				if (current === undefined || hitObject.startTime > current) {
					lastObjectByColumn.set(hitObject.column, hitObject.startTime)
				}
			}

			// The inverted chart drops each column's final object, so the same notes
			// are removed from the control before comparing hit coverage.
			const control = pupaBeatmap.hitObjects.filter((hitObject) => (
				lastObjectByColumn.get(hitObject.column) !== hitObject.startTime
			))

			expect(countHitHeads(modded.hitObjects, presses)).toBe(countHitHeads(control, presses))
		})

		it('matches the lengths the player actually held', () => {
			if (!invertRun) {
				throw new Error('The invert run fixture is missing.')
			}

			const modded = applyBeatmapMods(pupaBeatmap, [{ acronym: 'IN' }])
			const { holds } = readPlayedInput(invertRun.replay)

			const deltas: number[] = []

			for (const hitObject of modded.hitObjects) {
				const played = holds.find((hold) => (
					hold.column === hitObject.column
					&& Math.abs(hold.startTime - hitObject.startTime) <= 60
				))

				if (played) {
					deltas.push(played.endTime - (hitObject.endTime ?? hitObject.startTime))
				}
			}

			expect(deltas.length).toBeGreaterThan(300)
			// A systematic error in the hold length would shift the median; human
			// release jitter is far below this bound.
			expect(Math.abs(median(deltas))).toBeLessThan(80)
			// Players commonly hold a little longer than required, so only the lower
			// bound of the release time is checked.
			expect(deltas.filter((delta) => delta >= -120).length / deltas.length).toBeGreaterThan(0.95)
		})
	},
)

const holdOffRun = findModRun('HO')

describe.skipIf(holdOffRun === undefined)(
	'hold off mod against a real play (tests/fixtures/pupa)',
	() => {
		it('strips holds without changing the object count', () => {
			if (!holdOffRun) {
				throw new Error('The hold off run fixture is missing.')
			}

			const modded = applyBeatmapMods(pupaBeatmap, [{ acronym: 'HO' }])

			expect(modded.hitObjects.some((hitObject) => hitObject.endTime !== undefined)).toBe(false)
			expect(modded.hitObjects).toHaveLength(pupaBeatmap.hitObjects.length)
			expect(holdOffRun.replay.lazer?.mods.map((mod) => mod.acronym)).toEqual(['HO'])
		})

		it('keeps every note head that the player hit', () => {
			if (!holdOffRun) {
				throw new Error('The hold off run fixture is missing.')
			}

			const modded = applyBeatmapMods(pupaBeatmap, [{ acronym: 'HO' }])
			const { presses } = readPlayedInput(holdOffRun.replay)

			expect(countHitHeads(modded.hitObjects, presses)).toBe(countHitHeads(pupaBeatmap.hitObjects, presses))
		})

		it('was tapped instead of held at the positions that are holds in the source', () => {
			if (!holdOffRun) {
				throw new Error('The hold off run fixture is missing.')
			}

			const { holds } = readPlayedInput(holdOffRun.replay)
			const sourceHolds = pupaBeatmap.hitObjects.filter((hitObject) => hitObject.endTime !== undefined)
			const playedDurations = sourceHolds
				.map((hitObject) => holds.find((hold) => (
					hold.column === hitObject.column
					&& Math.abs(hold.startTime - hitObject.startTime) <= 60
				)))
				.filter((hold) => hold !== undefined)
				.map((hold) => hold.endTime - hold.startTime)
			const sourceDurations = sourceHolds.map((hitObject) => (
				(hitObject.endTime ?? hitObject.startTime) - hitObject.startTime
			))

			expect(playedDurations.length).toBeGreaterThan(250)
			expect(median(playedDurations)).toBeLessThan(median(sourceDurations))
		})
	},
)

const halfTimeRun = findModRun('HT')

describe.skipIf(halfTimeRun === undefined)(
	'half time mod against a real play (tests/fixtures/pupa)',
	() => {
		it('applies the 0.75 clock rate lazer omits from the mod settings', () => {
			if (!halfTimeRun) {
				throw new Error('The half time run fixture is missing.')
			}

			const mods = halfTimeRun.replay.lazer?.mods ?? []
			const modded = applyBeatmapMods(pupaBeatmap, mods)

			expect(mods.map((mod) => mod.acronym)).toContain('HT')
			expect(modded.appliedMods).toContain('HT')
			expect(modded.ignoredMods).not.toContain('HT')
			// osu!lazer omits `speed_change` when it matches the 0.75 default.
			expect(modded.speedMultiplier).toBe(0.75)
			expect(modded.hitObjects).toHaveLength(pupaBeatmap.hitObjects.length)
		})

		it('shrinks the gameplay-time windows so the window stays constant in real time', () => {
			const overallDifficulty = pupaBeatmap.difficulty.overallDifficulty
			const halfTime = computeManiaHitWindows({ overallDifficulty, speedMultiplier: 0.75 })
			const normal = computeManiaHitWindows({ overallDifficulty })

			expect(halfTime.great).toBeLessThan(normal.great)
			expect(halfTime.perfect).toBeLessThan(normal.perfect)
			// Dividing by the clock rate recovers the unscaled window, up to the
			// half millisecond osu! adds.
			expect(halfTime.great / 0.75).toBeCloseTo(normal.great, 0)
		})
	},
)

const difficultyAdjustRun = findModRun('DA')

describe.skipIf(difficultyAdjustRun === undefined)(
	'difficulty adjust mod against a real play (tests/fixtures/pupa)',
	() => {
		it('reads the snake_case settings lazer stores for DA', () => {
			if (!difficultyAdjustRun) {
				throw new Error('The difficulty adjust run fixture is missing.')
			}

			const settings = difficultyAdjustRun.replay.lazer?.mods
				.find((mod) => mod.acronym === 'DA')?.settings

			expect(settings).toEqual({ drainRate: 8, overallDifficulty: 9 })
		})

		it('applies the modded difficulty without touching the key count', () => {
			if (!difficultyAdjustRun) {
				throw new Error('The difficulty adjust run fixture is missing.')
			}

			const modded = applyBeatmapMods(pupaBeatmap, difficultyAdjustRun.replay.lazer?.mods ?? [])

			expect(modded.appliedMods).toContain('DA')
			expect(modded.difficulty.overallDifficulty).toBe(9)
			expect(modded.difficulty.hpDrainRate).toBe(8)
			expect(modded.difficulty.keyCount).toBe(pupaBeatmap.difficulty.keyCount)
		})
	},
)
