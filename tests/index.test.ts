import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
	readBeatmapFile,
	readReplayFile,
	writeBeatmapFile,
	writeReplayFile,
} from '../src/node'

const fixtureDirectory = join(import.meta.dirname, 'fixtures', 'pupa')
const replayFixtureDirectory = join(fixtureDirectory, 'lazer')

function summarizeColumnActivity(frames: readonly { columns: readonly boolean[] }[], keyCount: number): {
	activeFrames: number[]
	transitions: number[]
} {
	const activeFrames = Array<number>(keyCount).fill(0)
	const transitions = Array<number>(keyCount).fill(0)
	const previous = Array<boolean>(keyCount).fill(false)

	for (const frame of frames) {
		for (let index = 0; index < keyCount; index += 1) {
			const pressed = frame.columns[index] ?? false

			if (pressed) {
				activeFrames[index] += 1
			}

			if (pressed !== previous[index]) {
				transitions[index] += 1
				previous[index] = pressed
			}
		}
	}

	return { activeFrames, transitions }
}

function expectReplayRoundTripToPreserveMeaning(
	original: ReturnType<typeof readReplayFile>,
	reparsed: ReturnType<typeof readReplayFile>,
): void {
	expect(reparsed.gameVersion).toBe(original.gameVersion)
	expect(reparsed.beatmapHash).toBe(original.beatmapHash)
	expect(reparsed.username).toBe(original.username)
	expect(reparsed.replayHash).toBe(original.replayHash)
	expect(reparsed.mods).toBe(original.mods)
	expect(reparsed.statistics).toEqual(original.statistics)
	expect(reparsed.totalScore).toBe(original.totalScore)
	expect(reparsed.maxCombo).toBe(original.maxCombo)
	expect(reparsed.perfectCombo).toBe(original.perfectCombo)
	expect(reparsed.playedAt.toISOString()).toBe(original.playedAt.toISOString())
	expect(reparsed.frames).toEqual(original.frames)
	expect(reparsed.onlineScoreId).toEqual(original.onlineScoreId)
	expect(reparsed.stableRandomSeed).toBe(original.stableRandomSeed)
	expect(reparsed.lazer?.mods).toEqual(original.lazer?.mods)
	expect(reparsed.lazer?.statistics).toEqual(original.lazer?.statistics)
	expect(reparsed.lazer?.maximumStatistics).toEqual(original.lazer?.maximumStatistics)
	expect(reparsed.lazer?.clientVersion).toBe(original.lazer?.clientVersion)
	expect(reparsed.lazer?.rank).toBe(original.lazer?.rank)
	expect(reparsed.lazer?.userId).toBe(original.lazer?.userId)
	expect(reparsed.lazer?.totalScoreWithoutMods).toBe(original.lazer?.totalScoreWithoutMods)
	expect(reparsed.lazer?.pauses ?? []).toEqual(original.lazer?.pauses ?? [])
}

describe('mania beatmap fixtures', () => {
	it('parses the another beatmap fixture', () => {
		const beatmap = readBeatmapFile(join(fixtureDirectory, 'another.osu'))

		expect(beatmap.general.audioFilename).toBe('audio.mp3')
		expect(beatmap.general.previewTime).toBe(324)
		expect(beatmap.metadata.title).toBe('pupa (TV Size)')
		expect(beatmap.metadata.artist).toBe('Ibuki Kido & Erii Yamazaki')
		expect(beatmap.metadata.version).toBe('Another')
		expect(beatmap.difficulty.keyCount).toBe(7)
		expect(beatmap.events?.backgroundFilename).toBe('BG.jpg')
		expect(beatmap.controlPoints).toHaveLength(3)
		expect(beatmap.controlPoints[0]).toMatchObject({
			kind: 'timing',
			time: 574,
			beatLength: 250,
			meter: 4,
		})
		expect(beatmap.hitObjects[0]).toMatchObject({
			column: 0,
			startTime: 324,
			endTime: undefined,
		})
		expect(beatmap.hitObjects[6]).toMatchObject({
			column: 0,
			startTime: 574,
			endTime: 824,
		})
		expect(beatmap.hitObjects).toHaveLength(476)
	})

	it('round-trips the another beatmap fixture', () => {
		const fixturePath = join(fixtureDirectory, 'another.osu')
		const outputPath = join(import.meta.dirname, 'output', 'another-roundtrip.osu')
		const original = readBeatmapFile(fixturePath)

		writeBeatmapFile(outputPath, original)

		const reparsed = readBeatmapFile(outputPath)

		expect(reparsed.general).toEqual(original.general)
		expect(reparsed.metadata).toEqual(original.metadata)
		expect(reparsed.difficulty).toEqual(original.difficulty)
		expect(reparsed.events).toEqual(original.events)
		expect(reparsed.controlPoints).toEqual(original.controlPoints)
		expect(reparsed.hitObjects).toEqual(original.hitObjects)
	})

	it('can skip beatmap hit object parsing entirely', () => {
		const beatmap = readBeatmapFile(join(fixtureDirectory, 'another.osu'), { includeHitObjects: false })

		expect(beatmap.metadata.title).toBe('pupa (TV Size)')
		expect(beatmap.controlPoints).toHaveLength(3)
		expect(beatmap.hitObjects).toEqual([])
	})
})

describe('lazer 7K replay fixtures', () => {
	it('parses the no-mod replay', () => {
		const replay = readReplayFile(join(replayFixtureDirectory, 'no-mod.osr'), 7)
		const summary = summarizeColumnActivity(replay.frames, 7)

		expect(replay.frames.length).toBeGreaterThan(0)
		expect(replay.frames[0]?.columns).toHaveLength(7)
		expect(replay.mods).toBe(0)
		expect(replay.lazer?.mods).toEqual([])
		expect(replay.lazer?.pauses).toEqual([])
		expect(replay.lazer?.statistics).toEqual([461, 285, 49, 1, 0, 0])
		expect(summary.activeFrames).toSatisfy((counts: number[]) => counts.every((count) => count > 500))
		expect(summary.transitions).toSatisfy((counts: number[]) => counts.every((count) => count > 100))
	})

	it('can skip replay frame parsing entirely', () => {
		const replay = readReplayFile(join(replayFixtureDirectory, 'no-mod.osr'), 7, { includeFrames: false })

		expect(replay.username).toBe('zzzzv')
		expect(replay.frames).toEqual([])
		expect(replay.stableRandomSeed).toBeUndefined()
		expect(replay.lazer?.statistics).toEqual([461, 285, 49, 1, 0, 0])
	})

	it('round-trips the no-mod replay', () => {
		const fixturePath = join(replayFixtureDirectory, 'no-mod.osr')
		const outputPath = join(import.meta.dirname, 'output', 'no-mod-roundtrip.osr')
		const original = readReplayFile(fixturePath, 7)

		writeReplayFile(outputPath, original)

		const reparsed = readReplayFile(outputPath, 7)

		expectReplayRoundTripToPreserveMeaning(original, reparsed)
	})

	it('parses the multi-mod replay', () => {
		const replay = readReplayFile(join(replayFixtureDirectory, 'multi-mod.osr'), 7)
		const summary = summarizeColumnActivity(replay.frames, 7)

		expect(replay.frames.length).toBeGreaterThan(0)
		expect(replay.frames[0]?.columns).toHaveLength(7)
		expect(replay.lazer?.mods).toEqual([
			{
				acronym: 'DT',
				settings: {
					speedChange: 1.05,
				},
			},
			{
				acronym: 'RD',
				settings: {
					seed: 1160879381,
				},
			},
			{
				acronym: 'MR',
			},
		])
		expect(replay.lazer?.statistics).toEqual([487, 268, 33, 3, 2, 3])
		expect(summary.activeFrames).toSatisfy((counts: number[]) => counts.every((count) => count > 500))
		expect(summary.transitions).toSatisfy((counts: number[]) => counts.every((count) => count > 100))
	})

	it('round-trips the multi-mod replay', () => {
		const fixturePath = join(replayFixtureDirectory, 'multi-mod.osr')
		const outputPath = join(import.meta.dirname, 'output', 'multi-mod-roundtrip.osr')
		const original = readReplayFile(fixturePath, 7)

		writeReplayFile(outputPath, original)

		const reparsed = readReplayFile(outputPath, 7)

		expectReplayRoundTripToPreserveMeaning(original, reparsed)
	})
})
