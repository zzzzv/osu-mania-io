import { Random } from 'dotnet-random-ts'

// ---------------------------------------------------------------------------
// Lazer random — used by ManiaModRandom
// ---------------------------------------------------------------------------

const DEFAULT_RANDOM_SEED = 0x6d2b79f5

/**
 * Creates the deterministic column permutation used by lazer's RD mod.
 *
 * Mirrors `Enumerable.Range(0, keyCount).OrderBy(_ => rng.Next())` against
 * .NET's `System.Random`, which is what `ManiaModRandom` applies.
 */
export function createShuffledColumns(keyCount: number, seed?: number): number[] {
  const columns = Array.from({ length: keyCount }, (_, index) => index)
  const random = new Random(seed ?? DEFAULT_RANDOM_SEED)

  return columns
    .map((column, index) => ({
      column,
      index,
      order: random.next(),
    }))
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map((entry) => entry.column)
}

// ---------------------------------------------------------------------------
// Stable random — used by osu!stable's mania Random mod
// ---------------------------------------------------------------------------

/**
 * Creates the deterministic column permutation used by osu!stable's RD mod.
 *
 * Stable seeds .NET's `System.Random` with the replay's random seed, then rolls
 * `Next(keyCount)` repeatedly and keeps the first occurrence of each column
 * until every column has been assigned. The order in which columns are first
 * rolled is the column mapping. Because duplicates are discarded rather than
 * re-mapped, the permutation distribution is not uniform (unlike lazer's).
 */
export function createStableShuffledColumns(keyCount: number, seed: number): number[] {
  const random = new Random(seed)
  const shuffledColumns: number[] = []
  const assignedColumns = new Set<number>()

  while (shuffledColumns.length < keyCount) {
    const column = random.next(keyCount)

    if (!assignedColumns.has(column)) {
      assignedColumns.add(column)
      shuffledColumns.push(column)
    }
  }

  return shuffledColumns
}
