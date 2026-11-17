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
  approachRate: number
  sliderMultiplier: number
  sliderTickRate: number
}

export const difficultySection = BeatmapSectionIo.createKeyValueSection<BeatmapDifficulty>({
  name: 'Difficulty',
  read(pairs, context) {
    const hpDrainRate = BeatmapSectionIo.readNumber(pairs, 'HPDrainRate', context)
    const keyCount = BeatmapSectionIo.readNumber(pairs, 'CircleSize', context)
    const overallDifficulty = BeatmapSectionIo.readNumber(pairs, 'OverallDifficulty', context)
    const sliderMultiplier = BeatmapSectionIo.readNumber(pairs, 'SliderMultiplier', context)
    const sliderTickRate = BeatmapSectionIo.readNumber(pairs, 'SliderTickRate', context)
    const approachRate = BeatmapSectionIo.readNumber(pairs, 'ApproachRate', context)

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
      // osu!mania has no approach rate, so legacy files omit it and imply the OD value.
      approachRate: approachRate ?? overallDifficulty,
      sliderMultiplier,
      sliderTickRate,
    }
  },
  write(value) {
    const pairs: KeyValueLine[] = []

    BeatmapSectionIo.appendNumber(pairs, 'HPDrainRate', value.hpDrainRate)
    BeatmapSectionIo.appendNumber(pairs, 'CircleSize', value.keyCount)
    BeatmapSectionIo.appendNumber(pairs, 'OverallDifficulty', value.overallDifficulty)
    BeatmapSectionIo.appendNumber(pairs, 'ApproachRate', value.approachRate)
    BeatmapSectionIo.appendNumber(pairs, 'SliderMultiplier', value.sliderMultiplier)
    BeatmapSectionIo.appendNumber(pairs, 'SliderTickRate', value.sliderTickRate)

    return pairs
  },
})
