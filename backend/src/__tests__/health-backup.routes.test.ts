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
  configParam: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
}))

vi.mock('../config/database', () => ({ prisma: mockPrisma }))
vi.mock('../config/redis', () => ({
  redis: { on: vi.fn(), connect: vi.fn() },
  cache: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  connectRedis: vi.fn(),
}))
vi.mock('../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() }, schedule: vi.fn() }))

import supertest from 'supertest'
import { createApp } from '../app'

describe('GET /health/backup', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('reporta vencido cuando no hay registro de respaldo', async () => {
    mockPrisma.configParam.findUnique.mockResolvedValue(null)
    const res = await supertest(app).get('/api/v1/health/backup')
    expect(res.status).toBe(200)
    expect(res.body.data.vencido).toBe(true)
    expect(res.body.data.ok).toBe(false)
    expect(res.body.data.motivo).toContain('Sin registro')
  })

  it('reporta vigente un respaldo reciente', async () => {
    const fecha = new Date(Date.now() - 2 * 3_600_000).toISOString()
    mockPrisma.configParam.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(where.clave === 'BACKUP_ULTIMO_OK'
        ? { clave: 'BACKUP_ULTIMO_OK', valor: JSON.stringify({ ok: true, fecha }) }
        : null))
    const res = await supertest(app).get('/api/v1/health/backup')
    expect(res.status).toBe(200)
    expect(res.body.data.vencido).toBe(false)
    expect(res.body.data.ok).toBe(true)
    expect(res.body.data.maxHoras).toBe(26)
  })

  it('respeta el límite configurado en BACKUP_MAX_HORAS', async () => {
    const fecha = new Date(Date.now() - 5 * 3_600_000).toISOString()
    mockPrisma.configParam.findUnique.mockImplementation(({ where }: any) => {
      if (where.clave === 'BACKUP_ULTIMO_OK') return Promise.resolve({ valor: JSON.stringify({ ok: true, fecha }) })
      if (where.clave === 'BACKUP_MAX_HORAS') return Promise.resolve({ valor: '4' })
      return Promise.resolve(null)
    })
    const res = await supertest(app).get('/api/v1/health/backup')
    expect(res.status).toBe(200)
    expect(res.body.data.maxHoras).toBe(4)
    expect(res.body.data.vencido).toBe(true)
  })

  it('devuelve 500 si falla la consulta', async () => {
    mockPrisma.configParam.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get('/api/v1/health/backup')
    expect(res.status).toBe(500)
  })
})
