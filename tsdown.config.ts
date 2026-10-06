import { defineConfig } from 'tsdown'
import type { UserConfig } from 'tsdown'

const config: UserConfig = defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  deps: { neverBundle: ['ts-pattern'] },
  dts: true,
  sourcemap: true,
  clean: true
})

export default config
