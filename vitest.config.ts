import { defineConfig } from 'vitest/config'
import type { ViteUserConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'lcov', 'html'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
})

export default config
