import type { Beatmap, HitObject } from '../../beatmap'
import type { LazerMod, LazerRandomMod, LazerRateAdjustMod, PlainLazerMod } from '../lazer'
import { LegacyModBit, type LegacyModBitmask } from '../legacy'

import { createShuffledColumns, createStableShuffledColumns } from './random'
import type { ModdedBeatmap } from './types'
import {
  cloneBeatmap,
  cloneHitObject,
  computeInvertDuration,
  groupHitObjectsByColumn,
  sortHitObjects,
} from './utils'

/**
 * A column shuffle strategy mapping the original column of each hit object to a new column.
 */
type ColumnShuffleStrategy = (keyCount: number, seed: number | undefined) => number[]

/**
 * Options for {@link applyLegacyBeatmapMods}.
 */
export interface LegacyBeatmapModOptions {
  /**
   * The seed used by the stable random (RD) mod, usually taken from `Replay.stableRandomSeed`.
   *
   * Defaults to 0 when omitted.
   */
  randomSeed?: number
}

export function createModdedBeatmap(beatmap: Beatmap): ModdedBeatmap {
  return {
    ...cloneBeatmap(beatmap),
    baseBeatmap: beatmap,
    appliedMods: [],
    speedMultiplier: 1,
    hitWindowScale: 1,
  }
}

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
  const randomSeed = options?.randomSeed ?? 0

  return applyBeatmapModsWith(beatmap, decodeLegacyModBitmask(mods), (keyCount) =>
    createStableShuffledColumns(keyCount, randomSeed),
  )
}

export function applyBeatmapMod(beatmap: ModdedBeatmap, mod: LazerMod): ModdedBeatmap {
  return applyBeatmapModWith(beatmap, mod, createShuffledColumns)
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
      return applyPlaybackRateMod(beatmap, mod as LazerRateAdjustMod)
    case 'HR':
      return applyHitWindowScaleMod(beatmap, mod as PlainLazerMod & { acronym: 'HR' }, 1 / 1.4)
    case 'EZ':
      return applyHitWindowScaleMod(beatmap, mod as PlainLazerMod & { acronym: 'EZ' }, 1.4)
    case 'MR':
      return applyMirrorMod(beatmap, mod as PlainLazerMod & { acronym: 'MR' })
    case 'RD':
      return applyRandomMod(beatmap, mod as LazerRandomMod, shuffleColumns)
    case 'IN':
      return applyInvertMod(beatmap, mod as PlainLazerMod & { acronym: 'IN' })
    case 'HO':
      return applyHoldOffMod(beatmap, mod as PlainLazerMod & { acronym: 'HO' })
    default:
      return beatmap
  }
}

function applyPlaybackRateMod(beatmap: ModdedBeatmap, mod: LazerRateAdjustMod): ModdedBeatmap {
  const speedMultiplier = mod.settings?.speedChange ?? (
    mod.acronym === 'HT' || mod.acronym === 'DC'
      ? 0.75
      : 1.5
  )

  return withAppendedMod(beatmap, mod.acronym, {
    speedMultiplier: beatmap.speedMultiplier * speedMultiplier,
  })
}

function applyHitWindowScaleMod(
  beatmap: ModdedBeatmap,
  mod: PlainLazerMod & { acronym: 'HR' | 'EZ' },
  scale: number,
): ModdedBeatmap {
  return withAppendedMod(beatmap, mod.acronym, {
    hitWindowScale: beatmap.hitWindowScale * scale,
  })
}

function applyMirrorMod(beatmap: ModdedBeatmap, mod: PlainLazerMod & { acronym: 'MR' }): ModdedBeatmap {
  return withAppendedMod(beatmap, mod.acronym, {
    hitObjects: beatmap.hitObjects.map((hitObject: HitObject) => ({
      ...cloneHitObject(hitObject),
      column: beatmap.difficulty.keyCount - 1 - hitObject.column,
    })),
  })
}

function applyRandomMod(
  beatmap: ModdedBeatmap,
  mod: LazerRandomMod,
  shuffleColumns: ColumnShuffleStrategy,
): ModdedBeatmap {
  const shuffledColumns = shuffleColumns(beatmap.difficulty.keyCount, mod.settings?.seed)

  return withAppendedMod(beatmap, mod.acronym, {
    hitObjects: beatmap.hitObjects.map((hitObject: HitObject) => ({
      ...cloneHitObject(hitObject),
      column: shuffledColumns[hitObject.column] ?? hitObject.column,
    })),
  })
}

function applyInvertMod(beatmap: ModdedBeatmap, mod: PlainLazerMod & { acronym: 'IN' }): ModdedBeatmap {
  const groupedObjects = groupHitObjectsByColumn(beatmap.hitObjects, beatmap.difficulty.keyCount)
  const nextHitObjects: HitObject[] = []

  for (let column = 0; column < groupedObjects.length; column += 1) {
    const objects = groupedObjects[column] ?? []

    for (let index = 0; index < objects.length - 1; index += 1) {
      const current = objects[index]!
      const next = objects[index + 1]!
      const duration = computeInvertDuration(beatmap, current.startTime, next.startTime)

      nextHitObjects.push({
        ...cloneHitObject(current),
        column,
        startTime: current.startTime,
        endTime: current.startTime + duration,
      })
    }
  }

  return withAppendedMod(beatmap, mod.acronym, {
    hitObjects: sortHitObjects(nextHitObjects),
    breaks: [],
  })
}

function applyHoldOffMod(beatmap: ModdedBeatmap, mod: PlainLazerMod & { acronym: 'HO' }): ModdedBeatmap {
  return withAppendedMod(beatmap, mod.acronym, {
    hitObjects: beatmap.hitObjects.map((hitObject: HitObject) => ({
      ...cloneHitObject(hitObject),
      endTime: undefined,
    })),
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

function withAppendedMod(beatmap: ModdedBeatmap, acronym: string, patch: Partial<ModdedBeatmap>): ModdedBeatmap {
  return {
    ...beatmap,
    ...patch,
    appliedMods: [...beatmap.appliedMods, acronym],
  }
}