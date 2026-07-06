import type { Beatmap, HitObject, TimingPoint } from '../../beatmap'

export function computeInvertDuration(beatmap: Beatmap, startTime: number, nextTime: number): number {
  const gap = nextTime - startTime
  const beatLength = getBeatLengthAt(beatmap, nextTime)

  return Math.max(gap / 2, gap - beatLength / 4)
}

export function getBeatLengthAt(beatmap: Beatmap, time: number): number {
  const timingPoints = beatmap.controlPoints.filter((point): point is TimingPoint => point.kind === 'timing')
  let beatLength = timingPoints[0]?.beatLength ?? 600

  for (const point of timingPoints) {
    if (point.time > time) {
      break
    }

    beatLength = point.beatLength
  }

  return beatLength
}

export function groupHitObjectsByColumn(hitObjects: readonly HitObject[], keyCount: number): HitObject[][] {
  const groups = Array.from({ length: keyCount }, () => new Array<HitObject>())

  for (const hitObject of hitObjects) {
    groups[hitObject.column]?.push(cloneHitObject(hitObject))
  }

  for (const group of groups) {
    group.sort(compareHitObjects)
  }

  return groups
}

export function cloneBeatmap<TBeatmap extends Beatmap>(beatmap: TBeatmap): TBeatmap {
  return {
    ...beatmap,
    general: { ...beatmap.general },
    editor: beatmap.editor
      ? {
          ...beatmap.editor,
          bookmarks: beatmap.editor.bookmarks ? [...beatmap.editor.bookmarks] : undefined,
        }
      : undefined,
    metadata: {
      ...beatmap.metadata,
      tags: beatmap.metadata.tags ? [...beatmap.metadata.tags] : undefined,
    },
    difficulty: { ...beatmap.difficulty },
    controlPoints: beatmap.controlPoints.map((point) => ({ ...point })),
    breaks: beatmap.breaks?.map((breakPeriod) => ({ ...breakPeriod })),
    hitObjects: beatmap.hitObjects.map(cloneHitObject),
  }
}

export function cloneHitObject(hitObject: HitObject): HitObject {
  return {
    ...hitObject,
    sample: hitObject.sample ? { ...hitObject.sample } : undefined,
  }
}

export function sortHitObjects(hitObjects: readonly HitObject[]): HitObject[] {
  return [...hitObjects].sort(compareHitObjects)
}

export function compareHitObjects(left: HitObject, right: HitObject): number {
  return left.startTime - right.startTime || left.column - right.column
}