import {
  type KeyValueLine,
  BeatmapSectionIo,
} from '../section-io'

/**
 * Shared editor settings preserved across all rulesets.
 */
export interface BeatmapEditorState {
  bookmarks?: readonly number[]
  distanceSpacing?: number
  beatDivisor?: number
  gridSize?: number
  timelineZoom?: number
  /**
   * Editor velocity presets.
   *
   * This key is written by osu!lazer and is not part of the documented format.
   */
  velocityPresets?: readonly number[]
}

export const editorSection = BeatmapSectionIo.createKeyValueSection<BeatmapEditorState>({
  name: 'Editor',
  read(pairs, context) {
    const bookmarks = BeatmapSectionIo.readNumberList(pairs, 'Bookmarks', context)
    const distanceSpacing = BeatmapSectionIo.readNumber(pairs, 'DistanceSpacing', context)
    const beatDivisor = BeatmapSectionIo.readNumber(pairs, 'BeatDivisor', context)
    const gridSize = BeatmapSectionIo.readNumber(pairs, 'GridSize', context)
    const timelineZoom = BeatmapSectionIo.readNumber(pairs, 'TimelineZoom', context)
    const velocityPresets = BeatmapSectionIo.readNumberList(pairs, 'VelocityPresets', context)

    if (
      bookmarks === undefined
      && distanceSpacing === undefined
      && beatDivisor === undefined
      && gridSize === undefined
      && timelineZoom === undefined
      && velocityPresets === undefined
    ) {
      return undefined
    }

    return {
      bookmarks,
      distanceSpacing,
      beatDivisor,
      gridSize,
      timelineZoom,
      velocityPresets,
    }
  },
  write(value) {
    const pairs: KeyValueLine[] = []

    BeatmapSectionIo.appendNumberList(pairs, 'Bookmarks', value.bookmarks)
    BeatmapSectionIo.appendNumber(pairs, 'DistanceSpacing', value.distanceSpacing)
    BeatmapSectionIo.appendNumber(pairs, 'BeatDivisor', value.beatDivisor)
    BeatmapSectionIo.appendNumber(pairs, 'GridSize', value.gridSize)
    BeatmapSectionIo.appendNumber(pairs, 'TimelineZoom', value.timelineZoom)
    BeatmapSectionIo.appendNumberList(pairs, 'VelocityPresets', value.velocityPresets)

    return pairs
  },
})
