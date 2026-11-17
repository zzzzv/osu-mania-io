import {
  type BeatmapSection,
  BeatmapSectionIo,
} from '../section-io'
import {
  type SampleBank,
  sampleBankFromIndex,
  sampleBankToIndex,
} from '../sample-bank'

/**
 * Mania lane width in osu! pixels.
 */
const PLAYFIELD_WIDTH = 512

/**
 * The `type` bit marking an osu!mania hold note.
 */
const HOLD_NOTE_TYPE_FLAG = 128

/**
 * Shared sample information used by mania hit objects.
 */
export interface SampleReference {
  bank?: SampleBank
  additionBank?: SampleBank
  customIndex?: number
  volume?: number
  filename?: string
}

/**
 * A mania hit object.
 *
 * `column` is always zero-based and derived from the raw `x` position. Like
 * osu!lazer's encoder, the raw `x`/`y` position and the ruleset-irrelevant
 * `type` bits (the new-combo flag) are normalized away on write: notes are
 * written centred in their lane with `type = 1` and holds with `type = 128`.
 */
export interface HitObject {
  column: number
  startTime: number
  endTime?: number
  hitSoundFlags?: number
  sample?: SampleReference
}

export const hitObjectsSection: BeatmapSection<readonly HitObject[]> = {
  name: 'HitObjects',
  read(lines, context) {
    const keyCount = requireKeyCount(context.keyCount)
    const hitObjects: HitObject[] = []

    for (const line of lines) {
      const parts = BeatmapSectionIo.splitList(line)

      if (parts.length < 5) {
        if (context.strict) {
          throw new Error(`Malformed hit object: ${line}`)
        }

        continue
      }

      const x = BeatmapSectionIo.parseNumber(parts[0] ?? '', 'hit object x', context.strict)
      const startTime = BeatmapSectionIo.parseNumber(parts[2] ?? '', 'hit object time', context.strict)
      const type = BeatmapSectionIo.parseNumber(parts[3] ?? '', 'hit object type', context.strict)

      if (x === undefined || startTime === undefined || type === undefined) {
        continue
      }

      const hitSoundFlags = BeatmapSectionIo.parseNumber(parts[4] ?? '0', 'hit object hit sound', context.strict)
      const hold = (type & HOLD_NOTE_TYPE_FLAG) !== 0
      const { endTime, sampleParams } = hold
        ? readHoldParams(parts[5], context.strict)
        : { endTime: undefined, sampleParams: parts[5] }

      hitObjects.push({
        column: columnFromX(x, keyCount),
        startTime,
        hitSoundFlags,
        sample: parseSampleReference(sampleParams),
        endTime,
      })
    }

    return hitObjects.length === 0 ? undefined : hitObjects
  },
  write(value, context) {
    if (!value) {
      return []
    }

    const keyCount = requireKeyCount(context.keyCount)

    return value.map((item) => {
      const type = item.endTime === undefined ? 1 : HOLD_NOTE_TYPE_FLAG
      const sample = serializeSampleReference(item.sample)
      const objectParams = item.endTime === undefined
        ? sample
        : `${item.endTime}:${sample}`

      return [
        xFromColumn(item.column, keyCount),
        192,
        item.startTime,
        type,
        item.hitSoundFlags ?? 0,
        objectParams,
      ].join(',')
    })
  },
}

/**
 * Converts a raw `.osu` x position into a zero-based mania column.
 */
export function columnFromX(x: number, keyCount: number): number {
  const column = Math.floor(x * keyCount / PLAYFIELD_WIDTH)

  return Math.min(keyCount - 1, Math.max(0, column))
}

/**
 * Converts a zero-based mania column into a centred `.osu` x position.
 */
export function xFromColumn(column: number, keyCount: number): number {
  return Math.floor((column + 0.5) * PLAYFIELD_WIDTH / keyCount)
}

function requireKeyCount(keyCount: number | undefined): number {
  if (keyCount === undefined || keyCount <= 0) {
    throw new Error('Parsing or writing mania hit objects requires a positive key count.')
  }

  return keyCount
}

/**
 * Splits a hold note's `endTime:hitSample` parameter, which uses a colon
 * separator instead of a comma.
 */
function readHoldParams(
  objectParams: string | undefined,
  strict: boolean,
): { endTime: number | undefined; sampleParams: string | undefined } {
  if (!objectParams) {
    return { endTime: undefined, sampleParams: undefined }
  }

  const separatorIndex = objectParams.indexOf(':')

  if (separatorIndex < 0) {
    return { endTime: BeatmapSectionIo.parseNumber(objectParams, 'hold note end time', strict), sampleParams: undefined }
  }

  return {
    endTime: BeatmapSectionIo.parseNumber(objectParams.slice(0, separatorIndex), 'hold note end time', strict),
    sampleParams: objectParams.slice(separatorIndex + 1),
  }
}

function parseSampleReference(value: string | undefined): SampleReference | undefined {
  if (!value) {
    return undefined
  }

  const parts = value.split(':')
  const [bank, additionBank, customIndex, volume] = parts
  // The filename is the only field that may itself contain a colon.
  const filename = parts.length > 5 ? parts.slice(4).join(':') : parts[4]

  return {
    bank: sampleBankFromIndex(readIndex(bank)),
    additionBank: sampleBankFromIndex(readIndex(additionBank)),
    customIndex: readIndex(customIndex),
    volume: readIndex(volume),
    filename: filename ? filename : undefined,
  }
}

function readIndex(value: string | undefined): number | undefined {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : undefined
}

function serializeSampleReference(value: SampleReference | undefined): string {
  if (!value) {
    return '0:0:0:0:'
  }

  return [
    sampleBankToIndex(value.bank),
    sampleBankToIndex(value.additionBank),
    value.customIndex ?? 0,
    value.volume ?? 0,
    value.filename ?? '',
  ].join(':')
}
