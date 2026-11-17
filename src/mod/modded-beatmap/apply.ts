import type { Beatmap, BeatmapEvents, HitObject } from '../../beatmap'
import {
  clampScrollVelocity,
  createTimingResolver,
  getLastObjectTime,
  getMostCommonBeatLength,
} from '../../beatmap'
import {
  type LazerMod,
  readLazerModBooleanSetting,
  readLazerModNumberSetting,
} from '../lazer'
import { LegacyModBit, type LegacyModBitmask } from '../legacy'

import { createShuffledColumns, createStableShuffledColumns } from './random'
import type { ModdedBeatmap } from './types'
import {
  cloneBeatmap,
  cloneHitObject,
  groupHitObjectsByColumn,
  sortHitObjects,
} from './utils'

/**
 * osu!mania HR hit window multiplier (`ManiaModHardRock`).
 */
const HARD_ROCK_DIFFICULTY_MULTIPLIER = 1.4

/**
 * osu!mania EZ hit window multiplier (`ManiaModEasy`).
 */
const EASY_DIFFICULTY_MULTIPLIER = 1 / 1.4

/**
 * `ModHardRock.ApplyToDifficulty` drain rate ratio.
 */
const HARD_ROCK_DRAIN_RATE_MULTIPLIER = 1.4

/**
 * `ModEasy.ApplyToDifficulty` drain rate ratio.
 */
const EASY_DRAIN_RATE_MULTIPLIER = 0.5

/**
 * A column shuffle strategy mapping an original column to a new column.
 */
type ColumnShuffleStrategy = (keyCount: number, seed: number | undefined) => number[]

/**
 * Options for {@link applyLegacyBeatmapMods}.
 */
export interface LegacyBeatmapModOptions {
  /**
   * The seed used by the stable random (RD) mod, taken from `Replay.stableRandomSeed`.
   *
   * Required whenever the random mod bit is set, because stable derives its
   * permutation from the replay seed.
   */
  randomSeed?: number
}

export function createModdedBeatmap(beatmap: Beatmap): ModdedBeatmap {
  return {
    ...cloneBeatmap(beatmap),
    baseBeatmap: beatmap,
    appliedMods: [],
    ignoredMods: [],
    speedMultiplier: 1,
    difficultyMultiplier: 1,
  }
}

/**
 * Applies a list of lazer mods in order.
 */
export function applyBeatmapMods(beatmap: Beatmap, mods: readonly LazerMod[]): ModdedBeatmap {
  return applyBeatmapModsWith(beatmap, mods, createShuffledColumns)
}

/**
 * Applies stable-compatible legacy mods by first normalizing them to the shared lazer-facing mod model.
 *
 * Unlike lazer, stable's random mod derives its column permutation from a replay seed, so a seed must be
 * provided whenever the random mod bit is set.
 */
export function applyLegacyBeatmapMods(
  beatmap: Beatmap,
  mods: LegacyModBitmask,
  options?: LegacyBeatmapModOptions,
): ModdedBeatmap {
  const usesRandom = (mods & LegacyModBit.Random) !== 0

  if (usesRandom && options?.randomSeed === undefined) {
    throw new Error(
      'The osu!stable random mod requires a seed; pass { randomSeed: replay.stableRandomSeed }.',
    )
  }

  const randomSeed = options?.randomSeed ?? 0

  return applyBeatmapModsWith(
    beatmap,
    decodeLegacyModBitmask(mods),
    (keyCount) => createStableShuffledColumns(keyCount, randomSeed),
  )
}

/**
 * Applies a single lazer mod on top of an existing snapshot.
 */
export function applyBeatmapMod(beatmap: Beatmap | ModdedBeatmap, mod: LazerMod): ModdedBeatmap {
  return applyBeatmapModWith(toModdedBeatmap(beatmap), mod, createShuffledColumns)
}

function applyBeatmapModsWith(
  beatmap: Beatmap,
  mods: readonly LazerMod[],
  shuffleColumns: ColumnShuffleStrategy,
): ModdedBeatmap {
  let current = createModdedBeatmap(beatmap)

  for (const mod of mods) {
    current = applyBeatmapModWith(current, mod, shuffleColumns)
  }

  return current
}

function applyBeatmapModWith(
  beatmap: ModdedBeatmap,
  mod: LazerMod,
  shuffleColumns: ColumnShuffleStrategy,
): ModdedBeatmap {
  switch (mod.acronym) {
    case 'DT':
    case 'NC':
    case 'HT':
    case 'DC':
      return applyPlaybackRateMod(beatmap, mod)
    case 'HR':
      return applyHitWindowMultiplierMod(
        beatmap,
        mod,
        HARD_ROCK_DIFFICULTY_MULTIPLIER,
        HARD_ROCK_DRAIN_RATE_MULTIPLIER,
      )
    case 'EZ':
      return applyHitWindowMultiplierMod(
        beatmap,
        mod,
        EASY_DIFFICULTY_MULTIPLIER,
        EASY_DRAIN_RATE_MULTIPLIER,
      )
    case 'DA':
      return applyDifficultyAdjustMod(beatmap, mod)
    case 'MR':
      return applyMirrorMod(beatmap, mod)
    case 'RD':
      return applyRandomMod(beatmap, mod, shuffleColumns)
    case 'IN':
      return applyInvertMod(beatmap, mod)
    case 'HO':
      return applyHoldOffMod(beatmap, mod)
    default:
      return withIgnoredMod(beatmap, mod.acronym)
  }
}

function applyPlaybackRateMod(beatmap: ModdedBeatmap, mod: LazerMod): ModdedBeatmap {
  const speedChange = readLazerModNumberSetting(mod, 'speedChange') ?? (
    mod.acronym === 'HT' || mod.acronym === 'DC'
      ? 0.75
      : 1.5
  )

  return withAppendedMod(beatmap, mod.acronym, {
    speedMultiplier: beatmap.speedMultiplier * speedChange,
  })
}

/**
 * Applies HR/EZ.
 *
 * In osu!mania `CircleSize` is the key count, so it is never scaled here; only
 * the hit window multiplier and the drain rate change.
 */
function applyHitWindowMultiplierMod(
  beatmap: ModdedBeatmap,
  mod: LazerMod,
  difficultyMultiplier: number,
  drainRateMultiplier: number,
): ModdedBeatmap {
  return withAppendedMod(beatmap, mod.acronym, {
    difficultyMultiplier: beatmap.difficultyMultiplier * difficultyMultiplier,
    difficulty: {
      ...beatmap.difficulty,
      hpDrainRate: Math.min(beatmap.difficulty.hpDrainRate * drainRateMultiplier, 10),
    },
  })
}

function applyDifficultyAdjustMod(beatmap: ModdedBeatmap, mod: LazerMod): ModdedBeatmap {
  const extendedLimits = readLazerModBooleanSetting(mod, 'extendedLimits') ?? false
  const overallDifficulty = readLazerModNumberSetting(mod, 'overallDifficulty')
  const drainRate = readLazerModNumberSetting(mod, 'drainRate')
  const difficulty = { ...beatmap.difficulty }

  if (overallDifficulty !== undefined) {
    difficulty.overallDifficulty = clampDifficulty(overallDifficulty, extendedLimits)
  }

  if (drainRate !== undefined) {
    difficulty.hpDrainRate = clampDifficulty(drainRate, extendedLimits)
  }

  return withAppendedMod(beatmap, mod.acronym, { difficulty })
}

function applyMirrorMod(beatmap: ModdedBeatmap, mod: LazerMod): ModdedBeatmap {
  const lastColumn = beatmap.difficulty.keyCount - 1

  return withAppendedMod(beatmap, mod.acronym, {
    hitObjects: beatmap.hitObjects.map((hitObject) => ({
      ...cloneHitObject(hitObject),
      column: lastColumn - hitObject.column,
    })),
  })
}

function applyRandomMod(
  beatmap: ModdedBeatmap,
  mod: LazerMod,
  shuffleColumns: ColumnShuffleStrategy,
): ModdedBeatmap {
  const shuffledColumns = shuffleColumns(
    beatmap.difficulty.keyCount,
    readLazerModNumberSetting(mod, 'seed'),
  )

  return withAppendedMod(beatmap, mod.acronym, {
    hitObjects: beatmap.hitObjects.map((hitObject) => ({
      ...cloneHitObject(hitObject),
      column: shuffledColumns[hitObject.column] ?? hitObject.column,
    })),
  })
}

/**
 * Applies IN, mirroring `ManiaModInvert`: every note becomes a hold that lasts
 * until the next object in the same column, shortened by at most a quarter beat.
 */
function applyInvertMod(beatmap: ModdedBeatmap, mod: LazerMod): ModdedBeatmap {
  const resolver = createTimingResolver(beatmap.controlPoints)
  const groupedObjects = groupHitObjectsByColumn(beatmap.hitObjects, beatmap.difficulty.keyCount)
  const nextHitObjects: HitObject[] = []

  groupedObjects.forEach((objects, column) => {
    // The last object of each column has no following object to invert against.
    for (let index = 0; index < objects.length - 1; index += 1) {
      const current = objects[index]!
      const next = objects[index + 1]!
      const gap = next.startTime - current.startTime
      const beatLength = resolver.beatLengthAt(next.startTime)

      nextHitObjects.push({
        ...cloneHitObject(current),
        column,
        endTime: current.startTime + Math.max(gap / 2, gap - beatLength / 4),
      })
    }
  })

  return withAppendedMod(beatmap, mod.acronym, {
    hitObjects: sortHitObjects(nextHitObjects),
    // Inverted charts are a continuous wall of holds; lazer drops the breaks too.
    events: withBreaks(beatmap, []),
  })
}

/**
 * Applies HO, mirroring `ManiaModHoldOff` including its scroll speed compensation.
 */
function applyHoldOffMod(beatmap: ModdedBeatmap, mod: LazerMod): ModdedBeatmap {
  const beatLengthBefore = getMostCommonBeatLength(beatmap)
  const hitObjects = beatmap.hitObjects.map((hitObject) => (
    hitObject.endTime === undefined
      ? cloneHitObject(hitObject)
      : { ...cloneHitObject(hitObject), endTime: undefined }
  ))
  const beatLengthAfter = getMostCommonBeatLength(
    { ...beatmap, hitObjects },
    getLastObjectTime({ ...beatmap, hitObjects }),
  )
  const scrollSpeedScale = beatLengthBefore / beatLengthAfter

  return withAppendedMod(beatmap, mod.acronym, {
    hitObjects,
    controlPoints: Number.isFinite(scrollSpeedScale) && scrollSpeedScale !== 1
      ? beatmap.controlPoints.map((point) => (
          point.kind === 'scroll-velocity'
            ? { ...point, multiplier: clampScrollVelocity(point.multiplier * scrollSpeedScale) }
            : point
        ))
      : beatmap.controlPoints,
  })
}

/**
 * Decodes a stable-compatible legacy mod bitmask into the shared mod model used by beatmap transforms.
 *
 * Only beatmap-affecting mods supported by this package are emitted. Pure score/UI mods are ignored here.
 */
function decodeLegacyModBitmask(mods: LegacyModBitmask): LazerMod[] {
  const decoded: LazerMod[] = []

  if ((mods & LegacyModBit.Easy) !== 0) {
    decoded.push({ acronym: 'EZ' })
  }

  if ((mods & LegacyModBit.HardRock) !== 0) {
    decoded.push({ acronym: 'HR' })
  }

  if ((mods & LegacyModBit.Nightcore) !== 0) {
    decoded.push({ acronym: 'NC' })
  } else if ((mods & LegacyModBit.DoubleTime) !== 0) {
    decoded.push({ acronym: 'DT' })
  }

  if ((mods & LegacyModBit.HalfTime) !== 0) {
    decoded.push({ acronym: 'HT' })
  }

  if ((mods & LegacyModBit.Random) !== 0) {
    decoded.push({ acronym: 'RD' })
  }

  if ((mods & LegacyModBit.Mirror) !== 0) {
    decoded.push({ acronym: 'MR' })
  }

  return decoded
}

function toModdedBeatmap(beatmap: Beatmap | ModdedBeatmap): ModdedBeatmap {
  return 'appliedMods' in beatmap ? beatmap : createModdedBeatmap(beatmap)
}

function withBreaks(beatmap: ModdedBeatmap, breaks: readonly { startTime: number; endTime: number }[]): BeatmapEvents | undefined {
  return {
    ...beatmap.events,
    breaks: breaks.length === 0 ? undefined : breaks,
  }
}

function clampDifficulty(value: number, extendedLimits: boolean): number {
  const minimum = extendedLimits ? -15 : 0
  const maximum = extendedLimits ? 15 : 10

  return Math.min(Math.max(value, minimum), maximum)
}

function withAppendedMod(beatmap: ModdedBeatmap, acronym: string, patch: Partial<ModdedBeatmap>): ModdedBeatmap {
  return {
    ...beatmap,
    ...patch,
    appliedMods: [...beatmap.appliedMods, acronym],
  }
}

function withIgnoredMod(beatmap: ModdedBeatmap, acronym: string): ModdedBeatmap {
  return {
    ...beatmap,
    ignoredMods: [...beatmap.ignoredMods, acronym],
  }
}
