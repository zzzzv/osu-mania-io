import { BeatmapSectionIo } from './section-io'
import type { RawSection } from './section-io'
import {
  coloursSection,
  difficultySection,
  editorSection,
  eventsSection,
  generalSection,
  hitObjectsSection,
  MANIA_GAME_MODE,
  metadataSection,
  timingPointsSection,
} from './sections'
import type { Beatmap, BeatmapFileFormat } from './types'

/**
 * The file format version written when neither the beatmap nor the caller
 * provides one.
 */
const DEFAULT_FILE_FORMAT = 14

/**
 * Sections that are always written, even when empty.
 */
const mandatorySectionNames = new Set(['General', 'Metadata', 'Difficulty', 'TimingPoints', 'HitObjects'])

/**
 * Sections this library parses into its model; every other section is kept in
 * `Beatmap.extraSections`.
 */
const knownSectionNames = new Set([...mandatorySectionNames, 'Editor', 'Events', 'Colours'])

export interface ParseBeatmapOptions {
  /**
   * Whether to validate strictly.
   *
   * When `true` (the default), a beatmap that is not `Mode: 3` and any
   * malformed numeric or list value raises an error. When `false`, unknown
   * modes are accepted and unparseable lines are skipped.
   */
  strict?: boolean

  /**
   * Whether to parse the `[HitObjects]` section. Defaults to `true`.
   */
  includeHitObjects?: boolean
}

export interface SerializeBeatmapOptions {
  /**
   * Overrides the file format version written in the header.
   */
  fileFormat?: BeatmapFileFormat

  /**
   * The line ending to write. Defaults to `lf`.
   */
  lineEnding?: 'lf' | 'crlf'
}

export function parseBeatmap(input: string, options?: ParseBeatmapOptions): Beatmap {
  const strict = options?.strict ?? true
  const includeHitObjects = options?.includeHitObjects ?? true
  const rawSections = BeatmapSectionIo.parseRawSections(input)
  const fileFormat = BeatmapSectionIo.parseFileFormat(input) ?? DEFAULT_FILE_FORMAT
  const keyValueContext = { strict }

  const general = generalSection.read(findLines(rawSections, 'General'), keyValueContext)
  const metadata = metadataSection.read(findLines(rawSections, 'Metadata'), keyValueContext)
  const difficulty = difficultySection.read(findLines(rawSections, 'Difficulty'), keyValueContext)

  if (!general) {
    throw new Error('Beatmap is missing a [General] section.')
  }

  if (!metadata) {
    throw new Error('Beatmap is missing a complete [Metadata] section.')
  }

  if (!difficulty) {
    throw new Error('Beatmap is missing a complete [Difficulty] section.')
  }

  if (strict && general.mode !== MANIA_GAME_MODE) {
    throw new Error(`Expected an osu!mania beatmap (Mode: ${MANIA_GAME_MODE}), but received Mode: ${general.mode}.`)
  }

  if (!Number.isFinite(difficulty.keyCount) || difficulty.keyCount < 1) {
    throw new Error(`Expected a positive mania key count, but received ${difficulty.keyCount}.`)
  }

  const context = { strict, keyCount: difficulty.keyCount }

  const controlPoints = timingPointsSection.read(findLines(rawSections, 'TimingPoints'), context)

  if (!controlPoints || controlPoints.length === 0) {
    throw new Error('Beatmap is missing a usable [TimingPoints] section.')
  }

  const events = eventsSection.read(findLines(rawSections, 'Events'), context)
  const editor = editorSection.read(findLines(rawSections, 'Editor'), context)
  const colours = coloursSection.read(findLines(rawSections, 'Colours'), context)
  const hitObjects = includeHitObjects
    ? hitObjectsSection.read(findLines(rawSections, 'HitObjects'), context) ?? []
    : []
  const extraSections = rawSections.filter((section) => !knownSectionNames.has(section.name))

  return {
    fileFormat,
    general,
    editor,
    metadata,
    difficulty,
    events,
    controlPoints,
    colours,
    hitObjects,
    extraSections: extraSections.length === 0 ? undefined : extraSections,
  }
}

export function serializeBeatmap(beatmap: Beatmap, options?: SerializeBeatmapOptions): string {
  const lineEnding = options?.lineEnding === 'crlf' ? '\r\n' : '\n'
  const fileFormat = options?.fileFormat ?? beatmap.fileFormat ?? DEFAULT_FILE_FORMAT
  const context = { keyCount: beatmap.difficulty.keyCount }

  const sections: RawSection[] = [
    { name: generalSection.name, lines: [...generalSection.write(beatmap.general, context)] },
    { name: editorSection.name, lines: [...editorSection.write(beatmap.editor, context)] },
    { name: metadataSection.name, lines: [...metadataSection.write(beatmap.metadata, context)] },
    { name: difficultySection.name, lines: [...difficultySection.write(beatmap.difficulty, context)] },
    { name: eventsSection.name, lines: [...eventsSection.write(beatmap.events, context)] },
    { name: timingPointsSection.name, lines: [...timingPointsSection.write(beatmap.controlPoints, context)] },
    { name: coloursSection.name, lines: [...coloursSection.write(beatmap.colours, context)] },
    { name: hitObjectsSection.name, lines: [...hitObjectsSection.write(beatmap.hitObjects, context)] },
    ...(beatmap.extraSections ?? []).map((section) => ({
      name: section.name,
      lines: [...section.lines],
    })),
  ]

  const body = sections.filter(
    (section) => mandatorySectionNames.has(section.name) || section.lines.length > 0,
  )

  const text = BeatmapSectionIo.writeRawSections(body, lineEnding)

  return `osu file format v${fileFormat}${lineEnding}${lineEnding}${text}${lineEnding}`
}

function findLines(sections: readonly RawSection[], name: string): readonly string[] {
  return sections.find((section) => section.name === name)?.lines ?? []
}

export * from './sample-bank'
export * from './timing'

export {
  clampScrollVelocity,
  columnFromX,
  EFFECT_FLAG_KIAI,
  EFFECT_FLAG_OMIT_FIRST_BAR_LINE,
  xFromColumn,
} from './sections'

export type { RawSection } from './section-io'
export type {
  Beatmap,
  BeatmapColours,
  BeatmapDifficulty,
  BeatmapEditorState,
  BeatmapEvents,
  BeatmapFileFormat,
  BeatmapGeneral,
  BeatmapMetadata,
  BackgroundEvent,
  BreakPeriod,
  Colour,
  ControlPoint,
  ControlPointBase,
  Countdown,
  GameMode,
  HitObject,
  OverlayPosition,
  SampleReference,
  ScrollVelocityPoint,
  TimingPoint,
  VideoEvent,
} from './types'
