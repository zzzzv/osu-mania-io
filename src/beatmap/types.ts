import type { BeatmapDifficulty } from './sections/difficulty'
import type { BeatmapEditorState } from './sections/editor'
import type { BeatmapEvents, BreakPeriod } from './sections/events'
import type { BeatmapGeneral } from './sections/general'
import type { HitObject } from './sections/hit-objects'
import type { BeatmapMetadata } from './sections/metadata'
import type { ControlPoint } from './sections/timing-points'

/**
 * Supported legacy file format versions for beatmap serialization.
 *
 * Version 128 is treated as a lazer-compatible syntax variant of the same
 * mania data model used by stable-era versions.
 */
export type BeatmapFileFormat = 12 | 13 | 14 | 128

export type { BeatmapDifficulty } from './sections/difficulty'
export type { BeatmapEditorState } from './sections/editor'
export type { BeatmapEvents, BreakPeriod } from './sections/events'
export type { BeatmapGeneral } from './sections/general'
export type { HitObject, SampleReference } from './sections/hit-objects'
export type { BeatmapMetadata } from './sections/metadata'
export type { ControlPoint, ControlPointBase, SampleBank, ScrollVelocityPoint, TimingPoint } from './sections/timing-points'
export type Countdown = import('./sections/general').BeatmapGeneral['countdown']

/**
 * The normalized public mania beatmap model.
 */
export interface Beatmap {
  /**
   * The mania general section.
   */
  general: BeatmapGeneral

  /**
   * The shared editor section.
   */
  editor?: BeatmapEditorState

  /**
   * The beatmap metadata.
   */
  metadata: BeatmapMetadata

  /**
   * The beatmap difficulty settings.
   */
  difficulty: BeatmapDifficulty

  /**
    * The supported mania-relevant Events section data.
    */
    events?: BeatmapEvents

    /**
   * The ordered control points used by mania timing and SV.
   */
  controlPoints: readonly ControlPoint[]

  /**
   * The optional break periods.
   */
  breaks?: readonly BreakPeriod[]

  /**
   * The ordered mania hit objects.
   */
  hitObjects: readonly HitObject[]
}