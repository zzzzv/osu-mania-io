import type { BeatmapColours } from './sections/colors'
import type { BeatmapDifficulty } from './sections/difficulty'
import type { BeatmapEditorState } from './sections/editor'
import type { BeatmapEvents } from './sections/events'
import type { BeatmapGeneral } from './sections/general'
import type { HitObject } from './sections/hit-objects'
import type { BeatmapMetadata } from './sections/metadata'
import type { ControlPoint } from './sections/timing-points'
import type { RawSection } from './section-io'

/**
 * Legacy `.osu` file format versions that this library is known to emit.
 *
 * osu!lazer writes `128`; osu!stable writes `14`. Parsed beatmaps keep whatever
 * version they were read from.
 */
export type BeatmapFileFormat = number

export type { SampleBank } from './sample-bank'
export type { BeatmapColours, Colour } from './sections/colors'
export type { BeatmapDifficulty } from './sections/difficulty'
export type { BeatmapEditorState } from './sections/editor'
export type {
  BackgroundEvent,
  BeatmapEvents,
  BreakPeriod,
  VideoEvent,
} from './sections/events'
export type { BeatmapGeneral, GameMode, OverlayPosition } from './sections/general'
export type { HitObject, SampleReference } from './sections/hit-objects'
export type { BeatmapMetadata } from './sections/metadata'
export type { ControlPoint, ControlPointBase, ScrollVelocityPoint, TimingPoint } from './sections/timing-points'
export type { RawSection } from './section-io'
export type Countdown = import('./sections/general').BeatmapGeneral['countdown']

/**
 * The normalized public mania beatmap model.
 */
export interface Beatmap {
  /**
   * The `.osu` file format version this beatmap was read from or will be written as.
   */
  fileFormat: BeatmapFileFormat

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
   * The mania-relevant Events section data, including break periods.
   */
  events?: BeatmapEvents

  /**
   * The ordered control points used by mania timing and SV.
   */
  controlPoints: readonly ControlPoint[]

  /**
   * The combo and slider colours from the `[Colours]` section.
   */
  colours?: BeatmapColours

  /**
   * The ordered mania hit objects.
   */
  hitObjects: readonly HitObject[]

  /**
   * Sections this library does not model, preserved verbatim for round-tripping.
   */
  extraSections?: readonly RawSection[]
}
