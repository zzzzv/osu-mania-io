import { join } from 'node:path'
import { readdirSync, existsSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { readBeatmapFile, readReplayFile } from '../src/node'
import { applyLegacyBeatmapMods, LegacyModBit } from '../src/mod'
import { createShuffledColumns, createStableShuffledColumns } from '../src/mod/modded-beatmap/random'

const randomTestDir = join(import.meta.dirname, 'fixtures', 'random-test')

const NOTE_TIMES = [1000, 1500, 2000, 2500, 3000, 3500, 4000]

/**
 * Reads a replay and extracts the column permutation from key-down events
 * matched to each expected staircase note time.
 */
function readReplayPermutation(file: string): { seed: number; permutation: number[] } {
	const replay = readReplayFile(file, 7)

	// Extract seed
	const rdMod = replay.lazer?.mods?.find((mod) => mod.acronym === 'RD')
	const lazerSeed = rdMod?.settings && 'seed' in rdMod.settings
		? (rdMod.settings as { seed: number }).seed
		: undefined
	const stableSeed = replay.stableRandomSeed && replay.stableRandomSeed > 0
		? replay.stableRandomSeed
		: undefined

	const seed = lazerSeed ?? stableSeed
	if (seed === undefined) throw new Error('No random seed found in replay')

	// Collect all key-down events with their frame times
	const pressEvents: { time: number; col: number }[] = []
	const previous = Array<boolean>(7).fill(false)

	for (const frame of replay.frames) {
		for (let col = 0; col < 7; col++) {
			const pressed = frame.columns[col] ?? false
			if (pressed && !previous[col]) {
				pressEvents.push({ time: frame.time, col })
			}
			previous[col] = pressed
		}
	}

	// Match each expected note time to the nearest unmatched key-down event
	const permutation: number[] = []
	const used = new Set<number>()

	for (const noteTime of NOTE_TIMES) {
		let bestIndex: number | undefined
		let bestDist = Infinity

		for (let i = 0; i < pressEvents.length; i++) {
			if (used.has(i)) continue
			const dist = Math.abs(pressEvents[i].time - noteTime)
			if (dist < bestDist) { bestDist = dist; bestIndex = i }
		}

		if (bestIndex !== undefined && bestDist <= 500) {
			used.add(bestIndex)
			permutation.push(pressEvents[bestIndex].col)
		}
	}

	return { seed, permutation }
}

function scanReplayFiles(dir: string): { file: string; label: string }[] {
	const entries: { file: string; label: string }[] = []

	if (existsSync(dir)) {
		for (const name of readdirSync(dir)) {
			if (name.endsWith('.osr')) {
				entries.push({ file: join(dir, name), label: name })
			}
		}
	}

	return entries
}

// ---------------------------------------------------------------------------
// Lazer — uses createShuffledColumns (System.Random + OrderBy)
// ---------------------------------------------------------------------------

describe('lazer random mod permutation', () => {
	const entries = scanReplayFiles(join(randomTestDir, 'lazer'))

	if (entries.length === 0) {
		it.skip('no lazer replay fixtures found', () => {})
	}

	for (const { file, label } of entries) {
		it(`matches createShuffledColumns for ${label}`, () => {
			const { seed, permutation } = readReplayPermutation(file)

			expect(permutation).toHaveLength(7)
			const expected = createShuffledColumns(7, seed)

			expect(permutation).toEqual(expected)
		})
	}
})

// ---------------------------------------------------------------------------
// Stable — unit-level permutation generator check
// ---------------------------------------------------------------------------

describe('stable random permutation generator', () => {
	const entries = scanReplayFiles(join(randomTestDir, 'stable'))

	if (entries.length === 0) {
		it.skip('no stable replay fixtures found', () => {})
	}

	for (const { file, label } of entries) {
		it(`matches createStableShuffledColumns for ${label}`, () => {
			const { seed, permutation } = readReplayPermutation(file)

			expect(permutation).toHaveLength(7)
			expect(permutation).toEqual(createStableShuffledColumns(7, seed))
		})
	}
})

// ---------------------------------------------------------------------------
// Stable — integration check through applyLegacyBeatmapMods
// ---------------------------------------------------------------------------

describe('stable random mod application', () => {
	const entries = scanReplayFiles(join(randomTestDir, 'stable'))
	const beatmap = readBeatmapFile(join(randomTestDir, 'staircase.osu'))

	if (entries.length === 0) {
		it.skip('no stable replay fixtures found', () => {})
	}

	for (const { file, label } of entries) {
		it(`reproduces the played columns for ${label}`, () => {
			const { seed, permutation } = readReplayPermutation(file)
			const modded = applyLegacyBeatmapMods(beatmap, LegacyModBit.Random, { randomSeed: seed })

			expect(modded.appliedMods).toContain('RD')
			expect(modded.hitObjects.map((hitObject) => hitObject.column)).toEqual(permutation)
		})
	}
})
