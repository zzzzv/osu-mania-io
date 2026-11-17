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
 * Options shared by every section parser.
 */
export interface BeatmapReadContext {
  /**
   * Whether malformed values should raise instead of being ignored.
   */
  strict: boolean

  /**
   * The mania key count, required by sections whose layout depends on it.
   */
  keyCount?: number
}

/**
 * Options shared by every section writer.
 */
export interface BeatmapWriteContext {
  /**
   * The mania key count, required by sections whose layout depends on it.
   */
  keyCount: number
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
  read(lines: readonly string[], context: BeatmapReadContext): TSection | undefined

  /**
   * Writes a section back to raw lines.
   */
  write(value: TSection | undefined, context: BeatmapWriteContext): readonly string[]
}

/**
 * Shared low-level IO helpers for `.osu` beatmap sections.
 */
export class BeatmapSectionIo {
  /**
   * Splits `.osu` text into ordered raw sections.
   */
  static parseRawSections(input: string): RawSection[] {
    const normalized = stripByteOrderMark(input).replace(/\r\n?/g, '\n')
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
   * Reads the `osu file format vN` header value.
   */
  static parseFileFormat(input: string): number | undefined {
    const header = stripByteOrderMark(input)
      .split(/\r\n?|\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0)

    const match = header?.match(/^osu file format v(\d+)$/i)

    if (!match?.[1]) {
      return undefined
    }

    const version = Number(match[1])

    return Number.isFinite(version) ? version : undefined
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
    read(pairs: readonly KeyValueLine[], context: BeatmapReadContext): TSection | undefined
    write(value: TSection, context: BeatmapWriteContext): readonly KeyValueLine[]
  }): BeatmapSection<TSection> {
    return {
      name: options.name,
      read(lines, context) {
        return options.read(BeatmapSectionIo.parseKeyValueLines(lines), context)
      },
      write(value, context) {
        return value === undefined ? [] : BeatmapSectionIo.writeKeyValueLines(options.write(value, context))
      },
    }
  }

  /**
   * Splits a comma separated `.osu` list, honouring double-quoted values.
   *
   * Quotes are stripped from the resulting items.
   */
  static splitList(line: string): string[] {
    const items: string[] = []
    let current = ''
    let quoted = false

    for (const character of line) {
      if (character === '"') {
        quoted = !quoted
        continue
      }

      if (character === ',' && !quoted) {
        items.push(current)
        current = ''
        continue
      }

      current += character
    }

    items.push(current)

    return items.map((item) => item.trim())
  }

  /**
   * Parses a numeric list item, raising on malformed input when strict.
   */
  static parseNumber(value: string, label: string, strict: boolean): number | undefined {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }

    if (strict) {
      throw new Error(`Expected a numeric ${label}, but received "${value}".`)
    }

    return undefined
  }

  static readString(pairs: readonly KeyValueLine[], key: string): string | undefined {
    return pairs.find((pair) => pair.key === key)?.value
  }

  static readNumber(
    pairs: readonly KeyValueLine[],
    key: string,
    context?: BeatmapReadContext,
  ): number | undefined {
    const value = BeatmapSectionIo.readString(pairs, key)

    return value === undefined ? undefined : BeatmapSectionIo.parseNumber(value, `"${key}" value`, context?.strict ?? false)
  }

  static readBoolean(pairs: readonly KeyValueLine[], key: string): boolean | undefined {
    const value = BeatmapSectionIo.readString(pairs, key)

    if (value === undefined) {
      return undefined
    }

    return value === '1' || value.toLowerCase() === 'true'
  }

  static readNumberList(
    pairs: readonly KeyValueLine[],
    key: string,
    context?: BeatmapReadContext,
  ): readonly number[] | undefined {
    const value = BeatmapSectionIo.readString(pairs, key)

    if (value === undefined) {
      return undefined
    }

    return value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item))
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

/**
 * Removes a UTF-8 byte order mark so the format header can be matched.
 */
function stripByteOrderMark(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
}
