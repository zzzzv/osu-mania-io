export const MANIA_RULESET_ID = 3

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