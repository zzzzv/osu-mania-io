import type { LazerMod, LegacyModBitmask } from '../mod'

/**
 * Binary input accepted by replay parsing APIs.
 */
export type ReplayBinaryInput = ArrayBuffer | Uint8Array

/**
 * Replay judgement counts ordered as max, great, good, ok, meh, miss.
 */
export type ReplayStatistics = readonly [
  max: number,
  great: number,
  good: number,
  ok: number,
  meh: number,
  miss: number,
]

/**
 * A single mania replay frame normalized to key-state semantics.
 */
export interface ReplayFrame {
  /**
   * The cumulative frame time in milliseconds.
   */
  time: number

  /**
   * The pressed state of each mania column.
   */
  columns: readonly boolean[]
}

/**
 * A typed view of the lazer score payload appended to some replays.
 */
export interface LazerReplayData {
  /**
   * The lazer online score identifier.
   *
   * This comes from the JSON score payload (`online_id`), which osu!lazer
   * serialises as a JSON number, so it is a `number` while the container field
   * exposed as `Replay.onlineScoreId` is a `bigint`.
   */
  onlineId: number

  /**
   * The lazer mods attached to the score.
   */
  mods: readonly LazerMod[]

  /**
   * The primary statistics reported by lazer.
   */
  statistics: ReplayStatistics

  /**
   * The maximum statistics reported by lazer.
   */
  maximumStatistics: ReplayStatistics

  /**
   * The lazer client version string.
   */
  clientVersion: string

  /**
   * The lazer score rank.
   */
  rank?: string

  /**
   * The lazer user identifier.
   */
  userId: number

  /**
   * The lazer score without mod multipliers.
   */
  totalScoreWithoutMods?: number

  /**
   * Pause timestamps stored by lazer.
   */
  pauses: readonly number[]

}

/**
 * The normalized public mania replay model.
 */
export interface Replay {
  /**
   * The osu! client version stored in the replay.
   */
  gameVersion: number

  /**
   * The beatmap MD5 hash.
   */
  beatmapHash: string

  /**
   * The player name.
   */
  username: string

  /**
   * The replay MD5 hash.
   */
  replayHash: string

  /**
   * The raw legacy mod bitmask.
   */
  mods: LegacyModBitmask

  /**
   * The normalized replay statistics.
   */
  statistics: ReplayStatistics

  /**
   * The score value stored in the replay.
   */
  totalScore: number

  /**
   * The maximum combo stored in the replay.
   */
  maxCombo: number

  /**
   * Whether the replay reached full combo according to the container.
   */
  perfectCombo?: boolean

  /**
   * The replay timestamp.
   */
  playedAt: Date

  /**
   * The ordered mania replay frames.
   */
  frames: readonly ReplayFrame[]

  /**
   * The raw `time|health` graph text stored by the legacy container.
   */
  healthGraph?: string

  /**
   * The online score identifier read from the container, when available.
   *
   * Legacy containers store `0` (or `-1`) for offline scores, and the field is
   * an int64 only from `gameVersion` 20140721 onwards, so this is a `bigint`.
   */
  onlineScoreId?: bigint

  /**
   * The legacy stable random seed stored alongside replay frames.
   *
   * osu!stable writes the seed it used for the random mod. osu!lazer writes a
   * placeholder `0` in the same frame, so a value of `0` carries no seed
   * information for lazer-authored replays.
   */
  stableRandomSeed?: number

  /**
   * Optional lazer score data carried alongside the replay.
   */
  lazer?: LazerReplayData
}