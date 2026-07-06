import type { Beatmap } from '../../beatmap'

/**
 * A beatmap snapshot after applying zero or more gameplay-affecting mods.
 */
export interface ModdedBeatmap extends Beatmap {
  /**
   * The original beatmap before mod application.
   */
  baseBeatmap: Beatmap

  /**
   * The ordered acronyms of mods applied to this snapshot.
   */
  appliedMods: readonly string[]

  /**
   * The effective playback speed multiplier.
   */
  speedMultiplier: number

  /**
   * The effective timing-window scale where values below 1 tighten windows.
   */
  hitWindowScale: number
}