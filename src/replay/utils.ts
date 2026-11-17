export const MANIA_RULESET_ID = 3

/**
 * The lowest `gameVersion` for which osu!lazer appends its compressed
 * `LegacyReplaySoloScoreInfo` payload.
 *
 * osu!lazer's `LegacyScoreEncoder.FIRST_LAZER_VERSION` is `30000000`; the
 * decoder only reads the trailing payload from `30000001` onwards.
 */
export const LAZER_SCORE_INFO_MIN_VERSION = 30000001

/**
 * The legacy `gameVersion` from which the online score id is an int64.
 */
export const LEGACY_ONLINE_ID_INT64_VERSION = 20140721

/**
 * The legacy `gameVersion` from which the online score id exists at all.
 */
export const LEGACY_ONLINE_ID_INT32_VERSION = 20121008

const TICKS_AT_UNIX_EPOCH = 621355968000000000n
const TICKS_PER_MILLISECOND = 10000n

/**
 * Converts .NET ticks stored in replays to a JavaScript date.
 */
export function ticksToDate(ticks: bigint): Date {
  const milliseconds = Number((ticks - TICKS_AT_UNIX_EPOCH) / TICKS_PER_MILLISECOND)

  return new Date(milliseconds)
}

/**
 * Converts a JavaScript date to .NET ticks for replay serialization.
 */
export function dateToTicks(date: Date): bigint {
  return BigInt(date.getTime()) * TICKS_PER_MILLISECOND + TICKS_AT_UNIX_EPOCH
}
