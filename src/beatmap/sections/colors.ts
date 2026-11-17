import {
  type KeyValueLine,
  BeatmapSectionIo,
} from '../section-io'

/**
 * An `R,G,B` colour triple as stored by the `[Colours]` section.
 */
export type Colour = readonly [red: number, green: number, blue: number]

/**
 * The `[Colours]` section.
 *
 * Combo colours are kept in their original order; non-contiguous combo indices
 * are renumbered on write.
 */
export interface BeatmapColours {
  combo: readonly Colour[]
  sliderTrackOverride?: Colour
  sliderBorder?: Colour
}

const comboKeyPattern = /^Combo(\d+)$/i

export const coloursSection = BeatmapSectionIo.createKeyValueSection<BeatmapColours>({
  name: 'Colours',
  read(pairs, context) {
    const combo: { index: number; colour: Colour }[] = []
    let sliderTrackOverride: Colour | undefined
    let sliderBorder: Colour | undefined

    for (const pair of pairs) {
      if (/^SliderTrackOverride$/i.test(pair.key)) {
        sliderTrackOverride = readColour(pair.value, context.strict, pair.key)
        continue
      }

      if (/^SliderBorder$/i.test(pair.key)) {
        sliderBorder = readColour(pair.value, context.strict, pair.key)
        continue
      }

      const comboMatch = pair.key.match(comboKeyPattern)

      if (comboMatch?.[1]) {
        const colour = readColour(pair.value, context.strict, pair.key)

        if (colour) {
          combo.push({ index: Number(comboMatch[1]), colour })
        }
      }
    }

    if (combo.length === 0 && !sliderTrackOverride && !sliderBorder) {
      return undefined
    }

    return {
      combo: combo.sort((left, right) => left.index - right.index).map((entry) => entry.colour),
      sliderTrackOverride,
      sliderBorder,
    }
  },
  write(value) {
    const pairs: KeyValueLine[] = []

    value.combo.forEach((colour, index) => {
      pairs.push({ key: `Combo${index + 1}`, value: colour.join(',') })
    })

    BeatmapSectionIo.appendString(pairs, 'SliderTrackOverride', value.sliderTrackOverride?.join(','))
    BeatmapSectionIo.appendString(pairs, 'SliderBorder', value.sliderBorder?.join(','))

    return pairs
  },
})

function readColour(value: string, strict: boolean, key: string): Colour | undefined {
  const channels = value.split(',').map((channel) => BeatmapSectionIo.parseNumber(channel, `${key} colour channel`, strict))

  if (channels.length < 3) {
    if (strict) {
      throw new Error(`Expected three colour channels for "${key}", but received "${value}".`)
    }

    return undefined
  }

  return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0]
}
