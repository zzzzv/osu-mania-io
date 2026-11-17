import { BinaryReader, BinaryWriter } from 'osu-binary'

import type { Beatmap } from '../beatmap'
import {
  dateToTicks,
  LAZER_SCORE_INFO_MIN_VERSION,
  LEGACY_ONLINE_ID_INT32_VERSION,
  LEGACY_ONLINE_ID_INT64_VERSION,
  MANIA_RULESET_ID,
  ticksToDate,
} from './utils'
import {
  decodeReplayData,
  encodeReplayData,
  parseFrameData,
} from './frame'
import {
  encodeLazerPayload,
  parseTrailingLazerData,
} from './lazer'
import type { Replay, ReplayBinaryInput, ReplayFrame } from './types'

export type {
  LazerReplayData,
  Replay,
  ReplayBinaryInput,
  ReplayFrame,
  ReplayStatistics,
} from './types'

export interface ParseReplayOptions {
  /**
   * Whether to decompress and parse replay frames. Defaults to `true`.
   */
  includeFrames?: boolean

  /**
   * Whether malformed frames and values raise. Defaults to `true`.
   */
  strict?: boolean
}

/**
 * Parses a mania replay from binary `.osr` data.
 *
 * The key count may be passed directly or taken from a parsed beatmap.
 */
export function parseReplay(
  input: ReplayBinaryInput,
  keyCount: number | Beatmap,
  options?: ParseReplayOptions,
): Replay {
  const resolvedKeyCount = typeof keyCount === 'number' ? keyCount : keyCount.difficulty.keyCount
  const includeFrames = options?.includeFrames ?? true
  const strict = options?.strict ?? true

  if (!Number.isInteger(resolvedKeyCount) || resolvedKeyCount <= 0) {
    throw new Error(`Expected a positive integer key count, but received ${resolvedKeyCount}.`)
  }

  const reader = new BinaryReader(input)
  const rulesetId = reader.readByte()

  if (rulesetId !== MANIA_RULESET_ID) {
    throw new Error(`Expected an osu!mania replay, but received ruleset ${rulesetId}.`)
  }

  const gameVersion = reader.readInt32()
  const beatmapHash = reader.readString() ?? ''
  const username = reader.readString() ?? ''
  const replayHash = reader.readString() ?? ''
  const great = reader.readUInt16()
  const ok = reader.readUInt16()
  const meh = reader.readUInt16()
  const max = reader.readUInt16()
  const good = reader.readUInt16()
  const miss = reader.readUInt16()
  const totalScore = reader.readInt32()
  const maxCombo = reader.readUInt16()
  const perfectCombo = reader.readBoolean()
  const mods = reader.readInt32()
  const healthGraph = reader.readString() ?? ''

  const playedAt = ticksToDate(reader.readInt64())

  const compressedReplayDataLength = reader.readInt32()

  if (compressedReplayDataLength < 0 || compressedReplayDataLength > reader.remaining) {
    throw new Error(
      `Invalid replay data length: ${compressedReplayDataLength} with ${reader.remaining} bytes remaining.`,
    )
  }

  const compressedReplayData = compressedReplayDataLength === 0
    ? new Uint8Array()
    : reader.readBytes(compressedReplayDataLength)

  // osu!stable tolerates scores without replay data; only decompress when present.
  const { frames, stableRandomSeed } = includeFrames && compressedReplayData.byteLength > 0
    ? parseFrameData(decodeReplayData(compressedReplayData), resolvedKeyCount, strict)
    : { frames: [] as ReplayFrame[], stableRandomSeed: undefined }

  const onlineScoreId = readLegacyOnlineId(reader, gameVersion)
  const lazer = gameVersion >= LAZER_SCORE_INFO_MIN_VERSION
    ? parseTrailingLazerData(reader)
    : undefined

  return {
    gameVersion,
    beatmapHash,
    username,
    replayHash,
    mods,
    statistics: [max, great, good, ok, meh, miss],
    totalScore,
    maxCombo,
    perfectCombo: perfectCombo || undefined,
    playedAt,
    frames,
    healthGraph: healthGraph.length === 0 ? undefined : healthGraph,
    onlineScoreId: onlineScoreId > 0n ? onlineScoreId : undefined,
    stableRandomSeed,
    lazer,
  }
}

/**
 * Serializes a normalized mania replay into binary `.osr` data.
 *
 * Serialization is schema-oriented: fields this library does not model, such as
 * the per-frame `x`/`y` coordinates, are normalized rather than preserved.
 */
export function serializeReplay(replay: Replay): Uint8Array {
  const writer = new BinaryWriter()
  const [max, great, good, ok, meh, miss] = replay.statistics

  writer.writeByte(MANIA_RULESET_ID)
  writer.writeInt32(replay.gameVersion)
  writer.writeString(replay.beatmapHash)
  writer.writeString(replay.username)
  writer.writeString(replay.replayHash)
  writer.writeUInt16(great)
  writer.writeUInt16(ok)
  writer.writeUInt16(meh)
  writer.writeUInt16(max)
  writer.writeUInt16(good)
  writer.writeUInt16(miss)
  writer.writeInt32(replay.totalScore)
  writer.writeUInt16(replay.maxCombo)
  writer.writeBoolean(replay.perfectCombo ?? false)
  writer.writeInt32(replay.mods)
  writer.writeString(replay.healthGraph ?? '')
  writer.writeInt64(dateToTicks(replay.playedAt))

  const compressedReplayData = encodeReplayData(replay.frames, replay.stableRandomSeed)

  writer.writeInt32(compressedReplayData.byteLength)
  writer.writeBytes(compressedReplayData)
  writeLegacyOnlineId(writer, replay.gameVersion, replay.onlineScoreId ?? 0n)

  if (replay.lazer) {
    if (replay.gameVersion < LAZER_SCORE_INFO_MIN_VERSION) {
      throw new Error(
        `Lazer score data requires gameVersion >= ${LAZER_SCORE_INFO_MIN_VERSION}, but this replay uses ${replay.gameVersion}.`,
      )
    }

    const compressedLazerData = encodeLazerPayload(replay.lazer)

    writer.writeInt32(compressedLazerData.byteLength)
    writer.writeBytes(compressedLazerData)
  }

  return writer.toUint8Array()
}

/**
 * Reads the legacy online score id, whose presence and width depend on the client version.
 */
function readLegacyOnlineId(reader: BinaryReader, gameVersion: number): bigint {
  if (gameVersion >= LEGACY_ONLINE_ID_INT64_VERSION) {
    return reader.readInt64()
  }

  if (gameVersion >= LEGACY_ONLINE_ID_INT32_VERSION) {
    return BigInt(reader.readInt32())
  }

  return 0n
}

function writeLegacyOnlineId(writer: BinaryWriter, gameVersion: number, onlineScoreId: bigint): void {
  if (gameVersion >= LEGACY_ONLINE_ID_INT64_VERSION) {
    writer.writeInt64(onlineScoreId)
    return
  }

  if (gameVersion >= LEGACY_ONLINE_ID_INT32_VERSION) {
    writer.writeInt32(Number(onlineScoreId))
  }
}
