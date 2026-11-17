/**
 * osu!mania judgement windows, mirroring osu!lazer's `ManiaHitWindows`.
 *
 * Window values are single-sided half widths in milliseconds, so the accepted
 * offset range for a judgement is `[-window, +window]`.
 */
export type ManiaHitResult = 'perfect' | 'great' | 'good' | 'ok' | 'meh' | 'miss'

/**
 * The judgement windows of a beatmap, in milliseconds.
 */
export type ManiaHitWindows = Readonly<Record<ManiaHitResult, number>>

/**
 * A `min`/`mid`/`max` window range as stored by `IBeatmapDifficultyInfo`.
 *
 * The values correspond to OD 0, OD 5, and OD 10.
 */
type DifficultyRange = readonly [min: number, mid: number, max: number]

const PERFECT_WINDOW_RANGE: DifficultyRange = [22.4, 19.4, 13.9]
const GREAT_WINDOW_RANGE: DifficultyRange = [64, 49, 34]
const GOOD_WINDOW_RANGE: DifficultyRange = [97, 82, 67]
const OK_WINDOW_RANGE: DifficultyRange = [127, 112, 97]
const MEH_WINDOW_RANGE: DifficultyRange = [151, 136, 121]
const MISS_WINDOW_RANGE: DifficultyRange = [188, 173, 158]

export interface ManiaHitWindowsOptions {
  /**
   * The effective overall difficulty, after mods have been applied.
   */
  overallDifficulty: number

  /**
   * The clock rate applied to gameplay, such as 1.5 for DT. Defaults to 1.
   *
   * Windows grow with the rate so that they stay constant in real time.
   */
  speedMultiplier?: number

  /**
   * The hit window difficulty multiplier, such as 1.4 for HR. Defaults to 1.
   *
   * Pass `ModdedBeatmap.difficultyMultiplier` directly.
   */
  difficultyMultiplier?: number
}

/**
 * Computes the osu!mania judgement windows for the given difficulty settings.
 */
export function computeManiaHitWindows(options: ManiaHitWindowsOptions): ManiaHitWindows {
  const speedMultiplier = options.speedMultiplier ?? 1
  const difficultyMultiplier = options.difficultyMultiplier ?? 1
  const totalMultiplier = speedMultiplier / difficultyMultiplier

  return {
    perfect: windowFor(options.overallDifficulty, PERFECT_WINDOW_RANGE, totalMultiplier),
    great: windowFor(options.overallDifficulty, GREAT_WINDOW_RANGE, totalMultiplier),
    good: windowFor(options.overallDifficulty, GOOD_WINDOW_RANGE, totalMultiplier),
    ok: windowFor(options.overallDifficulty, OK_WINDOW_RANGE, totalMultiplier),
    meh: windowFor(options.overallDifficulty, MEH_WINDOW_RANGE, totalMultiplier),
    miss: windowFor(options.overallDifficulty, MISS_WINDOW_RANGE, totalMultiplier),
  }
}

/**
 * Interpolates a `min`/`mid`/`max` range for an arbitrary difficulty value.
 */
export function difficultyRange(difficulty: number, range: DifficultyRange): number {
  const [min, mid, max] = range

  if (difficulty > 5) {
    return mid + (max - mid) * (difficulty - 5) / 5
  }

  if (difficulty < 5) {
    return mid - (mid - min) * (5 - difficulty) / 5
  }

  return mid
}

function windowFor(overallDifficulty: number, range: DifficultyRange, totalMultiplier: number): number {
  // osu! rounds down to a whole millisecond and then lands the window on `x.5`
  // so that offsets exactly on a millisecond boundary are unambiguous.
  return Math.floor(difficultyRange(overallDifficulty, range) * totalMultiplier) + 0.5
}
