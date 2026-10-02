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

const mockPrisma = vi.hoisted(() => ({
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  cliente: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  empleado: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  producto: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  categoria: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  sucursal: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  venta: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
  lote: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn() },
  inventario: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  caja: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  cajaMovimiento: { findMany: vi.fn(), create: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  proveedor: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  compra: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
  detalleCompra: { create: vi.fn(), createMany: vi.fn() },
  pago: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
  reporte: { findMany: vi.fn() },
  logActividad: { create: vi.fn().mockResolvedValue({}) },
  chatbotSesion: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
  alertaInventario: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  loteVenta: { create: vi.fn(), createMany: vi.fn() },
  detalleVenta: { create: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
  favorito: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
  movimientoInventario: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
  ordenCompra: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
}))

const mockCache = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn(),
  del: vi.fn(),
  delPattern: vi.fn(),
}))

vi.mock('../config/database', () => ({ prisma: mockPrisma }))
vi.mock('../config/redis', () => ({
  redis: { on: vi.fn(), connect: vi.fn() },
  cache: mockCache,
  connectRedis: vi.fn(),
}))
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('../config/mailer', () => ({ sendEmail: vi.fn(), emailTemplates: {} }))
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() }, schedule: vi.fn() }))

vi.mock('../utils/jwt.utils', () => ({
  jwtEmpleado: {
    verificar: vi.fn((token: string) => {
      if (token === 'valid-admin-token') return { id: 'emp-1', nombre: 'Admin', email: 'admin@test.com', rol: 'ADMINISTRADOR', sucursalId: 1 }
      if (token === 'valid-farmaceuta-token') return { id: 'emp-2', nombre: 'Farmaceuta', email: 'farm@test.com', rol: 'FARMACEUTA', sucursalId: 1 }
      if (token === 'valid-auxiliar-token') return { id: 'emp-3', nombre: 'Auxiliar', email: 'aux@test.com', rol: 'AUXILIAR', sucursalId: 1 }
      throw new Error('Token inválido')
    }),
    firmar: vi.fn(() => 'fake-token'),
    firmarRefresh: vi.fn(() => 'fake-refresh-token'),
    verificarRefresh: vi.fn(() => ({ id: 'emp-1' })),
  },
  jwtCliente: {
    verificar: vi.fn((token: string) => {
      if (token === 'valid-client-token') return { id: 'cli-1', nombre: 'Cliente', email: 'cliente@test.com', tipo: 'cliente' }
      throw new Error('Token inválido')
    }),
    firmar: vi.fn(() => 'fake-client-token'),
  },
  jwtTemp: {
    firmar: vi.fn(() => 'fake-temp-token'),
    verificar: vi.fn(() => ({})),
  },
}))

import supertest from 'supertest'
import { createApp } from '../app'

const apiPrefix = '/api/v1'

// ── Helpers de caja ───────────────────────────────────────
const CAJA_ABIERTA = { id: 'caja-1', empleadoId: 'emp-1', montoApertura: 100000, cerradaEn: null, abiertaEn: new Date() }

/** Simula los grupos por método que devuelve venta.groupBy y la ausencia de movimientos. */
function mockResumen({ efectivo = 0, tarjeta = 0, online = 0, count = 1 } = {}) {
  const grupos: any[] = []
  if (efectivo) grupos.push({ metodoPago: 'EFECTIVO', _sum: { total: efectivo }, _count: { _all: count } })
  if (tarjeta)  grupos.push({ metodoPago: 'STRIPE',   _sum: { total: tarjeta },  _count: { _all: count } })
  if (online)   grupos.push({ metodoPago: 'WOMPI',     _sum: { total: online },   _count: { _all: count } })
  mockPrisma.venta.groupBy.mockResolvedValue(grupos)
  mockPrisma.cajaMovimiento.groupBy.mockResolvedValue([])
  mockPrisma.cajaMovimiento.findMany.mockResolvedValue([])
}

// ── CAJA ──────────────────────────────────────────────────
describe('Caja Routes - GET /caja/actual', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/caja/actual`)
    expect(res.status).toBe(401)
  })

  it('rechaza con rol no autorizado', async () => {
    const res = await supertest(app).get(`${apiPrefix}/caja/actual`)
      .set('Authorization', 'Bearer valid-auxiliar-token')
    expect(res.status).toBe(403)
  })

  it('retorna caja abierta cuando existe', async () => {
    mockPrisma.caja.findFirst.mockResolvedValue({
      id: 'caja-1', empleadoId: '1', montoApertura: 500000, cerradaEn: null, abiertaEn: new Date(),
      sucursal: { nombre: 'Principal' },
    })
    const res = await supertest(app).get(`${apiPrefix}/caja/actual`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('caja-1')
  })

  it('retorna null cuando no hay caja abierta', async () => {
    mockPrisma.caja.findFirst.mockResolvedValue(null)
    const res = await supertest(app).get(`${apiPrefix}/caja/actual`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })

  it('maneja error interno', async () => {
    mockPrisma.caja.findFirst.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/caja/actual`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(500)
  })
})

describe('Caja Routes - POST /caja/abrir', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).post(`${apiPrefix}/caja/abrir`).send({ sucursalId: 1, montoApertura: 500000 })
    expect(res.status).toBe(401)
  })

  it('rechaza si ya hay caja abierta', async () => {
    mockPrisma.caja.findFirst.mockResolvedValue({ id: 'caja-1', cerradaEn: null })
    const res = await supertest(app).post(`${apiPrefix}/caja/abrir`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ sucursalId: 1, montoApertura: 500000 })
    expect(res.status).toBe(409)
  })

  it('abre caja exitosamente', async () => {
    mockPrisma.caja.findFirst.mockResolvedValue(null)
    mockPrisma.caja.create.mockResolvedValue({ id: 'caja-nueva', montoApertura: 500000, abiertaEn: new Date() })
    const res = await supertest(app).post(`${apiPrefix}/caja/abrir`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ sucursalId: 1, montoApertura: 500000 })
    expect(res.status).toBe(201)
  })
})

describe('Caja Routes - POST /caja/:id/cerrar', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza si hay ventas pendientes', async () => {
    mockPrisma.caja.findUnique.mockResolvedValue(CAJA_ABIERTA)
    mockPrisma.venta.count.mockResolvedValue(2)
    const res = await supertest(app).post(`${apiPrefix}/caja/caja-1/cerrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ efectivoContado: 1000000 })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('pendientes')
  })

  it('rechaza con 404 si la caja no existe', async () => {
    mockPrisma.caja.findUnique.mockResolvedValue(null)
    const res = await supertest(app).post(`${apiPrefix}/caja/caja-999/cerrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ efectivoContado: 1000 })
    expect(res.status).toBe(404)
  })

  it('rechaza con 409 si la caja ya está cerrada', async () => {
    mockPrisma.caja.findUnique.mockResolvedValue({ ...CAJA_ABIERTA, cerradaEn: new Date() })
    const res = await supertest(app).post(`${apiPrefix}/caja/caja-1/cerrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ efectivoContado: 1000 })
    expect(res.status).toBe(409)
  })

  it('rechaza con 422 si falta el efectivo contado', async () => {
    const res = await supertest(app).post(`${apiPrefix}/caja/caja-1/cerrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ observaciones: 'faltó el arqueo' })
    expect(res.status).toBe(422)
  })

  it('cuadra la caja cuando el efectivo contado iguala el esperado', async () => {
    mockPrisma.caja.findUnique.mockResolvedValue(CAJA_ABIERTA)
    mockPrisma.venta.count.mockResolvedValue(0)
    mockResumen({ efectivo: 900000 })
    mockPrisma.caja.update.mockResolvedValue({ id: 'caja-1', diferencia: 0, cerradaEn: new Date() })
    const res = await supertest(app).post(`${apiPrefix}/caja/caja-1/cerrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ efectivoContado: 1000000 })
    expect(res.status).toBe(200)
    // esperado = apertura 100000 + ventas efectivo 900000 = 1000000
    expect(String(mockPrisma.caja.update.mock.calls[0][0].data.efectivoEsperado)).toBe('1000000')
    expect(mockPrisma.caja.update.mock.calls[0][0].data.diferencia).toBe(0)
  })

  it('registra un faltante como diferencia negativa', async () => {
    mockPrisma.caja.findUnique.mockResolvedValue(CAJA_ABIERTA)
    mockPrisma.venta.count.mockResolvedValue(0)
    mockResumen({ efectivo: 500000 })
    mockPrisma.caja.update.mockResolvedValue({ id: 'caja-1', diferencia: -50000, cerradaEn: new Date() })
    const res = await supertest(app).post(`${apiPrefix}/caja/caja-1/cerrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ efectivoContado: 550000 })
    expect(res.status).toBe(200)
    // esperado = 100000 + 500000 = 600000; contado 550000 → diferencia -50000
    expect(mockPrisma.caja.update.mock.calls[0][0].data.diferencia).toBe(-50000)
  })
})

describe('Caja Routes - GET /caja/:id/resumen', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/caja/caja-1/resumen`)
    expect(res.status).toBe(401)
  })

  it('retorna 404 si la caja no existe', async () => {
    mockPrisma.caja.findUnique.mockResolvedValue(null)
    const res = await supertest(app).get(`${apiPrefix}/caja/caja-999/resumen`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(404)
  })

  it('calcula totales por método y efectivo esperado', async () => {
    mockPrisma.caja.findUnique.mockResolvedValue(CAJA_ABIERTA)
    mockResumen({ efectivo: 500000, tarjeta: 200000, online: 300000 })
    const res = await supertest(app).get(`${apiPrefix}/caja/caja-1/resumen`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data.totalEfectivo).toBe(500000)
    expect(res.body.data.totalTarjeta).toBe(200000)
    expect(res.body.data.totalOnline).toBe(300000)
    expect(res.body.data.totalVentas).toBe(1000000)
    expect(res.body.data.efectivoEsperado).toBe(600000)
  })
})

describe('Caja Routes - GET /caja/actual/resumen', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna null cuando no hay caja abierta', async () => {
    mockPrisma.caja.findFirst.mockResolvedValue(null)
    const res = await supertest(app).get(`${apiPrefix}/caja/actual/resumen`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })

  it('retorna el resumen de la caja abierta', async () => {
    mockPrisma.caja.findFirst.mockResolvedValue(CAJA_ABIERTA)
    mockResumen({ efectivo: 500000 })
    const res = await supertest(app).get(`${apiPrefix}/caja/actual/resumen`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data.efectivoEsperado).toBe(600000)
  })
})

describe('Caja Routes - POST /caja/:id/movimiento', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).post(`${apiPrefix}/caja/caja-1/movimiento`)
      .send({ tipo: 'SANGRIA', monto: 50000, motivo: 'Retiro a caja fuerte' })
    expect(res.status).toBe(401)
  })

  it('rechaza con 422 un monto inválido', async () => {
    const res = await supertest(app).post(`${apiPrefix}/caja/caja-1/movimiento`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ tipo: 'SANGRIA', monto: -5, motivo: 'Retiro' })
    expect(res.status).toBe(422)
  })

  it('rechaza con 409 si la caja está cerrada', async () => {
    mockPrisma.caja.findUnique.mockResolvedValue({ ...CAJA_ABIERTA, cerradaEn: new Date() })
    const res = await supertest(app).post(`${apiPrefix}/caja/caja-1/movimiento`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ tipo: 'SANGRIA', monto: 50000, motivo: 'Retiro a caja fuerte' })
    expect(res.status).toBe(409)
  })

  it('registra una sangría y devuelve el resumen actualizado', async () => {
    mockPrisma.caja.findUnique.mockResolvedValue(CAJA_ABIERTA)
    mockPrisma.cajaMovimiento.create.mockResolvedValue({ id: 'mov-1', tipo: 'SANGRIA', monto: 50000 })
    mockResumen({ efectivo: 500000 })
    const res = await supertest(app).post(`${apiPrefix}/caja/caja-1/movimiento`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ tipo: 'SANGRIA', monto: 50000, motivo: 'Retiro a caja fuerte' })
    expect(res.status).toBe(201)
    expect(res.body.data.movimiento.id).toBe('mov-1')
  })

  it('rechaza con 403 si un farmaceuta opera una caja ajena', async () => {
    mockPrisma.caja.findUnique.mockResolvedValue({ ...CAJA_ABIERTA, empleadoId: 'otro-empleado' })
    const res = await supertest(app).post(`${apiPrefix}/caja/caja-1/movimiento`)
      .set('Authorization', 'Bearer valid-farmaceuta-token')
      .send({ tipo: 'SANGRIA', monto: 50000, motivo: 'Retiro a caja fuerte' })
    expect(res.status).toBe(403)
  })
})

describe('Caja Routes - GET /caja/historial', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna historial para admin (todas las cajas)', async () => {
    mockPrisma.caja.findMany.mockResolvedValue([{ id: 'caja-1', empleado: { nombre: 'A', apellido: 'B' }, sucursal: { nombre: 'P' }, _count: { ventas: 5 } }])
    const res = await supertest(app).get(`${apiPrefix}/caja/historial`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/caja/historial`)
    expect(res.status).toBe(401)
  })
})

// ── CLIENTES ADMIN ────────────────────────────────────────
describe('Clientes Admin Routes - GET /clientes', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/clientes`)
    expect(res.status).toBe(401)
  })

  it('retorna lista paginada de clientes', async () => {
    mockPrisma.cliente.count.mockResolvedValue(1)
    mockPrisma.cliente.findMany.mockResolvedValue([{
      id: 'cli-1', nombre: 'Juan', apellido: 'Pérez',
      email: 'juan@test.com', telefono: '555-0000',
      puntosAcumulados: 100, creadoEn: new Date(),
      _count: { ventas: 3 },
    }])
    const res = await supertest(app).get(`${apiPrefix}/clientes`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.meta.total).toBe(1)
  })

  it('filtra por query q', async () => {
    mockPrisma.cliente.count.mockResolvedValue(1)
    mockPrisma.cliente.findMany.mockResolvedValue([{ id: 'cli-1', nombre: 'Juan', _count: { ventas: 0 } }])
    const res = await supertest(app).get(`${apiPrefix}/clientes?q=Juan`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
  })

  it('retorna array vacío si no hay clientes', async () => {
    mockPrisma.cliente.count.mockResolvedValue(0)
    mockPrisma.cliente.findMany.mockResolvedValue([])
    const res = await supertest(app).get(`${apiPrefix}/clientes`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('maneja error interno', async () => {
    mockPrisma.cliente.count.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/clientes`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(500)
  })
})

describe('Clientes Admin Routes - GET /clientes/:id', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/clientes/cli-1`)
    expect(res.status).toBe(401)
  })

  it('retorna 404 si cliente no existe', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    const res = await supertest(app).get(`${apiPrefix}/clientes/cli-999`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(404)
  })

  it('retorna detalle del cliente', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({
      id: 'cli-1', nombre: 'Juan', apellido: 'Pérez', email: 'juan@test.com',
      ventas: [{ numero: 'V-001', total: 50000, creadoEn: new Date(), estado: 'PAGADO' }],
    })
    const res = await supertest(app).get(`${apiPrefix}/clientes/cli-1`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data.nombre).toBe('Juan')
    expect(res.body.data.ventas).toHaveLength(1)
  })

  it('maneja error interno', async () => {
    mockPrisma.cliente.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/clientes/cli-1`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(500)
  })
})

describe('Clientes Admin Routes - GET /clientes/:id/compras', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/clientes/cli-1/compras`)
    expect(res.status).toBe(401)
  })

  it('retorna 404 si cliente no existe', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    const res = await supertest(app).get(`${apiPrefix}/clientes/cli-999/compras`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(404)
  })

  it('retorna historial de compras del cliente', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({ id: 'cli-1' })
    mockPrisma.venta.findMany.mockResolvedValue([{
      id: 'v-1', numero: 'V-001', total: 50000, estado: 'PAGADO',
      metodoPago: 'EFECTIVO', creadoEn: new Date(),
      detalles: [{ cantidad: 2, precioUnitario: 25000, producto: { nombre: 'Acetaminofén', presentacion: 'Tab x 30' } }],
    }])
    const res = await supertest(app).get(`${apiPrefix}/clientes/cli-1/compras`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].numero).toBe('V-001')
  })

  it('retorna array vacío si no hay compras', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({ id: 'cli-1' })
    mockPrisma.venta.findMany.mockResolvedValue([])
    const res = await supertest(app).get(`${apiPrefix}/clientes/cli-1/compras`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('maneja error interno', async () => {
    mockPrisma.cliente.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/clientes/cli-1/compras`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(500)
  })
})
