import type { ScrollVelocityPoint, TimingPoint } from './sections/timing-points'
import type { Beatmap } from './types'

/**
 * Beat length assumed when a beatmap has no timing point at all.
 */
const FALLBACK_BEAT_LENGTH = 600

/**
 * A precomputed timing lookup for a control point list.
 *
 * Construct once and reuse it when resolving many timestamps; the free
 * functions below rebuild one per call.
 */
export interface TimingResolver {
  readonly timingPoints: readonly TimingPoint[]
  readonly scrollVelocityPoints: readonly ScrollVelocityPoint[]

  /**
   * The last timing point at or before `time`.
   */
  timingPointAt(time: number): TimingPoint | undefined

  /**
   * The last scroll velocity point at or before `time`.
   */
  scrollVelocityPointAt(time: number): ScrollVelocityPoint | undefined

  /**
   * The beat length in milliseconds in effect at `time`.
   */
  beatLengthAt(time: number): number

  /**
   * The BPM in effect at `time`.
   */
  bpmAt(time: number): number

  /**
   * The scroll velocity multiplier in effect at `time`, defaulting to 1.
   */
  scrollVelocityAt(time: number): number
}

/**
 * Builds a timing lookup from a control point list.
 */
export function createTimingResolver(
  controlPoints: readonly (TimingPoint | ScrollVelocityPoint)[],
): TimingResolver {
  const timingPoints = controlPoints
    .filter((point): point is TimingPoint => point.kind === 'timing')
    .sort((left, right) => left.time - right.time)
  const scrollVelocityPoints = controlPoints
    .filter((point): point is ScrollVelocityPoint => point.kind === 'scroll-velocity')
    .sort((left, right) => left.time - right.time)

  const beatLengthAt = (time: number): number => (
    lastAtOrBefore(timingPoints, time)?.beatLength ?? timingPoints[0]?.beatLength ?? FALLBACK_BEAT_LENGTH
  )

  return {
    timingPoints,
    scrollVelocityPoints,
    timingPointAt: (time) => lastAtOrBefore(timingPoints, time),
    scrollVelocityPointAt: (time) => lastAtOrBefore(scrollVelocityPoints, time),
    beatLengthAt,
    bpmAt(time) {
      const beatLength = beatLengthAt(time)

      return beatLength > 0 ? 60000 / beatLength : 0
    },
    scrollVelocityAt: (time) => lastAtOrBefore(scrollVelocityPoints, time)?.multiplier ?? 1,
  }
}

/**
 * Resolves the beat length in effect at `time`.
 *
 * Use {@link createTimingResolver} when resolving many timestamps.
 */
export function getBeatLengthAt(beatmap: Beatmap, time: number): number {
  return createTimingResolver(beatmap.controlPoints).beatLengthAt(time)
}

/**
 * Resolves the BPM in effect at `time`.
 */
export function getBpmAt(beatmap: Beatmap, time: number): number {
  return createTimingResolver(beatmap.controlPoints).bpmAt(time)
}

/**
 * Resolves the scroll velocity multiplier in effect at `time`.
 */
export function getScrollVelocityAt(beatmap: Beatmap, time: number): number {
  return createTimingResolver(beatmap.controlPoints).scrollVelocityAt(time)
}

/**
 * Resolves the beat length that stays in effect for the longest time.
 *
 * This is an approximation of osu!lazer's "most common beat length" helper: it
 * weights the raw control point spans instead of sampling the playable range,
 * which is sufficient for scroll speed compensation.
 */
export function getMostCommonBeatLength(beatmap: Beatmap, endTime?: number): number {
  const timingPoints = createTimingResolver(beatmap.controlPoints).timingPoints

  if (timingPoints.length === 0) {
    return FALLBACK_BEAT_LENGTH
  }

  const lastTime = endTime ?? getLastObjectTime(beatmap) ?? timingPoints[timingPoints.length - 1]!.time

  let mostCommon = timingPoints[0]!.beatLength
  let longestDuration = -1

  timingPoints.forEach((point, index) => {
    const spanEnd = Math.min(timingPoints[index + 1]?.time ?? Number.POSITIVE_INFINITY, lastTime)
    const duration = Math.max(0, spanEnd - point.time)

    if (duration > longestDuration) {
      longestDuration = duration
      mostCommon = point.beatLength
    }
  })

  return mostCommon
}

/**
 * The end time of the last hit object, or `undefined` for an empty beatmap.
 */
export function getLastObjectTime(beatmap: Beatmap): number | undefined {
  let lastTime: number | undefined

  for (const hitObject of beatmap.hitObjects) {
    const endTime = hitObject.endTime ?? hitObject.startTime

    if (lastTime === undefined || endTime > lastTime) {
      lastTime = endTime
    }
  }

  return lastTime
}

function lastAtOrBefore<TPoint extends { time: number }>(
  points: readonly TPoint[],
  time: number,
): TPoint | undefined {
  let low = 0
  let high = points.length - 1
  let found: TPoint | undefined

  while (low <= high) {
    const middle = (low + high) >> 1
    const point = points[middle]!

    if (point.time <= time) {
      found = point
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return found
}
