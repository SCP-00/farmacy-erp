import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@prisma/client': path.resolve(__dirname, './node_modules/@prisma/client'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    // La integración corre con vitest.integration.config.ts (singleFork,
    // tras migrate+seed en CI) — incluir aquí los hace chocar en paralelo
    // contra la misma DB (limpieza de tests concurrentes).
    exclude: ['node_modules', 'dist', 'src/__tests__/integration/**'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**',
      ],
      reportsDirectory: './coverage',
    },
  },
})
