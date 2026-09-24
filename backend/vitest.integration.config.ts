import { defineConfig } from 'vitest/config'
import path from 'path'

// Config de tests de INTEGRACIÓN — corren contra PostgreSQL y Redis REALES
// (no mocks). Se activan explícitamente:  pnpm run test:integration
// Requieren: DATABASE_URL apuntando a una DB con migraciones + seeds aplicadas
// (los workflows del CI levantan el servicio Postgres y corren migrate deploy
//  + seeds antes de testear).
export default defineConfig({
  resolve: {
    alias: {
      '@prisma/client': path.resolve(__dirname, './node_modules/@prisma/client'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // SOLO la carpeta de integración — los unit tests usan la config normal
    include: ['src/__tests__/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Secuencial: los tests comparten la DB y hay flujos con números de venta
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    coverage: { provider: 'v8', include: ['src/**/*.ts'] },
  },
})
