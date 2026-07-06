import { BinaryReader, BinaryWriter } from 'osu-binary'

import {
  dateToTicks,
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
import type { Replay, ReplayBinaryInput } from './types'

export type {
  LazerReplayData,
  Replay,
  ReplayBinaryInput,
  ReplayFrame,
  ReplayStatistics,
} from './types'

/**
 * Parses a mania replay from binary `.osr` data.
 *
 * Runtime implementations use `osu-binary` for byte-level IO.
 */
export function parseReplay(
  input: ReplayBinaryInput,
  keyCount: number,
  options?: {
    includeFrames?: boolean
    strict?: boolean
  },
): Replay {
  const includeFrames = options?.includeFrames ?? true
  const strict = options?.strict ?? true

  if (!Number.isInteger(keyCount) || keyCount <= 0) {
    throw new Error(`Expected a positive integer key count, but received ${keyCount}.`)
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

  reader.readString()

  const playedAt = ticksToDate(reader.readInt64())
  const compressedReplayDataLength = reader.readInt32()
  const compressedReplayData = reader.readBytes(compressedReplayDataLength)
  const { frames, stableRandomSeed } = includeFrames
    ? parseFrameData(decodeReplayData(compressedReplayData), keyCount, strict)
    : { frames: [], stableRandomSeed: undefined }
  const onlineScoreId = reader.readInt64()
  const lazer = parseTrailingLazerData(reader)

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
    onlineScoreId: onlineScoreId === 0n ? undefined : onlineScoreId,
    stableRandomSeed,
    lazer,
  }
}

/**
 * Serializes a normalized mania replay into binary `.osr` data.
 *
 * Serialization is schema-oriented and does not guarantee lossless round-trips.
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
  writer.writeString('')
  writer.writeInt64(dateToTicks(replay.playedAt))

  const compressedReplayData = encodeReplayData(replay.frames, replay.stableRandomSeed)

  writer.writeInt32(compressedReplayData.byteLength)
  writer.writeBytes(compressedReplayData)
  writer.writeInt64(replay.onlineScoreId ?? 0n)

  if (replay.lazer) {
    const compressedLazerData = encodeLazerPayload(replay.lazer)

    writer.writeInt32(compressedLazerData.byteLength)
    writer.writeBytes(compressedLazerData)
  }

  return writer.toUint8Array()
}