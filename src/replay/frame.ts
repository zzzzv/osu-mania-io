import { compress, decompress } from 'lzma-js-simple-v2'

import type { ReplayFrame } from './types'

/**
 * Marker frame osu!stable uses to store the mania random mod seed.
 */
const RANDOM_SEED_MARKER = -12345

/**
 * The `y` position osu!stable uses for its skip boundary pseudo frames.
 */
const SKIP_FRAME_MARKER_Y = -500

/**
 * The `x` position osu!stable uses for its skip boundary pseudo frames.
 */
const SKIP_FRAME_MARKER_X = 256

interface ParsedFrame {
  time: number
  keyMask: number
  y: number
}

/**
 * Decodes the compressed stable replay frame payload into text.
 */
export function decodeReplayData(compressedReplayData: Uint8Array): string {
  const decompressed = decompress(compressedReplayData)

  return typeof decompressed === 'string'
    ? decompressed
    : new TextDecoder().decode(Uint8Array.from(decompressed))
}

/**
 * Parses stable replay frame text into normalized mania replay frames.
 *
 * Mirrors osu!lazer's `LegacyScoreDecoder`, including its fixes for the
 * pseudo frames and out-of-order timestamps osu!stable writes.
 */
export function parseFrameData(
  replayData: string,
  keyCount: number,
  strict: boolean,
): { frames: ReplayFrame[]; stableRandomSeed?: number } {
  const parsedFrames: ParsedFrame[] = []
  let stableRandomSeed: number | undefined
  let currentTime = 0

  for (const rawFrame of replayData.split(',')) {
    if (rawFrame.length === 0) {
      continue
    }

    const parts = rawFrame.split('|')

    if (parts.length < 4) {
      if (strict) {
        throw new Error(`Malformed replay frame: ${rawFrame}`)
      }

      continue
    }

    if (Number(parts[0]) === RANDOM_SEED_MARKER) {
      const parsedSeed = Number(parts[3])

      if (Number.isFinite(parsedSeed)) {
        stableRandomSeed = parsedSeed
      } else if (strict) {
        throw new Error(`Invalid replay random seed: ${parts[3]}`)
      }

      continue
    }

    const delta = parseNumber(parts[0], 'replay frame delta', strict)

    if (delta === undefined) {
      continue
    }

    const keyMask = parseNumber(parts[1], 'replay frame key mask', strict)

    if (keyMask === undefined) {
      continue
    }

    currentTime += delta

    parsedFrames.push({
      time: currentTime,
      keyMask: Math.trunc(keyMask),
      y: parseNumber(parts[2], 'replay frame y', false) ?? 0,
    })
  }

  applyLegacyFrameFixes(parsedFrames)

  const frames: ReplayFrame[] = []
  let previousTime = Number.NEGATIVE_INFINITY

  for (const frame of parsedFrames) {
    // osu!stable occasionally writes frames whose timestamps move backwards.
    if (frame.time < previousTime) {
      continue
    }

    previousTime = frame.time

    frames.push({
      time: frame.time,
      columns: decodeColumns(frame.keyMask, keyCount),
    })
  }

  return { frames, stableRandomSeed }
}

/**
 * Encodes normalized mania replay frames into the compressed stable replay payload.
 */
export function encodeReplayData(frames: readonly ReplayFrame[], stableRandomSeed?: number): Uint8Array {
  // The legacy format stores deltas against the previous frame, starting at 0.
  // A negative first delta is valid and occurs when a replay starts before the
  // first object (osu!lazer writes these).
  let previousTime: number | undefined
  const serializedFrames: string[] = []

  for (const frame of frames) {
    const time = Math.trunc(frame.time)

    if (previousTime !== undefined && time < previousTime) {
      throw new Error(`Replay frames must be ordered by time, but ${time} follows ${previousTime}.`)
    }

    const delta = time - (previousTime ?? 0)

    previousTime = time
    serializedFrames.push(`${delta}|${encodeColumns(frame.columns)}|0|0`)
  }

  if (stableRandomSeed !== undefined) {
    serializedFrames.push(`${RANDOM_SEED_MARKER}|0|0|${Math.trunc(stableRandomSeed)}`)
  }

  const payload = serializedFrames.length === 0 ? '' : `${serializedFrames.join(',')},`

  return Uint8Array.from(compress(payload))
}

/**
 * Applies the same legacy replay fixes osu!lazer performs after reading frames.
 */
function applyLegacyFrameFixes(frames: ParsedFrame[]): void {
  // https://github.com/peppy/osu-stable-reference ReplayWatcher.cs
  if (frames.length >= 2 && frames[1]!.time < frames[0]!.time) {
    frames[1]!.time = frames[0]!.time
    frames[0]!.time = 0
  }

  if (frames.length >= 3 && frames[0]!.time > frames[2]!.time) {
    const time = frames[1]!.time

    frames[0]!.time = time
    frames[1]!.time = time
    frames[2]!.time = time
  }

  // osu!stable places two pseudo frames at the start of a replay, at time 0 and
  // SkipBoundary - 1, both using the position (256, -500).
  if (frames.length >= 2 && isSkipFrame(frames[1]!)) {
    frames.splice(1, 1)
  }

  if (frames.length >= 1 && isSkipFrame(frames[0]!)) {
    frames.splice(0, 1)
  }
}

function isSkipFrame(frame: ParsedFrame): boolean {
  return frame.keyMask === SKIP_FRAME_MARKER_X && frame.y === SKIP_FRAME_MARKER_Y
}

function parseNumber(raw: string | undefined, label: string, strict: boolean): number | undefined {
  const parsed = Number(raw)

  if (Number.isFinite(parsed)) {
    return parsed
  }

  if (strict) {
    throw new Error(`Expected a numeric ${label}, but received "${raw}".`)
  }

  return undefined
}

function decodeColumns(keyMask: number, keyCount: number): boolean[] {
  const columns = new Array<boolean>(keyCount)

  // osu!mania legacy replay data stores Key1 in the least-significant bit and
  // then increments upward one bit per lane.
  for (let index = 0; index < keyCount; index += 1) {
    columns[index] = (keyMask & (1 << index)) !== 0
  }

  return columns
}

function encodeColumns(columns: readonly boolean[]): number {
  let keyMask = 0

  for (let index = 0; index < columns.length; index += 1) {
    if (columns[index]) {
      keyMask |= 1 << index
    }
  }

  return keyMask
}
