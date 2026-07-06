import { Random } from 'dotnet-random-ts'

// ---------------------------------------------------------------------------
// Lazer random — System.Random (LCG), used by ManiaModRandom
// ---------------------------------------------------------------------------

const DEFAULT_RANDOM_SEED = 0x6d2b79f5

/**
 * Creates the deterministic column permutation used by lazer's RD mod.
 *
 * Matches .NET's System.Random via `OrderBy(_ => rng.Next())`.
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
// Stable random — xorshift PRNG (known in osu-stable code as FastRandom)
// Ported from osu!'s LegacyRandom (ppy/osu: osu.Game/Utils/LegacyRandom.cs)
// ---------------------------------------------------------------------------

const INT_MASK = 0x7FFFFFFF
const INT_TO_REAL = 1.0 / (INT_MASK + 1.0)

class LegacyRandom {
  private x: number
  private y = 842502087
  private z = 3579807591
  private w = 273326509

  constructor(seed: number) {
    this.x = seed >>> 0
  }

  nextUInt(): number {
    const t = (this.x ^ (this.x << 11)) >>> 0
    this.x = this.y
    this.y = this.z
    this.z = this.w
    this.w = (this.w ^ (this.w >>> 19) ^ t ^ (t >>> 8)) >>> 0
    return this.w
  }

  next(): number {
    return INT_MASK & this.nextUInt()
  }

  nextDouble(): number {
    return INT_TO_REAL * this.next()
  }

  nextUpperBound(upperBound: number): number {
    return Math.floor(this.nextDouble() * upperBound)
  }
}
