import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/main/notes/**/*.test.ts'],
    environment: 'node'
  }
})
