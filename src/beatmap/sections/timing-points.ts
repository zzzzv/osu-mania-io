import {
  type BeatmapSection,
  BeatmapSectionIo,
} from '../section-io'
import {
  type SampleBank,
  sampleBankFromIndex,
  sampleBankToIndex,
} from '../sample-bank'

/**
 * `effects` flag marking a kiai time section.
 */
export const EFFECT_FLAG_KIAI = 1

/**
 * `effects` flag marking the first barline as omitted.
 */
export const EFFECT_FLAG_OMIT_FIRST_BAR_LINE = 8

/**
 * Scroll velocity bounds applied by osu! when reading difficulty control points.
 */
const MIN_SCROLL_VELOCITY = 0.1
const MAX_SCROLL_VELOCITY = 10

/**
 * Base properties shared by all mania control points.
 */
export interface ControlPointBase {
  time: number
  sampleBank?: SampleBank
  sampleIndex?: number
  volume?: number
  effectFlags?: number
}

/**
 * A timing control point that defines BPM and meter.
 */
export interface TimingPoint extends ControlPointBase {
  kind: 'timing'
  beatLength: number
  meter: number
}

/**
 * An inherited control point that defines scroll velocity.
 */
export interface ScrollVelocityPoint extends ControlPointBase {
  kind: 'scroll-velocity'
  multiplier: number
  meter?: number
}

/**
 * A mania control point supported by the public model.
 */
export type ControlPoint = TimingPoint | ScrollVelocityPoint

/**
 * Clamps a scroll velocity multiplier to the range osu! accepts.
 */
export function clampScrollVelocity(multiplier: number): number {
  return Math.min(Math.max(multiplier, MIN_SCROLL_VELOCITY), MAX_SCROLL_VELOCITY)
}

export const timingPointsSection: BeatmapSection<readonly ControlPoint[]> = {
  name: 'TimingPoints',
  read(lines, context) {
    const points: ControlPoint[] = []

    for (const line of lines) {
      const parts = BeatmapSectionIo.splitList(line)

      if (parts.length < 2) {
        if (context.strict) {
          throw new Error(`Malformed timing point: ${line}`)
        }

        continue
      }

      const time = BeatmapSectionIo.parseNumber(parts[0] ?? '', 'timing point time', context.strict)
      const beatLength = BeatmapSectionIo.parseNumber(parts[1] ?? '', 'timing point beat length', context.strict)

      if (time === undefined || beatLength === undefined) {
        continue
      }

      const meter = BeatmapSectionIo.parseNumber(parts[2] ?? '4', 'timing point meter', context.strict)
      const sampleSetIndex = BeatmapSectionIo.parseNumber(parts[3] ?? '0', 'timing point sample set', context.strict)
      const sampleIndex = BeatmapSectionIo.parseNumber(parts[4] ?? '0', 'timing point sample index', context.strict)
      const volume = BeatmapSectionIo.parseNumber(parts[5] ?? '0', 'timing point volume', context.strict)
      const uninherited = BeatmapSectionIo.parseNumber(parts[6] ?? '1', 'timing point uninherited flag', context.strict)
      const effectFlags = BeatmapSectionIo.parseNumber(parts[7] ?? '0', 'timing point effects', context.strict)

      const base = {
        time,
        sampleBank: sampleBankFromIndex(sampleSetIndex ?? 0),
        sampleIndex,
        volume,
        effectFlags,
      }

      if (uninherited !== 0) {
        points.push({
          ...base,
          kind: 'timing',
          beatLength,
          meter: meter ?? 4,
        })
      } else {
        points.push({
          ...base,
          kind: 'scroll-velocity',
          multiplier: clampScrollVelocity(beatLength === 0 ? 1 : -100 / beatLength),
          meter,
        })
      }
    }

    return points.length === 0 ? undefined : points
  },
  write(value) {
    if (!value || value.length === 0) {
      return []
    }

    return value.map((point) => {
      const sampleSet = sampleBankToIndex(point.sampleBank)

      if (point.kind === 'timing') {
        return [
          point.time,
          point.beatLength,
          point.meter,
          sampleSet,
          point.sampleIndex ?? 0,
          point.volume ?? 0,
          1,
          point.effectFlags ?? 0,
        ].join(',')
      }

      return [
        point.time,
        -100 / clampScrollVelocity(point.multiplier),
        point.meter ?? 4,
        sampleSet,
        point.sampleIndex ?? 0,
        point.volume ?? 0,
        0,
        point.effectFlags ?? 0,
      ].join(',')
    })
  },
}
