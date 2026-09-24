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
  venta: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  lote: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn() },
  configParam: { findUnique: vi.fn().mockResolvedValue({ clave: 'DEVOLUCION_DIAS_LIMITE', valor: '15' }) },
  inventario: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  caja: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  cajaMovimiento: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
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
  devolucion: { create: vi.fn() },
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
vi.mock('../services/ventas.service', () => ({ VentasService: { registrarVenta: vi.fn() } }))

vi.mock('../utils/jwt.utils', () => ({
  jwtEmpleado: {
    verificar: vi.fn((token: string) => {
      if (token === 'valid-admin-token') return { id: 'emp-1', nombre: 'Admin', email: 'admin@test.com', rol: 'ADMINISTRADOR', sucursalId: 1 }
      if (token === 'valid-auxiliar-token') return { id: 'emp-3', nombre: 'Auxiliar', email: 'aux@test.com', rol: 'AUXILIAR', sucursalId: 1 }
      throw new Error('Token inválido')
    }),
    firmar: vi.fn(() => 'fake-token'),
    firmarRefresh: vi.fn(() => 'fake-refresh-token'),
    verificarRefresh: vi.fn(() => ({ id: 'emp-1' })),
  },
  jwtCliente: {
    verificar: vi.fn(() => { throw new Error('Token inválido') }),
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

describe('Ventas Routes - GET /ventas/dashboard', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/ventas/dashboard`)
    expect(res.status).toBe(401)
  })

  it('rechaza con rol no autorizado', async () => {
    const res = await supertest(app).get(`${apiPrefix}/ventas/dashboard`)
      .set('Authorization', 'Bearer valid-auxiliar-token')
    expect(res.status).toBe(403)
  })

  it('retorna dashboard con métricas', async () => {
    mockPrisma.venta.aggregate.mockResolvedValue({ _sum: { total: 500000 }, _count: { id: 10 } })
    mockPrisma.producto.count.mockResolvedValue(3)
    mockPrisma.lote.count.mockResolvedValue(5)
    const res = await supertest(app).get(`${apiPrefix}/ventas/dashboard`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data.total_dia).toBe(500000)
    expect(res.body.data.transacciones).toBe(10)
    expect(res.body.data.stock_critico).toBe(3)
    expect(res.body.data.por_vencer).toBe(5)
  })

  it('maneja error interno', async () => {
    mockPrisma.venta.aggregate.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/ventas/dashboard`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(500)
  })
})

describe('Ventas Routes - GET /ventas', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/ventas`)
    expect(res.status).toBe(401)
  })

  it('retorna lista paginada para admin (todas las sucursales)', async () => {
    mockPrisma.venta.count.mockResolvedValue(1)
    mockPrisma.venta.findMany.mockResolvedValue([{
      id: 'venta-1', numero: 'V-001', total: 50000, estado: 'PAGADO',
      creadoEn: new Date(), empleado: { nombre: 'Admin', apellido: 'Sistema' },
      cliente: { nombre: 'Juan', apellido: 'Pérez' },
      caja: { sucursal: { nombre: 'Principal' } },
      _count: { detalles: 3 },
    }])
    const res = await supertest(app).get(`${apiPrefix}/ventas`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].cajero).toBe('Admin Sistema')
    expect(res.body.data[0].cliente).toBe('Juan Pérez')
    expect(res.body.data[0].sucursal).toBe('Principal')
    expect(res.body.data[0].items).toBe(3)
  })

  it('retorna lista vacía si no hay ventas', async () => {
    mockPrisma.venta.count.mockResolvedValue(0)
    mockPrisma.venta.findMany.mockResolvedValue([])
    const res = await supertest(app).get(`${apiPrefix}/ventas`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('filtra por estado', async () => {
    mockPrisma.venta.count.mockResolvedValue(1)
    mockPrisma.venta.findMany.mockResolvedValue([{ id: 'v-1', numero: 'V-001', total: 50000, estado: 'PAGADO', creadoEn: new Date(), empleado: { nombre: 'A', apellido: 'B' }, cliente: null, caja: { sucursal: { nombre: 'P' } }, _count: { detalles: 2 } }])
    const res = await supertest(app).get(`${apiPrefix}/ventas?estado=PAGADO`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
  })

  it('maneja error interno', async () => {
    mockPrisma.venta.count.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/ventas`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(500)
  })
})

describe('Ventas Routes - POST /ventas', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).post(`${apiPrefix}/ventas`).send({})
    expect(res.status).toBe(401)
  })

  it('registra venta exitosamente', async () => {
    const VentasService = (await import('../services/ventas.service')).VentasService
    vi.mocked(VentasService.registrarVenta).mockResolvedValue({
      id: 'venta-1', numero: 'V-001', total: 50000,
    })
    const res = await supertest(app).post(`${apiPrefix}/ventas`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({
        sucursalId: 1, cajaId: '11111111-1111-4111-1111-111111111111',
        metodoPago: 'EFECTIVO', items: [{ productoId: '22222222-2222-4222-2222-222222222222', cantidad: 2, precioUnitario: 2500 }],
      })
    expect(res.status).toBe(201)
    expect(res.body.data.ventaNum).toBe('V-001')
  })

  it('retorna 400 si el servicio lanza error', async () => {
    const VentasService = (await import('../services/ventas.service')).VentasService
    vi.mocked(VentasService.registrarVenta).mockRejectedValue(new Error('Stock insuficiente'))
    const res = await supertest(app).post(`${apiPrefix}/ventas`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ sucursalId: 1, cajaId: '11111111-1111-4111-1111-111111111111', metodoPago: 'EFECTIVO', items: [{ productoId: '22222222-2222-4222-2222-222222222222', cantidad: 1, precioUnitario: 1000 }] })
    expect(res.status).toBe(400)
  })
})

describe('Ventas Routes - POST /ventas/:id/devolucion', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).post(`${apiPrefix}/ventas/v-1/devolucion`).send({ motivo: 'Defectuoso' })
    expect(res.status).toBe(401)
  })

  it('retorna 404 si venta no existe', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue(null)
    const res = await supertest(app).post(`${apiPrefix}/ventas/v-999/devolucion`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ motivo: 'Defectuoso' })
    expect(res.status).toBe(404)
  })

  it('rechaza devolución si ya existe', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: 'v-1', estado: 'PAGADO', creadoEn: new Date(),
      total: 50000, devolucion: { id: 'dev-1' }, detalles: [],
    })
    const res = await supertest(app).post(`${apiPrefix}/ventas/v-1/devolucion`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ motivo: 'Defectuoso' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('ya tiene una devolución')
  })

  it('rechaza devolución de venta no pagada', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: 'v-1', estado: 'PENDIENTE', creadoEn: new Date(),
      total: 50000, devolucion: null, detalles: [],
    })
    const res = await supertest(app).post(`${apiPrefix}/ventas/v-1/devolucion`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ motivo: 'Defectuoso' })
    expect(res.status).toBe(400)
  })

  it('rechaza devolución después de 15 días', async () => {
    const fechaVieja = new Date()
    fechaVieja.setDate(fechaVieja.getDate() - 20)
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: 'v-1', estado: 'PAGADO', creadoEn: fechaVieja,
      total: 50000, devolucion: null, detalles: [],
    })
    const res = await supertest(app).post(`${apiPrefix}/ventas/v-1/devolucion`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ motivo: 'Defectuoso' })
    expect(res.status).toBe(400)
  })

  it('procesa devolución exitosamente con reintegro de stock', async () => {
    const fechaReciente = new Date()
    fechaReciente.setDate(fechaReciente.getDate() - 5)
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: 'v-1', estado: 'PAGADO', creadoEn: fechaReciente,
      total: 50000, devolucion: null,
      detalles: [{ loteId: 'lote-1', cantidad: 2, productoId: 'prod-1', precioUnitario: 2500, subtotal: 5000, id: 'det-1' }],
    })
    mockPrisma.lote.findUnique.mockResolvedValue({ id: 'lote-1', fechaVencimiento: new Date(Date.now() + 30 * 86400000) })
    mockPrisma.$transaction.mockImplementation(async (cb: Function) => cb(mockPrisma))
    const res = await supertest(app).post(`${apiPrefix}/ventas/v-1/devolucion`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ motivo: 'Defectuoso', reintegraStock: true })
    expect(res.status).toBe(200)
    expect(mockPrisma.venta.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v-1' }, data: { estado: 'DEVUELTO' } })
    )
    expect(mockPrisma.devolucion.create).toHaveBeenCalled()
    expect(mockPrisma.lote.update).toHaveBeenCalled()
  })

  it('procesa devolución sin reintegro de stock', async () => {
    const fechaReciente = new Date()
    fechaReciente.setDate(fechaReciente.getDate() - 3)
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: 'v-2', estado: 'PAGADO', creadoEn: fechaReciente,
      total: 30000, devolucion: null,
      detalles: [{ loteId: 'lote-2', cantidad: 1, productoId: 'prod-2', precioUnitario: 30000, subtotal: 30000, id: 'det-2' }],
    })
    mockPrisma.$transaction.mockImplementation(async (cb: Function) => cb(mockPrisma))
    const res = await supertest(app).post(`${apiPrefix}/ventas/v-2/devolucion`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ motivo: 'Cliente insatisfecho', reintegraStock: false })
    expect(res.status).toBe(200)
    expect(mockPrisma.lote.update).not.toHaveBeenCalled()
  })
})
