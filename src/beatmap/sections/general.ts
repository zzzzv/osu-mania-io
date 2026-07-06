import {
  type KeyValueLine,
  BeatmapSectionIo,
} from '../section-io'

/**
 * Minimal mania-relevant values from the `[General]` section.
 */
export interface BeatmapGeneral {
  audioFilename: string
  audioLeadIn?: number
  previewTime?: number
  sampleBank?: 'auto' | 'normal' | 'soft' | 'drum'
  countdown?: 0 | 1 | 2 | 3
  specialStyle?: boolean
  countdownOffset?: number
  samplesMatchPlaybackRate?: boolean
}

export const generalSection = BeatmapSectionIo.createKeyValueSection<BeatmapGeneral>({
  name: 'General',
  read(pairs) {
    const audioFilename = BeatmapSectionIo.readString(pairs, 'AudioFilename')

    if (!audioFilename) {
      return undefined
    }

    return {
      audioFilename,
      audioLeadIn: BeatmapSectionIo.readNumber(pairs, 'AudioLeadIn'),
      previewTime: BeatmapSectionIo.readNumber(pairs, 'PreviewTime'),
      sampleBank: BeatmapSectionIo.readString(pairs, 'SampleSet') as BeatmapGeneral['sampleBank'] | undefined,
      countdown: BeatmapSectionIo.readNumber(pairs, 'Countdown') as BeatmapGeneral['countdown'] | undefined,
      specialStyle: BeatmapSectionIo.readBoolean(pairs, 'SpecialStyle'),
      countdownOffset: BeatmapSectionIo.readNumber(pairs, 'CountdownOffset'),
      samplesMatchPlaybackRate: BeatmapSectionIo.readBoolean(pairs, 'SamplesMatchPlaybackRate'),
    }
  },
  write(value) {
    const pairs: KeyValueLine[] = []

    BeatmapSectionIo.appendString(pairs, 'AudioFilename', value.audioFilename)
    BeatmapSectionIo.appendNumber(pairs, 'AudioLeadIn', value.audioLeadIn)
    BeatmapSectionIo.appendNumber(pairs, 'PreviewTime', value.previewTime)
    BeatmapSectionIo.appendString(pairs, 'SampleSet', value.sampleBank)
    BeatmapSectionIo.appendNumber(pairs, 'Countdown', value.countdown)
    BeatmapSectionIo.appendBoolean(pairs, 'SpecialStyle', value.specialStyle)
    BeatmapSectionIo.appendNumber(pairs, 'CountdownOffset', value.countdownOffset)
    BeatmapSectionIo.appendBoolean(pairs, 'SamplesMatchPlaybackRate', value.samplesMatchPlaybackRate)

    return pairs
  },
})