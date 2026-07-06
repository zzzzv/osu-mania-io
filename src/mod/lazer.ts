type SettingKind = 'number' | 'boolean'

interface SettingFieldDescriptor {
  readonly property: string
  readonly wire: string
  readonly kind: SettingKind
}

type SettingValue<TKind extends SettingKind> =
  TKind extends 'number' ? number
    : TKind extends 'boolean' ? boolean
      : never

type SettingsFromFields<TFields extends readonly SettingFieldDescriptor[]> = {
  [TField in TFields[number] as TField['property']]?: SettingValue<TField['kind']>
}

const difficultyAdjustFields = [
  { property: 'drainRate', wire: 'drain_rate', kind: 'number' },
  { property: 'overallDifficulty', wire: 'overall_difficulty', kind: 'number' },
  { property: 'extendedLimits', wire: 'extended_limits', kind: 'boolean' },
] as const satisfies readonly SettingFieldDescriptor[]

const rateAdjustFields = [
  { property: 'speedChange', wire: 'speed_change', kind: 'number' },
  { property: 'adjustPitch', wire: 'adjust_pitch', kind: 'boolean' },
] as const satisfies readonly SettingFieldDescriptor[]

const timeRampFields = [
  { property: 'initialRate', wire: 'initial_rate', kind: 'number' },
  { property: 'finalRate', wire: 'final_rate', kind: 'number' },
  { property: 'adjustPitch', wire: 'adjust_pitch', kind: 'boolean' },
] as const satisfies readonly SettingFieldDescriptor[]

const randomFields = [
  { property: 'seed', wire: 'seed', kind: 'number' },
] as const satisfies readonly SettingFieldDescriptor[]

const PLAIN_LAZER_MOD_ACRONYMS = [
  'NF', 'EZ', 'HD', 'HR', 'SD', 'PF', 'FL', 'AT', 'SO', 'FI',
  'MR', 'CN', 'CL', 'SV2', 'CS', 'CO', 'DS', 'HO', 'NR', 'MU', 'IN',
  '1K', '2K', '3K', '4K', '5K', '6K', '7K', '8K', '9K', '10K',
] as const

const plainLazerModAcronymSet = new Set<string>(PLAIN_LAZER_MOD_ACRONYMS)

/**
 * Lazer settings for the Difficulty Adjust mod.
 */
export type LazerDifficultyAdjustSettings = SettingsFromFields<typeof difficultyAdjustFields>

/**
 * Lazer settings for rate-adjusting mods such as DT, NC, HT, and DC.
 */
export type LazerRateAdjustSettings = SettingsFromFields<typeof rateAdjustFields>

/**
 * Lazer settings for time-ramping mods such as WU and WD.
 */
export type LazerTimeRampSettings = SettingsFromFields<typeof timeRampFields>

/**
 * Lazer settings for randomizing mods.
 */
export type LazerRandomSettings = SettingsFromFields<typeof randomFields>

/**
 * Known lazer mania mod acronyms without custom settings.
 */
export type PlainLazerModAcronym = (typeof PLAIN_LAZER_MOD_ACRONYMS)[number]

export interface PlainLazerMod {
  acronym: PlainLazerModAcronym
  settings?: undefined
}

export interface LazerDifficultyAdjustMod {
  acronym: 'DA'
  settings?: LazerDifficultyAdjustSettings
}

export interface LazerRateAdjustMod {
  acronym: 'DT' | 'NC' | 'HT' | 'DC'
  settings?: LazerRateAdjustSettings
}

export interface LazerTimeRampMod {
  acronym: 'WU' | 'WD'
  settings?: LazerTimeRampSettings
}

export interface LazerRandomMod {
  acronym: 'RD'
  settings?: LazerRandomSettings
}

export interface UnknownLazerMod {
  acronym: string
  settings?: Readonly<Record<string, unknown>>
}

export type LazerMod =
  | PlainLazerMod
  | LazerDifficultyAdjustMod
  | LazerRateAdjustMod
  | LazerTimeRampMod
  | LazerRandomMod
  | UnknownLazerMod

export function parseLazerMod(raw: unknown): LazerMod | undefined {
  if (!isRecord(raw) || typeof raw.acronym !== 'string') {
    return undefined
  }

  const acronym = raw.acronym
  const settings = isRecord(raw.settings) ? raw.settings : undefined

  switch (acronym) {
    case 'DA':
      return { acronym, settings: parseSettings(settings, difficultyAdjustFields) }
    case 'DT':
    case 'NC':
    case 'HT':
    case 'DC':
      return { acronym, settings: parseSettings(settings, rateAdjustFields) }
    case 'WU':
    case 'WD':
      return { acronym, settings: parseSettings(settings, timeRampFields) }
    case 'RD':
      return { acronym, settings: parseSettings(settings, randomFields) }
    default:
      if (isPlainLazerModAcronym(acronym)) {
        return { acronym }
      }

      return { acronym, settings }
  }
}

export function serializeLazerMod(mod: LazerMod): Record<string, unknown> {
  switch (mod.acronym) {
    case 'DA':
      return { acronym: mod.acronym, settings: serializeSettings(mod.settings, difficultyAdjustFields) }
    case 'DT':
    case 'NC':
    case 'HT':
    case 'DC':
      return { acronym: mod.acronym, settings: serializeSettings(mod.settings, rateAdjustFields) }
    case 'WU':
    case 'WD':
      return { acronym: mod.acronym, settings: serializeSettings(mod.settings, timeRampFields) }
    case 'RD':
      return { acronym: mod.acronym, settings: serializeSettings(mod.settings, randomFields) }
    default:
      return mod.settings === undefined ? { acronym: mod.acronym } : { acronym: mod.acronym, settings: mod.settings }
  }
}

function parseSettings<TFields extends readonly SettingFieldDescriptor[]>(
  raw: Record<string, unknown> | undefined,
  fields: TFields,
): SettingsFromFields<TFields> | undefined {
  if (!raw) {
    return undefined
  }

  const entries = fields.flatMap((field) => {
    const value = readFieldValue(raw, field)

    return value === undefined ? [] : [[field.property, value] as const]
  })

  return entries.length === 0
    ? undefined
    : Object.fromEntries(entries) as SettingsFromFields<TFields>
}

function serializeSettings<TFields extends readonly SettingFieldDescriptor[]>(
  settings: SettingsFromFields<TFields> | undefined,
  fields: TFields,
): Record<string, unknown> | undefined {
  if (!settings) {
    return undefined
  }

  const entries = fields.flatMap((field) => {
    const value = settings[field.property as keyof SettingsFromFields<TFields>]

    return value === undefined ? [] : [[field.wire, value] as const]
  })

  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

function readFieldValue(source: Record<string, unknown>, field: SettingFieldDescriptor): number | boolean | undefined {
  const value = source[field.wire]

  if (field.kind === 'number') {
    return typeof value === 'number' ? value : undefined
  }

  return typeof value === 'boolean' ? value : undefined
}

function isPlainLazerModAcronym(acronym: string): acronym is PlainLazerModAcronym {
  return plainLazerModAcronymSet.has(acronym)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
