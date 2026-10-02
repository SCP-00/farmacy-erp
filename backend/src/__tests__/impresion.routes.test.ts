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
  process.env.RATE_LIMIT_AUTH_MAX = '100'
  process.env.NODE_ENV = 'test'
  process.env.PORT = '0'
  process.env.FARMACIA_NOMBRE = 'Farmacy Test'
  process.env.HORARIO_DIAS = '1,2,3,4,5'
  process.env.HORARIO_INICIO = '08:00'
  process.env.HORARIO_FIN = '18:00'
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.GOOGLE_CLIENT_ID = ''
  process.env.GOOGLE_CLIENT_SECRET = ''
})

vi.mock('dotenv', () => ({ default: { config: vi.fn() }, config: vi.fn() }))

const mockPrisma = vi.hoisted(() => {
  const modelo = () => ({ findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn(), deleteMany: vi.fn() })
  return {
    $connect: vi.fn(), $disconnect: vi.fn(), $transaction: vi.fn(),
    configParam: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), upsert: vi.fn() },
    venta: modelo(), caja: modelo(), producto: modelo(), cliente: modelo(), empleado: modelo(),
    categoria: modelo(), sucursal: modelo(), lote: modelo(), codigoDescuento: modelo(),
    pagoTransaccion: modelo(), historialCambio: modelo(),
    logActividad: { create: vi.fn().mockResolvedValue({}) },
  }
})

vi.mock('../config/database', () => ({ prisma: mockPrisma }))
vi.mock('../config/redis', () => ({
  redis: { on: vi.fn(), connect: vi.fn() },
  cache: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn(), delPattern: vi.fn() },
  connectRedis: vi.fn(),
}))
vi.mock('../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock('../config/mailer', () => ({ sendEmail: vi.fn(), emailTemplates: {} }))
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() }, schedule: vi.fn() }))

vi.mock('../utils/jwt.utils', () => ({
  jwtEmpleado: {
    verificar: vi.fn((token: string) => {
      if (token === 'valid-admin-token') return { id: 'emp-1', nombre: 'Admin', email: 'admin@test.com', rol: 'ADMINISTRADOR', sucursalId: 1 }
      if (token === 'valid-farmaceuta-token') return { id: 'emp-2', nombre: 'Farm', email: 'farm@test.com', rol: 'FARMACEUTA', sucursalId: 1 }
      throw new Error('Token inválido')
    }),
    firmar: vi.fn(() => 'fake-token'),
    firmarRefresh: vi.fn(() => 'fake-refresh-token'),
    verificarRefresh: vi.fn(() => ({ id: 'emp-1' })),
  },
  jwtCliente: { verificar: vi.fn(() => { throw new Error('Token inválido') }), firmar: vi.fn(() => 'fake') },
  jwtTemp: { firmar: vi.fn(() => 'fake'), verificar: vi.fn(() => ({})) },
}))

vi.mock('../services/impresion.service', () => ({
  imprimirTirilla: vi.fn(),
  generarTirillaEscPos: vi.fn(),
  obtenerConfigImpresora: vi.fn(),
}))

import supertest from 'supertest'
import { createApp } from '../app'
import { imprimirTirilla, generarTirillaEscPos } from '../services/impresion.service'

const apiPrefix = '/api/v1'
const mockImprimir = vi.mocked(imprimirTirilla)
const mockGenerar = vi.mocked(generarTirillaEscPos)

describe('Impresión — GET /impresion/config', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/impresion/config`)
    expect(res.status).toBe(401)
  })

  it('rechaza a un farmaceuta (solo ADMIN)', async () => {
    const res = await supertest(app).get(`${apiPrefix}/impresion/config`)
      .set('Authorization', 'Bearer valid-farmaceuta-token')
    expect(res.status).toBe(403)
  })

  it('devuelve la lista de configuraciones', async () => {
    mockPrisma.configParam.findMany.mockResolvedValue([
      { clave: 'IMPRESORA_SUCURSAL_1', valor: JSON.stringify({ host: '192.168.1.50', port: 9100 }) },
    ])
    const res = await supertest(app).get(`${apiPrefix}/impresion/config`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data[0].host).toBe('192.168.1.50')
  })
})

describe('Impresión — PUT /impresion/config', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza con 422 si falta el host', async () => {
    const res = await supertest(app).put(`${apiPrefix}/impresion/config`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ port: 9100 })
    expect(res.status).toBe(422)
  })

  it('guarda la configuración de la sucursal', async () => {
    mockPrisma.configParam.upsert.mockResolvedValue({ clave: 'IMPRESORA_SUCURSAL_1', valor: '{}' })
    const res = await supertest(app).put(`${apiPrefix}/impresion/config`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ sucursalId: 1, host: '192.168.1.50', port: 9100, abrirCajon: true })
    expect(res.status).toBe(200)
    const args = mockPrisma.configParam.upsert.mock.calls[0][0]
    expect(args.where.clave).toBe('IMPRESORA_SUCURSAL_1')
    expect(JSON.parse(args.create.valor).port).toBe(9100)
  })

  it('usa la clave de respaldo cuando no hay sucursal', async () => {
    mockPrisma.configParam.upsert.mockResolvedValue({ clave: 'IMPRESORA_DEFAULT', valor: '{}' })
    const res = await supertest(app).put(`${apiPrefix}/impresion/config`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ host: '10.0.0.5' })
    expect(res.status).toBe(200)
    expect(mockPrisma.configParam.upsert.mock.calls[0][0].where.clave).toBe('IMPRESORA_DEFAULT')
  })
})

describe('Impresión — GET /impresion/tirilla/:ventaId', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/impresion/tirilla/venta-1`)
    expect(res.status).toBe(401)
  })

  it('devuelve 404 si la venta no existe', async () => {
    mockGenerar.mockResolvedValue(null)
    const res = await supertest(app).get(`${apiPrefix}/impresion/tirilla/venta-999`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(404)
  })

  it('devuelve los bytes ESC/POS', async () => {
    mockGenerar.mockResolvedValue({ buffer: Buffer.from([0x1b, 0x40, 0x41]), venta: { numero: 118 } })
    const res = await supertest(app).get(`${apiPrefix}/impresion/tirilla/venta-1`)
      .set('Authorization', 'Bearer valid-farmaceuta-token')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/octet-stream')
    expect(res.body[0]).toBe(0x1b)
  })
})

describe('Impresión — POST /impresion/tirilla/:ventaId', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('confirma cuando se imprimió en red', async () => {
    mockImprimir.mockResolvedValue({ impreso: true, bytes: 512, host: '192.168.1.50' })
    const res = await supertest(app).post(`${apiPrefix}/impresion/tirilla/venta-1`)
      .set('Authorization', 'Bearer valid-farmaceuta-token')
      .send({ abrirCajon: true })
    expect(res.status).toBe(200)
    expect(res.body.data.impreso).toBe(true)
  })

  it('devuelve 200 con impreso:false si no hay impresora configurada', async () => {
    mockImprimir.mockResolvedValue({ impreso: false, motivo: 'Sin impresora configurada para la sucursal' })
    const res = await supertest(app).post(`${apiPrefix}/impresion/tirilla/venta-1`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.data.impreso).toBe(false)
  })

  it('devuelve 502 si la impresora falla', async () => {
    mockImprimir.mockRejectedValue(new Error('ECONNREFUSED'))
    const res = await supertest(app).post(`${apiPrefix}/impresion/tirilla/venta-1`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({})
    expect(res.status).toBe(502)
  })
})
