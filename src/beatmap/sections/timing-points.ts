import type { BeatmapSection } from '../section-io'

/**
 * Supported sample bank names used by beatmap timing points and hit samples.
 */
export type SampleBank = 'auto' | 'normal' | 'soft' | 'drum'

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
}

/**
 * A mania control point supported by the public model.
 */
export type ControlPoint = TimingPoint | ScrollVelocityPoint

const sampleBanks = ['auto', 'normal', 'soft', 'drum'] as const

export const timingPointsSection: BeatmapSection<readonly ControlPoint[]> = {
  name: 'TimingPoints',
  read(lines) {
    const points: ControlPoint[] = []

    for (const line of lines) {
      const parts = line.split(',').map((part) => part.trim())

      if (parts.length < 8) {
        continue
      }

      const time = Number(parts[0])
      const beatLength = Number(parts[1])
      const meter = Number(parts[2])
      const sampleSetIndex = Number(parts[3])
      const sampleIndex = Number(parts[4])
      const volume = Number(parts[5])
      const uninherited = Number(parts[6])
      const effectFlags = Number(parts[7])

      const base = {
        time,
        sampleBank: sampleBanks[sampleSetIndex] as SampleBank | undefined,
        sampleIndex: Number.isFinite(sampleIndex) ? sampleIndex : undefined,
        volume: Number.isFinite(volume) ? volume : undefined,
        effectFlags: Number.isFinite(effectFlags) ? effectFlags : undefined,
      }

      if (uninherited === 1) {
        points.push({
          ...base,
          kind: 'timing',
          beatLength,
          meter,
        })
      } else {
        points.push({
          ...base,
          kind: 'scroll-velocity',
          multiplier: beatLength === 0 ? 1 : -100 / beatLength,
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
      const sampleSet = point.sampleBank ? sampleBanks.indexOf(point.sampleBank) : 0

      if (point.kind === 'timing') {
        return [
          point.time,
          point.beatLength,
          point.meter,
          Math.max(sampleSet, 0),
          point.sampleIndex ?? 0,
          point.volume ?? 0,
          1,
          point.effectFlags ?? 0,
        ].join(',')
      }

      return [
        point.time,
        point.multiplier === 0 ? -100 : -100 / point.multiplier,
        4,
        Math.max(sampleSet, 0),
        point.sampleIndex ?? 0,
        point.volume ?? 0,
        0,
        point.effectFlags ?? 0,
      ].join(',')
    })
  },
}