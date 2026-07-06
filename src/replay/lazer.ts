import { BinaryReader } from 'osu-binary'
import { compress, decompress } from 'lzma-js-simple-v2'

import { parseLazerMod, serializeLazerMod } from '../mod'
import type { LazerReplayData, ReplayStatistics } from './types'

/**
 * Parses the fixed lazer `LegacyReplaySoloScoreInfo` JSON payload appended to legacy `.osr` files.
 */
export function parseLazerReplayData(rawText: string): LazerReplayData {
  const raw: Record<string, unknown> = JSON.parse(rawText)
  const mods = Array.isArray(raw.mods)
    ? raw.mods
        .map((mod) => parseLazerMod(mod))
        .filter((mod) => mod !== undefined)
    : []

  return {
    onlineId: typeof raw.online_id === 'number' ? raw.online_id : -1,
    mods,
    statistics: parseStatisticsRecord(raw.statistics as Record<string, unknown> | undefined),
    maximumStatistics: parseStatisticsRecord(raw.maximum_statistics as Record<string, unknown> | undefined),
    clientVersion: typeof raw.client_version === 'string' ? raw.client_version : '',
    rank: typeof raw.rank === 'string' ? raw.rank : undefined,
    userId: typeof raw.user_id === 'number' ? raw.user_id : -1,
    totalScoreWithoutMods: typeof raw.total_score_without_mods === 'number' ? raw.total_score_without_mods : undefined,
    pauses: Array.isArray(raw.pauses) ? raw.pauses.filter((value): value is number => typeof value === 'number') : [],
  }
}

/**
 * Serializes typed lazer replay data into the fixed `LegacyReplaySoloScoreInfo` payload shape.
 */
export function serializeLazerReplayData(data: LazerReplayData): string {
  const payload: Record<string, unknown> = {}

  payload.online_id = data.onlineId

  payload.mods = data.mods.map((mod) => serializeLazerMod(mod))

  payload.statistics = serializeStatisticsRecord(data.statistics)

  payload.maximum_statistics = serializeStatisticsRecord(data.maximumStatistics)

  payload.client_version = data.clientVersion

  if (typeof data.rank === 'string') {
    payload.rank = data.rank
  }

  payload.user_id = data.userId

  if (typeof data.totalScoreWithoutMods === 'number') {
    payload.total_score_without_mods = data.totalScoreWithoutMods
  }

  payload.pauses = [...data.pauses]

  return JSON.stringify(payload)
}

/**
 * Parses the optional lazer score payload appended to a legacy replay.
 */
export function parseTrailingLazerData(reader: BinaryReader): LazerReplayData | undefined {
  if (reader.remaining < 4) {
    return undefined
  }

  const compressedPayloadLength = reader.readInt32()

  if (compressedPayloadLength <= 0) {
    return undefined
  }

  if (compressedPayloadLength > reader.remaining) {
    throw new Error(
      `Invalid trailing lazer payload length: ${compressedPayloadLength} exceeds ${reader.remaining} remaining bytes.`,
    )
  }

  const compressedPayload = reader.readBytes(compressedPayloadLength)
  const decompressed = decompress(compressedPayload)
  const rawText = typeof decompressed === 'string'
    ? decompressed
    : new TextDecoder().decode(Uint8Array.from(decompressed))

  try {
    return parseLazerReplayData(rawText)
  } catch {
    return {
      onlineId: -1,
      mods: [],
      statistics: [0, 0, 0, 0, 0, 0],
      maximumStatistics: [0, 0, 0, 0, 0, 0],
      clientVersion: '',
      userId: -1,
      pauses: [],
    }
  }
}

/**
 * Serializes the lazer score payload to its compressed replay representation.
 */
export function encodeLazerPayload(data: LazerReplayData): Uint8Array {
  return Uint8Array.from(compress(serializeLazerReplayData(data)))
}

function parseStatisticsRecord(record: Record<string, unknown> | undefined): ReplayStatistics {
  return [
    readStatistic(record, 'perfect'),
    readStatistic(record, 'great'),
    readStatistic(record, 'good'),
    readStatistic(record, 'ok'),
    readStatistic(record, 'meh'),
    readStatistic(record, 'miss'),
  ]
}

function serializeStatisticsRecord(statistics: ReplayStatistics): Record<string, number> {
  const [max, great, good, ok, meh, miss] = statistics

  return filterZeroCounts({
    perfect: max,
    great: great,
    good: good,
    ok: ok,
    meh: meh,
    miss: miss,
  })
}

function readStatistic(record: Record<string, unknown> | undefined, key: string): number {
  const value = record?.[key]

  return typeof value === 'number' ? value : 0
}

function filterZeroCounts(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== 0),
  )
}