import { BeatmapSectionIo } from './section-io'
import type { RawSection } from './section-io'
import {
  difficultySection,
  editorSection,
  eventsSection,
  generalSection,
  hitObjectsSection,
  metadataSection,
  timingPointsSection,
} from './sections'
import { normalizeHitObjectColumns, denormalizeHitObjectColumns } from './sections/hit-objects'
import type { Beatmap, BeatmapFileFormat } from './types'

const beatmapSectionRegistry = {
  general: generalSection,
  editor: editorSection,
  metadata: metadataSection,
  difficulty: difficultySection,
  events: eventsSection,
  timingPoints: timingPointsSection,
  hitObjects: hitObjectsSection,
}

function findRawSection(sections: readonly RawSection[], name: string): RawSection | undefined {
  return sections.find((section) => section.name === name)
}

export function parseBeatmap(
  input: string,
  options?: {
    strict?: boolean
    includeHitObjects?: boolean
  },
): Beatmap {
  const strict = options?.strict ?? true
  const includeHitObjects = options?.includeHitObjects ?? true
  const rawSections = BeatmapSectionIo.parseRawSections(input)
  const general = beatmapSectionRegistry.general.read(findRawSection(rawSections, 'General')?.lines ?? [])
  const metadata = beatmapSectionRegistry.metadata.read(findRawSection(rawSections, 'Metadata')?.lines ?? [])
  const difficulty = beatmapSectionRegistry.difficulty.read(findRawSection(rawSections, 'Difficulty')?.lines ?? [])
  const events = beatmapSectionRegistry.events.read(findRawSection(rawSections, 'Events')?.lines ?? [])
  const controlPoints = beatmapSectionRegistry.timingPoints.read(findRawSection(rawSections, 'TimingPoints')?.lines ?? [])
  const parsedHitObjects = includeHitObjects
    ? beatmapSectionRegistry.hitObjects.read(findRawSection(rawSections, 'HitObjects')?.lines ?? [])
    : []

  if (!general || !metadata || !difficulty || !controlPoints || (includeHitObjects && !parsedHitObjects)) {
    throw new Error('Beatmap is missing one or more required mania sections.')
  }

  if (strict && difficulty.keyCount <= 0) {
    throw new Error(`Expected a positive mania key count, but received ${difficulty.keyCount}.`)
  }

  const hitObjects = includeHitObjects
    ? normalizeHitObjectColumns(parsedHitObjects ?? [], difficulty.keyCount)
    : []

  return {
    general,
    editor: beatmapSectionRegistry.editor.read(findRawSection(rawSections, 'Editor')?.lines ?? []),
    metadata,
    difficulty,
    events,
    controlPoints,
    breaks: events?.breaks,
    hitObjects,
  }
}

export function serializeBeatmap(
  beatmap: Beatmap,
  options?: {
    fileFormat?: BeatmapFileFormat
    lineEnding?: 'lf' | 'crlf'
  },
): string {
  const lineEnding = options?.lineEnding === 'crlf' ? '\r\n' : '\n'
  const fileFormat = options?.fileFormat ?? 14
  const sections = [
    {
      name: 'osu file format v' + fileFormat,
      lines: [],
    },
    {
      name: beatmapSectionRegistry.general.name,
      lines: [...beatmapSectionRegistry.general.write(beatmap.general)],
    },
    {
      name: beatmapSectionRegistry.editor.name,
      lines: [...beatmapSectionRegistry.editor.write(beatmap.editor)],
    },
    {
      name: beatmapSectionRegistry.metadata.name,
      lines: [...beatmapSectionRegistry.metadata.write(beatmap.metadata)],
    },
    {
      name: beatmapSectionRegistry.difficulty.name,
      lines: [...beatmapSectionRegistry.difficulty.write(beatmap.difficulty)],
    },
    {
      name: beatmapSectionRegistry.events.name,
      lines: [...beatmapSectionRegistry.events.write({
        backgroundFilename: beatmap.events?.backgroundFilename,
        breaks: beatmap.breaks,
      })],
    },
    {
      name: beatmapSectionRegistry.timingPoints.name,
      lines: [...beatmapSectionRegistry.timingPoints.write(beatmap.controlPoints)],
    },
    {
      name: beatmapSectionRegistry.hitObjects.name,
      lines: [...beatmapSectionRegistry.hitObjects.write(denormalizeHitObjectColumns(beatmap.hitObjects, beatmap.difficulty.keyCount))],
    },
  ].filter((section) => section.name.startsWith('osu file format') || section.lines.length > 0)

  const [header, ...rest] = sections

  return [`${header?.name ?? 'osu file format v14'}`, '', BeatmapSectionIo.writeRawSections(rest, lineEnding)].filter(Boolean).join(lineEnding)
}

export type {
  Beatmap,
  BeatmapDifficulty,
  BeatmapEditorState,
  BeatmapFileFormat,
  BeatmapGeneral,
  BeatmapMetadata,
  BreakPeriod,
  ControlPoint,
  Countdown,
  HitObject,
  SampleBank,
  SampleReference,
  ScrollVelocityPoint,
  TimingPoint,
} from './types'