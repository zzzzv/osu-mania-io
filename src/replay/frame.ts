import { compress, decompress } from 'lzma-js-simple-v2'

import type { ReplayFrame } from './types'

const RANDOM_SEED_MARKER = -12345

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
 */
export function parseFrameData(
  replayData: string,
  keyCount: number,
  strict: boolean,
): { frames: ReplayFrame[]; stableRandomSeed?: number } {
  const frames: ReplayFrame[] = []
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

    const delta = Number(parts[0])

    if (!Number.isFinite(delta)) {
      if (strict) {
        throw new Error(`Invalid replay frame delta: ${parts[0]}`)
      }

      continue
    }

    if (delta === RANDOM_SEED_MARKER) {
      const parsedSeed = Number(parts[3])

      if (Number.isFinite(parsedSeed)) {
        stableRandomSeed = parsedSeed
      } else if (strict) {
        throw new Error(`Invalid replay random seed: ${parts[3]}`)
      }

      continue
    }

    currentTime += delta

    const keyMask = Math.trunc(Number(parts[1]))

    if (!Number.isFinite(keyMask)) {
      if (strict) {
        throw new Error(`Invalid replay frame key mask: ${parts[1]}`)
      }

      continue
    }

    frames.push({
      time: currentTime,
      columns: decodeColumns(keyMask, keyCount),
    })
  }

  return { frames, stableRandomSeed }
}

/**
 * Encodes normalized mania replay frames into the compressed stable replay payload.
 */
export function encodeReplayData(frames: readonly ReplayFrame[], stableRandomSeed?: number): Uint8Array {
  let previousTime = 0
  const serializedFrames: string[] = []

  for (const frame of frames) {
    const delta = Math.trunc(frame.time - previousTime)

    previousTime = frame.time
    serializedFrames.push(`${delta}|${encodeColumns(frame.columns)}|0|0`)
  }

  if (stableRandomSeed !== undefined) {
    serializedFrames.push(`${RANDOM_SEED_MARKER}|0|0|${Math.trunc(stableRandomSeed)}`)
  }

  return Uint8Array.from(compress(`${serializedFrames.join(',')},`))
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