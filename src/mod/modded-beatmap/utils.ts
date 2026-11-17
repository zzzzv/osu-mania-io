import type { Beatmap, HitObject } from '../../beatmap'

export function groupHitObjectsByColumn(hitObjects: readonly HitObject[], keyCount: number): HitObject[][] {
  const groups = Array.from({ length: keyCount }, () => new Array<HitObject>())

  for (const hitObject of hitObjects) {
    groups[hitObject.column]?.push(hitObject)
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
    events: beatmap.events
      ? {
          background: beatmap.events.background ? { ...beatmap.events.background } : undefined,
          video: beatmap.events.video ? { ...beatmap.events.video } : undefined,
          breaks: beatmap.events.breaks?.map((breakPeriod) => ({ ...breakPeriod })),
          storyboardLines: beatmap.events.storyboardLines ? [...beatmap.events.storyboardLines] : undefined,
        }
      : undefined,
    controlPoints: beatmap.controlPoints.map((point) => ({ ...point })),
    colours: beatmap.colours
      ? {
          combo: beatmap.colours.combo.map((colour) => [...colour] as const),
          sliderTrackOverride: beatmap.colours.sliderTrackOverride
            ? [...beatmap.colours.sliderTrackOverride] as const
            : undefined,
          sliderBorder: beatmap.colours.sliderBorder ? [...beatmap.colours.sliderBorder] as const : undefined,
        }
      : undefined,
    hitObjects: beatmap.hitObjects.map(cloneHitObject),
    extraSections: beatmap.extraSections?.map((section) => ({ name: section.name, lines: [...section.lines] })),
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
