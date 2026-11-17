import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/beatmap/index.ts', 'src/mod/index.ts', 'src/replay/index.ts', 'src/node.ts'],
  dts: {
    tsgo: true,
  },
  // `package.json` is the source of truth for `exports`: tsdown's `exports: true`
  // rewrites it on every build and drops the explicit `types` conditions.
  exports: false,
})
