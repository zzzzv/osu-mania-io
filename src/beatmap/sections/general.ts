import {
  type KeyValueLine,
  BeatmapSectionIo,
} from '../section-io'
import {
  type SampleBank,
  sampleBankFromName,
  sampleBankToName,
} from '../sample-bank'

/**
 * Rulesets as encoded by the `Mode` key.
 */
export type GameMode = 0 | 1 | 2 | 3

/**
 * osu!mania mode identifier used by the `Mode` key.
 */
export const MANIA_GAME_MODE: GameMode = 3

/**
 * Stacking/overlay ordering as encoded by `OverlayPosition`.
 */
export type OverlayPosition = 'no-change' | 'below' | 'above'

const overlayPositions: readonly OverlayPosition[] = ['no-change', 'below', 'above']
const overlayPositionNames = ['NoChange', 'Below', 'Above'] as const

/**
 * The mania-relevant values from the `[General]` section.
 *
 * Every documented key is modelled so that serialization stays lossless. Keys
 * that are absent in the source file fall back to the defaults defined by the
 * official `.osu` file format.
 */
export interface BeatmapGeneral {
  audioFilename: string
  audioLeadIn: number
  previewTime: number
  countdown: 0 | 1 | 2 | 3
  sampleBank: SampleBank
  stackLeniency: number
  mode: GameMode
  letterboxInBreaks: boolean
  useSkinSprites: boolean
  overlayPosition: OverlayPosition
  skinPreference?: string
  epilepsyWarning: boolean
  countdownOffset: number
  specialStyle: boolean
  widescreenStoryboard: boolean
  samplesMatchPlaybackRate: boolean
}

export const generalSection = BeatmapSectionIo.createKeyValueSection<BeatmapGeneral>({
  name: 'General',
  read(pairs, context) {
    return {
      audioFilename: BeatmapSectionIo.readString(pairs, 'AudioFilename') ?? 'audio.mp3',
      audioLeadIn: BeatmapSectionIo.readNumber(pairs, 'AudioLeadIn', context) ?? 0,
      previewTime: BeatmapSectionIo.readNumber(pairs, 'PreviewTime', context) ?? -1,
      countdown: readCountdown(BeatmapSectionIo.readNumber(pairs, 'Countdown', context)),
      sampleBank: sampleBankFromName(BeatmapSectionIo.readString(pairs, 'SampleSet')),
      stackLeniency: BeatmapSectionIo.readNumber(pairs, 'StackLeniency', context) ?? 0.7,
      mode: readGameMode(BeatmapSectionIo.readNumber(pairs, 'Mode', context)),
      letterboxInBreaks: BeatmapSectionIo.readBoolean(pairs, 'LetterboxInBreaks') ?? false,
      useSkinSprites: BeatmapSectionIo.readBoolean(pairs, 'UseSkinSprites') ?? false,
      overlayPosition: readOverlayPosition(BeatmapSectionIo.readString(pairs, 'OverlayPosition')),
      skinPreference: BeatmapSectionIo.readString(pairs, 'SkinPreference'),
      epilepsyWarning: BeatmapSectionIo.readBoolean(pairs, 'EpilepsyWarning') ?? false,
      countdownOffset: BeatmapSectionIo.readNumber(pairs, 'CountdownOffset', context) ?? 0,
      specialStyle: BeatmapSectionIo.readBoolean(pairs, 'SpecialStyle') ?? false,
      widescreenStoryboard: BeatmapSectionIo.readBoolean(pairs, 'WidescreenStoryboard') ?? false,
      samplesMatchPlaybackRate: BeatmapSectionIo.readBoolean(pairs, 'SamplesMatchPlaybackRate') ?? false,
    }
  },
  write(value) {
    const pairs: KeyValueLine[] = []

    BeatmapSectionIo.appendString(pairs, 'AudioFilename', value.audioFilename)
    BeatmapSectionIo.appendNumber(pairs, 'AudioLeadIn', value.audioLeadIn)
    BeatmapSectionIo.appendNumber(pairs, 'PreviewTime', value.previewTime)
    BeatmapSectionIo.appendNumber(pairs, 'Countdown', value.countdown)
    BeatmapSectionIo.appendString(pairs, 'SampleSet', sampleBankToName(value.sampleBank))
    BeatmapSectionIo.appendNumber(pairs, 'StackLeniency', value.stackLeniency)
    BeatmapSectionIo.appendNumber(pairs, 'Mode', value.mode)
    BeatmapSectionIo.appendBoolean(pairs, 'LetterboxInBreaks', value.letterboxInBreaks)
    BeatmapSectionIo.appendBoolean(pairs, 'UseSkinSprites', value.useSkinSprites)
    BeatmapSectionIo.appendString(pairs, 'OverlayPosition', overlayPositionNames[overlayPositions.indexOf(value.overlayPosition)])
    BeatmapSectionIo.appendString(pairs, 'SkinPreference', value.skinPreference)
    BeatmapSectionIo.appendBoolean(pairs, 'EpilepsyWarning', value.epilepsyWarning)
    BeatmapSectionIo.appendNumber(pairs, 'CountdownOffset', value.countdownOffset)
    BeatmapSectionIo.appendBoolean(pairs, 'SpecialStyle', value.specialStyle)
    BeatmapSectionIo.appendBoolean(pairs, 'WidescreenStoryboard', value.widescreenStoryboard)
    BeatmapSectionIo.appendBoolean(pairs, 'SamplesMatchPlaybackRate', value.samplesMatchPlaybackRate)

    return pairs
  },
})

function readGameMode(value: number | undefined): GameMode {
  return value === 1 || value === 2 || value === 3 ? value : 0
}

function readCountdown(value: number | undefined): 0 | 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3 ? value : 0
}

function readOverlayPosition(value: string | undefined): OverlayPosition {
  const normalized = value?.trim().toLowerCase()

  if (normalized === 'below' || normalized === 'above') {
    return normalized
  }

  return 'no-change'
}
