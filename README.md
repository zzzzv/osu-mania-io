# osu-mania-io

TypeScript IO tools for osu!mania beatmaps (.osu) and replays (.osr).

This library is primarily built to support osu!lazer-style mod handling and mania random mod workflows.

It does not include osu!standard-to-mania chart conversion, which is not a common mania use case.

If you need a broader, full-featured osu! parsing library across rulesets and formats, use [osu-parsers](https://github.com/kionell/osu-parsers).

## Status

This project is still in active development. The public API may change.

## Entry Points

- Browser-friendly entry: `osu-mania-io`
- Node.js file IO entry: `osu-mania-io/node`

## Scope

- Mania-only beatmap parsing and serialization
- Mania replay parsing and serialization
- Beatmap mod application helpers
- Timing lookups (BPM, scroll velocity) and osu!mania judgement windows

## Beatmap fidelity

Every key documented by the official `.osu` file format is modelled, including
`Mode`, `StackLeniency`, `ApproachRate`, the `[Colours]` section, video/background
events (with offsets), and storyboard lines. Sections this library does not model,
such as `[Variables]`, are kept verbatim in `Beatmap.extraSections`, and the source
`osu file format vN` version is preserved in `Beatmap.fileFormat`.

Undocumented keys written by osu!lazer are modelled as they are found in real
exports (currently the editor's `VelocityPresets`); other unknown keys inside a
known section are dropped.

`parseBeatmap` validates strictly by default: it rejects beatmaps that are not
`Mode: 3` and raises on malformed values. Pass `{ strict: false }` to accept
non-mania maps and to skip unparseable lines instead.

```ts
const beatmap = parseBeatmap(text)

beatmap.hitObjects[0]?.column // zero-based lane, never a raw x position
beatmap.colours?.combo // [[r, g, b], ...]
beatmap.events?.background // { filename, xOffset, yOffset }
beatmap.events?.breaks // break periods live on the events section only
```

## Timing

```ts
import { createTimingResolver, getBpmAt, getScrollVelocityAt } from 'osu-mania-io'

const resolver = createTimingResolver(beatmap.controlPoints)

resolver.bpmAt(12000) // 180
resolver.scrollVelocityAt(12000) // 1.5
```

`getBpmAt` / `getScrollVelocityAt` / `getBeatLengthAt` are convenience wrappers that
build a resolver per call; reuse `createTimingResolver` when resolving many timestamps.

## Mods

`applyBeatmapMods` / `applyBeatmapMod` apply lazer mods in the order given and return a
`ModdedBeatmap`:

```ts
const modded = applyBeatmapMods(beatmap, [
  { acronym: 'DA', settings: { overallDifficulty: 9.4 } },
  { acronym: 'HR' },
])

modded.speedMultiplier // clock rate, 1.5 for DT
modded.difficultyMultiplier // hit window multiplier, 1.4 for HR
modded.appliedMods // ['DA', 'HR']
modded.ignoredMods // mods with no beatmap-level effect here, such as 'CL'
```

Hit object times stay in beatmap time, matching osu!lazer where the rate comes from the
gameplay clock. Combine both values when computing windows:

```ts
const windows = computeManiaHitWindows({
  overallDifficulty: modded.difficulty.overallDifficulty,
  speedMultiplier: modded.speedMultiplier,
  difficultyMultiplier: modded.difficultyMultiplier,
})
```

Supported mods: `DA`, `DT`/`NC`/`HT`/`DC`, `EZ`, `HR`, `IN`, `HO`, `MR`, `RD`.
`CL` (Classic) is intentionally not applied yet: it can originate either from an
imported osu!stable score or from a lazer play with the Classic mod.

Beatmap transforms do not cover `CS` (render-only) or `DS`/`1K`-`10K` (no effect on
mania-native beatmaps), matching osu!lazer.

## Random mod

`applyBeatmapMods` / `applyBeatmapMod` use lazer's algorithm and therefore require a
seed, which lazer always stores in the score (`settings.seed`). A missing seed throws
instead of silently producing a wrong permutation.

**osu!stable legacy random** derives its permutation from the replay seed, so pass
`Replay.stableRandomSeed`:

```ts
const modded = applyLegacyBeatmapMods(beatmap, replay.mods, {
  randomSeed: replay.stableRandomSeed,
})
```

## Replays

The key count may be passed directly or taken from a parsed beatmap:

```ts
const replay = readReplayFile(path, beatmap)

replay.frames[0]?.columns // one boolean per lane
replay.stableRandomSeed // seed stored by osu!stable's random mod
replay.lazer?.mods // lazer score payload, when present
```

The container follows osu!lazer's `LegacyScoreDecoder`: legacy replay fixes are applied
(pseudo frames and out-of-order timestamps), the online score id is read with the width
its `gameVersion` implies, and the trailing lazer score payload is only read for
`gameVersion >= 30000001`. osu!lazer never rewrites imported osu!stable `.osr` files, so
legacy layouts are always parsed as-is.

## Tests

```bash
pnpm test -- --run
```

Committed fixtures:

- `tests/fixtures/pupa/` — 7K beatmap plus lazer and osu!stable replays, used by the random mod tests and the real-play mod tests
- `tests/fixtures/keysound/` — real 4K keysound beatmap (custom hit sample filenames, storyboard samples, background)
- `tests/fixtures/keycount/` — real 10K beatmap
- `tests/fixtures/video/` — real osu!lazer export (v128, UTF-8 BOM) with a video event

Real-play fixtures are claimed by the mods osu!lazer recorded inside the replay:
dropping an `IN`, `HO`, `DA` or `HT` replay anywhere under `tests/fixtures/pupa/`,
with any file name, enables the matching test automatically (and it is skipped
until then). The beatmap is always `pupa/another.osu`, verified against the
replay's beatmap hash.

## AI Disclosure

This repository currently contains 100% AI-generated code.
