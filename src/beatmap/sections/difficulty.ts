import {
  type KeyValueLine,
  BeatmapSectionIo,
} from '../section-io'

/**
 * Mania difficulty settings that affect lane layout and timing.
 */
export interface BeatmapDifficulty {
  hpDrainRate: number
  keyCount: number
  overallDifficulty: number
  sliderMultiplier: number
  sliderTickRate: number
}

export const difficultySection = BeatmapSectionIo.createKeyValueSection<BeatmapDifficulty>({
  name: 'Difficulty',
  read(pairs) {
    const hpDrainRate = BeatmapSectionIo.readNumber(pairs, 'HPDrainRate')
    const keyCount = BeatmapSectionIo.readNumber(pairs, 'CircleSize')
    const overallDifficulty = BeatmapSectionIo.readNumber(pairs, 'OverallDifficulty')
    const sliderMultiplier = BeatmapSectionIo.readNumber(pairs, 'SliderMultiplier')
    const sliderTickRate = BeatmapSectionIo.readNumber(pairs, 'SliderTickRate')

    if (
      hpDrainRate === undefined
      || keyCount === undefined
      || overallDifficulty === undefined
      || sliderMultiplier === undefined
      || sliderTickRate === undefined
    ) {
      return undefined
    }

    return {
      hpDrainRate,
      keyCount,
      overallDifficulty,
      sliderMultiplier,
      sliderTickRate,
    }
  },
  write(value) {
    const pairs: KeyValueLine[] = []

    BeatmapSectionIo.appendNumber(pairs, 'HPDrainRate', value.hpDrainRate)
    BeatmapSectionIo.appendNumber(pairs, 'CircleSize', value.keyCount)
    BeatmapSectionIo.appendNumber(pairs, 'OverallDifficulty', value.overallDifficulty)
    BeatmapSectionIo.appendNumber(pairs, 'SliderMultiplier', value.sliderMultiplier)
    BeatmapSectionIo.appendNumber(pairs, 'SliderTickRate', value.sliderTickRate)

    return pairs
  },
})