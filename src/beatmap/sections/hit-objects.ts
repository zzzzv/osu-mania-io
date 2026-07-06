import type { BeatmapSection } from '../section-io'

/**
 * Shared sample information used by mania timing points and hit objects.
 */
export interface SampleReference {
  bank?: 'auto' | 'normal' | 'soft' | 'drum'
  additionBank?: 'auto' | 'normal' | 'soft' | 'drum'
  customIndex?: number
  volume?: number
  filename?: string
}

/**
 * Shared properties for all mania hit objects.
 */
export interface HitObject {
  column: number
  startTime: number
  endTime?: number
  hitSoundFlags?: number
  sample?: SampleReference
}

const sampleBanks = ['auto', 'normal', 'soft', 'drum'] as const

export const hitObjectsSection: BeatmapSection<readonly HitObject[]> = {
  name: 'HitObjects',
  read(lines) {
    const hitObjects: HitObject[] = []

    for (const line of lines) {
      const parts = line.split(',')

      if (parts.length < 5) {
        continue
      }

      const x = Number(parts[0])
      const startTime = Number(parts[2])
      const type = Number(parts[3])
      const hitSoundFlags = Number(parts[4])
      const objectParams = parts[5] ?? ''
      const sampleParams = parts[parts.length - 1] ?? ''

      const sample = parseSampleReference(sampleParams)
      const endTime = (type & 128) !== 0
        ? Number(objectParams.split(':')[0])
        : undefined

      hitObjects.push({
        column: Math.max(0, Math.floor(x)),
        startTime,
        hitSoundFlags: Number.isFinite(hitSoundFlags) ? hitSoundFlags : undefined,
        sample,
        endTime: Number.isFinite(endTime ?? Number.NaN) ? endTime : undefined,
      })
    }

    return hitObjects.length === 0 ? undefined : hitObjects
  },
  write(value) {
    return value?.map((item) => {
      const type = item.endTime === undefined ? 1 : 128
      const sample = serializeSampleReference(item.sample)
      const objectParams = item.endTime === undefined
        ? sample
        : `${item.endTime}:${sample}`

      return [
        item.column,
        192,
        item.startTime,
        type,
        item.hitSoundFlags ?? 0,
        objectParams,
      ].join(',')
    }) ?? []
  },
}

function parseSampleReference(value: string): SampleReference | undefined {
  if (!value) {
    return undefined
  }

  const [bank, additionBank, customIndex, volume, filename] = value.split(':')

  return {
    bank: sampleBanks[Number(bank)] as SampleReference['bank'] | undefined,
    additionBank: sampleBanks[Number(additionBank)] as SampleReference['additionBank'] | undefined,
    customIndex: Number.isFinite(Number(customIndex)) ? Number(customIndex) : undefined,
    volume: Number.isFinite(Number(volume)) ? Number(volume) : undefined,
    filename: filename || undefined,
  }
}

/**
 * Converts raw `.osu` x positions into zero-based mania columns.
 */
export function normalizeHitObjectColumns(hitObjects: readonly HitObject[], keyCount: number): HitObject[] {
  const laneWidth = 512 / keyCount

  return hitObjects.map((hitObject) => ({
    ...hitObject,
    column: Math.min(keyCount - 1, Math.max(0, Math.floor(hitObject.column / laneWidth))),
  }))
}

/**
 * Converts zero-based mania columns back into centered `.osu` x positions.
 */
export function denormalizeHitObjectColumns(hitObjects: readonly HitObject[], keyCount: number): HitObject[] {
  const laneWidth = 512 / keyCount

  return hitObjects.map((hitObject) => ({
    ...hitObject,
    column: Math.floor((hitObject.column + 0.5) * laneWidth),
  }))
}

function serializeSampleReference(value: SampleReference | undefined): string {
  if (!value) {
    return '0:0:0:0:'
  }

  const bank = value.bank ? sampleBanks.indexOf(value.bank) : 0
  const additionBank = value.additionBank ? sampleBanks.indexOf(value.additionBank) : 0

  return [
    Math.max(bank, 0),
    Math.max(additionBank, 0),
    value.customIndex ?? 0,
    value.volume ?? 0,
    value.filename ?? '',
  ].join(':')
}