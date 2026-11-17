import {
  type BeatmapSection,
  BeatmapSectionIo,
} from '../section-io'

/**
 * A background image event from the `[Events]` section.
 */
export interface BackgroundEvent {
  filename: string
  xOffset: number
  yOffset: number
}

/**
 * A background video event from the `[Events]` section.
 */
export interface VideoEvent {
  startTime: number
  filename: string
  xOffset: number
  yOffset: number
}

/**
 * A break period from the `[Events]` section.
 */
export interface BreakPeriod {
  startTime: number
  endTime: number
}

/**
 * The supported data from the `[Events]` section.
 *
 * Storyboard (`.osb`-style) commands and sound sample events are preserved
 * verbatim so that beatmaps can be round-tripped without losing them.
 */
export interface BeatmapEvents {
  background?: BackgroundEvent
  video?: VideoEvent
  breaks?: readonly BreakPeriod[]
  storyboardLines?: readonly string[]
}

export const eventsSection: BeatmapSection<BeatmapEvents> = {
  name: 'Events',
  read(lines, context) {
    let background: BackgroundEvent | undefined
    let video: VideoEvent | undefined
    const breaks: BreakPeriod[] = []
    const storyboardLines: string[] = []

    for (const line of lines) {
      const parts = BeatmapSectionIo.splitList(line)
      const type = parts[0]

      if (type === '0' || type === 'Background') {
        const filename = parts[2]

        if (filename) {
          background = {
            filename,
            xOffset: readOffset(parts[3]),
            yOffset: readOffset(parts[4]),
          }
        }

        continue
      }

      if (type === '1' || type === 'Video') {
        const filename = parts[2]

        if (filename) {
          video = {
            startTime: BeatmapSectionIo.parseNumber(parts[1] ?? '0', 'video start time', context.strict) ?? 0,
            filename,
            xOffset: readOffset(parts[3]),
            yOffset: readOffset(parts[4]),
          }
        }

        continue
      }

      if (type === '2' || type === 'Break') {
        const startTime = BeatmapSectionIo.parseNumber(parts[1] ?? '', 'break start time', context.strict)
        const endTime = BeatmapSectionIo.parseNumber(parts[2] ?? '', 'break end time', context.strict)

        if (startTime === undefined || endTime === undefined) {
          continue
        }

        breaks.push({ startTime, endTime })

        continue
      }

      if (line.length > 0) {
        storyboardLines.push(line)
      }
    }

    if (!background && !video && breaks.length === 0 && storyboardLines.length === 0) {
      return undefined
    }

    return {
      background,
      video,
      breaks: breaks.length === 0 ? undefined : breaks,
      storyboardLines: storyboardLines.length === 0 ? undefined : storyboardLines,
    }
  },
  write(value) {
    if (!value) {
      return []
    }

    const lines: string[] = []

    if (value.background) {
      lines.push(`0,0,"${value.background.filename}",${value.background.xOffset},${value.background.yOffset}`)
    }

    if (value.video) {
      lines.push(`1,${value.video.startTime},"${value.video.filename}",${value.video.xOffset},${value.video.yOffset}`)
    }

    for (const item of value.breaks ?? []) {
      lines.push(`2,${item.startTime},${item.endTime}`)
    }

    lines.push(...(value.storyboardLines ?? []))

    return lines
  },
}

function readOffset(raw: string | undefined): number {
  const parsed = Number(raw)

  return Number.isFinite(parsed) ? parsed : 0
}
