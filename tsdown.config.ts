import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/beatmap/index.ts', 'src/mod/index.ts', 'src/replay/index.ts', 'src/node.ts'],
  dts: {
    tsgo: true,
  },
  exports: true,
  // ...config options
})
