/**
 * A raw beatmap section as it appears in `.osu` text.
 */
export interface RawSection {
  /**
   * The section header without brackets.
   */
  name: string

  /**
   * The non-empty lines belonging to the section.
   */
  lines: string[]
}

/**
 * A raw key-value pair inside a `.osu` key-value section.
 */
export interface KeyValueLine {
  /**
   * The section key.
   */
  key: string

  /**
   * The raw value string.
   */
  value: string
}

/**
 * Common contract for a beatmap section parser/writer pair.
 */
export interface BeatmapSection<TSection> {
  /**
   * The `.osu` header name without brackets.
   */
  readonly name: string

  /**
   * Reads a section from its raw lines.
   */
  read(lines: readonly string[]): TSection | undefined

  /**
   * Writes a section back to raw lines.
   */
  write(value: TSection | undefined): readonly string[]
}

/**
 * Shared low-level IO helpers for `.osu` beatmap sections.
 */
export class BeatmapSectionIo {
  /**
   * Splits `.osu` text into ordered raw sections.
   */
  static parseRawSections(input: string): RawSection[] {
    const normalized = input.replace(/\r\n?/g, '\n')
    const lines = normalized.split('\n')
    const sections: RawSection[] = []
    let current: RawSection | undefined

    for (const rawLine of lines) {
      const line = rawLine.trim()

      if (line.length === 0 || line.startsWith('//')) {
        continue
      }

      if (line.startsWith('[') && line.endsWith(']')) {
        current = {
          name: line.slice(1, -1),
          lines: [],
        }
        sections.push(current)
        continue
      }

      current?.lines.push(line)
    }

    return sections
  }

  /**
   * Serializes ordered raw sections back into `.osu` text.
   */
  static writeRawSections(sections: readonly RawSection[], lineEnding: '\n' | '\r\n'): string {
    const chunks: string[] = []

    for (const section of sections) {
      chunks.push(`[${section.name}]`)
      chunks.push(...section.lines)
      chunks.push('')
    }

    return chunks.join(lineEnding).trimEnd()
  }

  /**
   * Splits key-value lines from a `.osu` section.
   */
  static parseKeyValueLines(lines: readonly string[]): KeyValueLine[] {
    const pairs: KeyValueLine[] = []

    for (const line of lines) {
      const separatorIndex = line.indexOf(':')

      if (separatorIndex < 0) {
        continue
      }

      pairs.push({
        key: line.slice(0, separatorIndex).trim(),
        value: line.slice(separatorIndex + 1).trim(),
      })
    }

    return pairs
  }

  /**
   * Writes key-value lines back to `.osu` text lines.
   */
  static writeKeyValueLines(pairs: readonly KeyValueLine[]): string[] {
    return pairs.map((pair) => `${pair.key}: ${pair.value}`)
  }

  /**
   * Creates a key-value section from read and write callbacks.
   */
  static createKeyValueSection<TSection>(options: {
    name: string
    read(pairs: readonly KeyValueLine[]): TSection | undefined
    write(value: TSection): readonly KeyValueLine[]
  }): BeatmapSection<TSection> {
    return {
      name: options.name,
      read(lines) {
        return options.read(BeatmapSectionIo.parseKeyValueLines(lines))
      },
      write(value) {
        return value === undefined ? [] : BeatmapSectionIo.writeKeyValueLines(options.write(value))
      },
    }
  }

  static readString(pairs: readonly KeyValueLine[], key: string): string | undefined {
    return pairs.find((pair) => pair.key === key)?.value
  }

  static readNumber(pairs: readonly KeyValueLine[], key: string): number | undefined {
    const value = BeatmapSectionIo.readString(pairs, key)

    return value === undefined ? undefined : Number(value)
  }

  static readBoolean(pairs: readonly KeyValueLine[], key: string): boolean | undefined {
    const value = BeatmapSectionIo.readString(pairs, key)

    if (value === undefined) {
      return undefined
    }

    return value === '1' || value.toLowerCase() === 'true'
  }

  static readNumberList(pairs: readonly KeyValueLine[], key: string): readonly number[] | undefined {
    const value = BeatmapSectionIo.readString(pairs, key)

    return value === undefined
      ? undefined
      : value.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item))
  }

  static appendString(pairs: KeyValueLine[], key: string, value: string | undefined): void {
    if (value !== undefined) {
      pairs.push({ key, value })
    }
  }

  static appendNumber(pairs: KeyValueLine[], key: string, value: number | undefined): void {
    if (value !== undefined) {
      pairs.push({ key, value: String(value) })
    }
  }

  static appendBoolean(pairs: KeyValueLine[], key: string, value: boolean | undefined): void {
    if (value !== undefined) {
      pairs.push({ key, value: value ? '1' : '0' })
    }
  }

  static appendNumberList(pairs: KeyValueLine[], key: string, value: readonly number[] | undefined): void {
    if (value && value.length > 0) {
      pairs.push({ key, value: value.join(',') })
    }
  }
}