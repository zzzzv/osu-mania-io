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

## Unsupported

- **Stable random mod permutation** — The column shuffle algorithm used by osu!stable's random mode is unknown. Applying stable `random` will not produce correct results. Only lazer's RD (Random) mod permutation algorithm is supported.

## AI Disclosure

This repository currently contains 100% AI-generated code.
