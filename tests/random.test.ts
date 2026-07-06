import { join } from 'node:path'
import { readdirSync, existsSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { readReplayFile } from '../src/node'
import { createShuffledColumns } from '../src/mod/modded-beatmap/random'

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
// Stable — algorithm unknown; log data for analysis
// ---------------------------------------------------------------------------

describe('stable random mod permutation', () => {
	const entries = scanReplayFiles(join(randomTestDir, 'stable'))

	if (entries.length === 0) {
		it.skip('no stable replay fixtures found', () => {})
	}

	for (const { file, label } of entries) {
		it(`debug: seed and permutation from ${label}`, () => {
			const { seed, permutation } = readReplayPermutation(file)

			console.log(JSON.stringify({ file: label, seed, permutation }))
		})
	}
})
