import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import {
  parseBeatmap,
  parseReplay,
  serializeBeatmap,
  serializeReplay,
} from './index'
import type {
  Beatmap,
  ParseBeatmapOptions,
  ParseReplayOptions,
  Replay,
  SerializeBeatmapOptions,
} from './index'

export * from './index'

/**
 * Reads and parses a mania beatmap from a file path.
 */
export function readBeatmapFile(
  filePath: string,
  options?: ParseBeatmapOptions,
): Beatmap {
  return parseBeatmap(readFileSync(filePath, 'utf8'), options)
}

/**
 * Serializes a mania beatmap and writes it to a file path.
 */
export function writeBeatmapFile(
  filePath: string,
  beatmap: Beatmap,
  options?: SerializeBeatmapOptions,
): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, serializeBeatmap(beatmap, options), 'utf8')
}

/**
 * Reads and parses a mania replay from a file path.
 *
 * The key count may be passed directly or taken from a parsed beatmap.
 */
export function readReplayFile(
  filePath: string,
  keyCount: number | Beatmap,
  options?: ParseReplayOptions,
): Replay {
  return parseReplay(new Uint8Array(readFileSync(filePath)), keyCount, options)
}

/**
 * Serializes a mania replay and writes it to a file path.
 */
export function writeReplayFile(filePath: string, replay: Replay): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, serializeReplay(replay))
}
