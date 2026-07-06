import type { BeatmapSection } from '../section-io'

/**
 * A break period from the `[Events]` section.
 */
export interface BreakPeriod {
  startTime: number
  endTime: number
}

/**
 * The supported mania-relevant data from the `[Events]` section.
 */
export interface BeatmapEvents {
  backgroundFilename?: string
  breaks?: readonly BreakPeriod[]
}

export const eventsSection: BeatmapSection<BeatmapEvents> = {
  name: 'Events',
  read(lines) {
    const breaks: BreakPeriod[] = []
    let backgroundFilename: string | undefined

    for (const line of lines) {
      const parts = line.split(',').map((part) => part.trim())

      if (parts[0] === '0' && parts[2]) {
        backgroundFilename = parts[2].replace(/^"|"$/g, '')
        continue
      }

      if (parts[0] !== '2' || parts.length < 3) {
        continue
      }

      breaks.push({
        startTime: Number(parts[1]),
        endTime: Number(parts[2]),
      })
    }

    if (!backgroundFilename && breaks.length === 0) {
      return undefined
    }

    return {
      backgroundFilename,
      breaks: breaks.length === 0 ? undefined : breaks,
    }
  },
  write(value) {
    if (!value) {
      return []
    }

    const lines: string[] = []

    if (value.backgroundFilename) {
      lines.push(`0,0,"${value.backgroundFilename}",0,0`)
    }

    for (const item of value.breaks ?? []) {
      lines.push(`2,${item.startTime},${item.endTime}`)
    }

    return lines
  },
}