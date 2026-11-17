/**
 * Sample bank names used by beatmap timing points, general settings, and hit objects.
 *
 * The wire format stores these as indices, where `0` means "no override":
 * - in `[General]` / `[TimingPoints]` it defers to the beatmap's default bank,
 * - in `hitSample` it defers to the active timing point.
 */
export type SampleBank = 'default' | 'normal' | 'soft' | 'drum'

/**
 * Sample bank indices ordered by their wire value.
 */
export const SAMPLE_BANKS = ['default', 'normal', 'soft', 'drum'] as const

/**
 * Converts a sample bank index into its name.
 */
export function sampleBankFromIndex(index: number | undefined): SampleBank | undefined {
  return index === undefined ? undefined : SAMPLE_BANKS[index]
}

/**
 * Converts a sample bank name into its wire index.
 */
export function sampleBankToIndex(bank: SampleBank | undefined): number {
  return bank === undefined ? 0 : Math.max(SAMPLE_BANKS.indexOf(bank), 0)
}

/**
 * Resolves the `[General]` / `[TimingPoints]` name for a sample bank.
 *
 * These sections spell the bank out instead of using an index.
 */
export function sampleBankFromName(name: string | undefined): SampleBank {
  const normalized = name?.trim().toLowerCase()

  if (normalized === 'normal' || normalized === 'soft' || normalized === 'drum') {
    return normalized
  }

  return 'default'
}

/**
 * Serializes a sample bank name for `[General]` / `[TimingPoints]`-style values.
 *
 * The wire format capitalises these names (`Normal`, `Soft`, `Drum`).
 */
export function sampleBankToName(bank: SampleBank): string {
  return bank === 'default' ? 'Normal' : bank.charAt(0).toUpperCase() + bank.slice(1)
}
