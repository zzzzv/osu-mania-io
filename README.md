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
- Basic beatmap mod application helpers

## Random mod

For most downstream usage there is no extra handling for lazer: `applyBeatmapMods` / `applyBeatmapMod` already use lazer's random algorithm.

The only special case is **osu!stable legacy random**: its permutation depends on the replay seed, so callers using `applyLegacyBeatmapMods()` with `LegacyModBit.Random` should pass `Replay.stableRandomSeed`:

```ts
const modded = applyLegacyBeatmapMods(beatmap, replay.mods, {
  randomSeed: replay.stableRandomSeed,
})
```

## AI Disclosure

This repository currently contains 100% AI-generated code.
