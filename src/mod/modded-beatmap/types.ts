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
   * The ordered acronyms of mods that have no beatmap-level effect here and were
   * therefore skipped, such as purely visual or score-only mods.
   */
  ignoredMods: readonly string[]

  /**
   * The effective playback speed multiplier.
   *
   * Hit object times stay in beatmap time, matching osu!lazer, where the rate is
   * applied by the gameplay clock.
   */
  speedMultiplier: number

  /**
   * The effective hit window difficulty multiplier, where values above 1 tighten
   * windows.
   *
   * Combine with `speedMultiplier` when computing judgement windows, or pass both
   * to `computeManiaHitWindows`.
   */
  difficultyMultiplier: number
}
