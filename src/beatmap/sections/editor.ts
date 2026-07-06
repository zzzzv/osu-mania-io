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
}

export const editorSection = BeatmapSectionIo.createKeyValueSection<BeatmapEditorState>({
  name: 'Editor',
  read(pairs) {
    const bookmarks = BeatmapSectionIo.readNumberList(pairs, 'Bookmarks')
    const distanceSpacing = BeatmapSectionIo.readNumber(pairs, 'DistanceSpacing')
    const beatDivisor = BeatmapSectionIo.readNumber(pairs, 'BeatDivisor')
    const gridSize = BeatmapSectionIo.readNumber(pairs, 'GridSize')
    const timelineZoom = BeatmapSectionIo.readNumber(pairs, 'TimelineZoom')

    if (
      bookmarks === undefined
      && distanceSpacing === undefined
      && beatDivisor === undefined
      && gridSize === undefined
      && timelineZoom === undefined
    ) {
      return undefined
    }

    return {
      bookmarks,
      distanceSpacing,
      beatDivisor,
      gridSize,
      timelineZoom,
    }
  },
  write(value) {
    const pairs: KeyValueLine[] = []

    BeatmapSectionIo.appendNumberList(pairs, 'Bookmarks', value.bookmarks)
    BeatmapSectionIo.appendNumber(pairs, 'DistanceSpacing', value.distanceSpacing)
    BeatmapSectionIo.appendNumber(pairs, 'BeatDivisor', value.beatDivisor)
    BeatmapSectionIo.appendNumber(pairs, 'GridSize', value.gridSize)
    BeatmapSectionIo.appendNumber(pairs, 'TimelineZoom', value.timelineZoom)

    return pairs
  },
})