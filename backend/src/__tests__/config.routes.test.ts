import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import express from 'express'

vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET = 'a'.repeat(32)
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32)
  process.env.JWT_CLIENTE_SECRET = 'c'.repeat(32)
  process.env.FRONTEND_URL = 'http://localhost:5173'
  process.env.API_PREFIX = '/api/v1'
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
  configParam: { findMany: vi.fn() },
}))
const cacheStore = vi.hoisted(() => new Map<string, string>())
const mockCache = vi.hoisted(() => ({
  get: vi.fn(async (k: string) => cacheStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => { cacheStore.set(k, v) }),
  del: vi.fn(async (k: string) => { cacheStore.delete(k) }),
  delPattern: vi.fn(async () => 0),
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

describe('GET /config/publico', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => {
    vi.clearAllMocks()
    cacheStore.clear()
  })

  it('solo expone claves de la whitelist (sin secrets)', async () => {
    mockPrisma.configParam.findMany.mockResolvedValue([
      { clave: 'PUNTOS_POR_PESO', valor: '0.02' },
      { clave: 'ENVIO_GRATIS_DESDE', valor: '60000' },
      // Estas NO deben aparecer aunque existan en DB:
      { clave: 'JWT_SECRET', valor: 'secreto' },
      { clave: 'WOMPI_PRIVATE_KEY', valor: 'prv_x' },
    ])

    const res = await supertest(app).get('/api/v1/config/publico')

    expect(res.status).toBe(200)
    expect(res.body.data.PUNTOS_POR_PESO).toBe('0.02')
    expect(res.body.data.ENVIO_GRATIS_DESDE).toBe('60000')
    expect(res.body.data.JWT_SECRET).toBeUndefined()
    expect(res.body.data.WOMPI_PRIVATE_KEY).toBeUndefined()
  })

  it('aplica defaults cuando la farmacia no personalizó', async () => {
    mockPrisma.configParam.findMany.mockResolvedValue([])

    const res = await supertest(app).get('/api/v1/config/publico')

    expect(res.body.data.FARMACIA_NOMBRE).toBe('Farmacy')
    expect(res.body.data.PUNTOS_POR_PESO).toBe('0.01')
  })

  it('sirve desde cache en la segunda llamada (una sola query a DB)', async () => {
    mockPrisma.configParam.findMany.mockResolvedValue([
      { clave: 'TIENDA_LEMA', valor: 'Tu farmacia de barrio' },
    ])

    await supertest(app).get('/api/v1/config/publico')
    await supertest(app).get('/api/v1/config/publico')

    expect(mockPrisma.configParam.findMany).toHaveBeenCalledTimes(1)
    expect(mockCache.set).toHaveBeenCalledWith('config:publico', expect.any(String), 60)
  })
})
