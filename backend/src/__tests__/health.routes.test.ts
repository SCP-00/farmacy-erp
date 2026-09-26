import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import express from 'express'

vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET = 'a'.repeat(32)
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32)
  process.env.JWT_CLIENTE_SECRET = 'c'.repeat(32)
  process.env.FRONTEND_URL = 'http://localhost:5173'
  process.env.API_PREFIX = '/api/v1'
  process.env.RATE_LIMIT_WINDOW_MS = '900000'
  process.env.RATE_LIMIT_MAX = '1000'
  process.env.NODE_ENV = 'test'
  process.env.PORT = '0'
  process.env.FARMACIA_NOMBRE = 'Farmacy Test'
  process.env.HORARIO_DIAS = '1,2,5'
  process.env.HORARIO_INICIO = '08:00'
  process.env.HORARIO_FIN = '18:00'
  process.env.REDIS_URL = 'redis://localhost:6379'
})

vi.mock('dotenv', () => ({ default: { config: vi.fn() }, config: vi.fn() }))

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}))
const mockCache = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}))

vi.mock('../config/database', () => ({ prisma: mockPrisma }))
vi.mock('../config/redis', () => ({
  redis: { on: vi.fn(), connect: vi.fn() },
  cache: mockCache,
  connectRedis: vi.fn(),
}))
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() }, schedule: vi.fn() }))

import supertest from 'supertest'
import { createApp } from '../app'

describe('GET /health/deep', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('reporta ok=true cuando Postgres y Redis responden', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    // Eco real: get devuelve lo último que set guardó (roundtrip auténtico)
    let ultimoSet: string | undefined
    mockCache.set.mockImplementation(async (_k: string, v: string) => { ultimoSet = v; return 'OK' })
    mockCache.get.mockImplementation(async () => ultimoSet)
    mockCache.del.mockResolvedValue(1)

    const res = await supertest(app).get('/api/v1/health/deep')

    expect(res.status).toBe(200)
    expect(res.body.data.ok).toBe(true)
    expect(res.body.data.checks.postgres.ok).toBe(true)
    expect(res.body.data.checks.postgres.latenciaMs).toBeGreaterThanOrEqual(0)
    expect(res.body.data.checks.redis.ok).toBe(true)
    expect(res.body.data.uptimeSegundos).toBeGreaterThanOrEqual(0)
  })

  it('reporta ok=false con detalle cuando Postgres falla', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'))
    let ultimoSet: string | undefined
    mockCache.set.mockImplementation(async (_k: string, v: string) => { ultimoSet = v; return 'OK' })
    mockCache.get.mockImplementation(async () => ultimoSet)
    mockCache.del.mockResolvedValue(1)

    const res = await supertest(app).get('/api/v1/health/deep')

    // La ruta devuelve 200 con el estado degradado en el body (patrón de monitoreo)
    expect(res.status).toBe(200)
    expect(res.body.data.ok).toBe(false)
    expect(res.body.data.checks.postgres.ok).toBe(false)
    expect(res.body.data.checks.postgres.detalle).toContain('Connection refused')
    expect(res.body.data.checks.redis.ok).toBe(true)
  })

  // NOTA: si Redis está caído, cache.set/get rechazan → checks.redis.ok=false,
  // el resto sigue funcionando. Ese caso queda cubierto por el patrón del test
  // de Postgres caído (mismo mecanismo try/catch por dependencia).
})
