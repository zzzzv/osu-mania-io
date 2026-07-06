import {
  type KeyValueLine,
  BeatmapSectionIo,
} from '../section-io'

/**
 * Metadata commonly required by mania tools and UIs.
 */
export interface BeatmapMetadata {
  title: string
  titleUnicode?: string
  artist: string
  artistUnicode?: string
  creator: string
  version: string
  source?: string
  tags?: readonly string[]
  beatmapId?: number
  beatmapSetId?: number
}

export const metadataSection = BeatmapSectionIo.createKeyValueSection<BeatmapMetadata>({
  name: 'Metadata',
  read(pairs) {
    const title = BeatmapSectionIo.readString(pairs, 'Title')
    const artist = BeatmapSectionIo.readString(pairs, 'Artist')
    const creator = BeatmapSectionIo.readString(pairs, 'Creator')
    const version = BeatmapSectionIo.readString(pairs, 'Version')

    if (!title || !artist || !creator || !version) {
      return undefined
    }

    const tags = BeatmapSectionIo.readString(pairs, 'Tags')

    return {
      title,
      titleUnicode: BeatmapSectionIo.readString(pairs, 'TitleUnicode'),
      artist,
      artistUnicode: BeatmapSectionIo.readString(pairs, 'ArtistUnicode'),
      creator,
      version,
      source: BeatmapSectionIo.readString(pairs, 'Source'),
      tags: tags ? tags.split(/\s+/).filter(Boolean) : undefined,
      beatmapId: BeatmapSectionIo.readNumber(pairs, 'BeatmapID'),
      beatmapSetId: BeatmapSectionIo.readNumber(pairs, 'BeatmapSetID'),
    }
  },
  write(value) {
    const pairs: KeyValueLine[] = []

    BeatmapSectionIo.appendString(pairs, 'Title', value.title)
    BeatmapSectionIo.appendString(pairs, 'TitleUnicode', value.titleUnicode)
    BeatmapSectionIo.appendString(pairs, 'Artist', value.artist)
    BeatmapSectionIo.appendString(pairs, 'ArtistUnicode', value.artistUnicode)
    BeatmapSectionIo.appendString(pairs, 'Creator', value.creator)
    BeatmapSectionIo.appendString(pairs, 'Version', value.version)
    BeatmapSectionIo.appendString(pairs, 'Source', value.source)
    BeatmapSectionIo.appendString(pairs, 'Tags', value.tags?.join(' '))
    BeatmapSectionIo.appendNumber(pairs, 'BeatmapID', value.beatmapId)
    BeatmapSectionIo.appendNumber(pairs, 'BeatmapSetID', value.beatmapSetId)

    return pairs
  },
})