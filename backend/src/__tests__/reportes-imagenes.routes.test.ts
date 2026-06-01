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
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
  process.env.CLOUDINARY_API_KEY = 'test-key'
  process.env.CLOUDINARY_API_SECRET = 'test-secret'
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
  lote: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
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
  $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  $transaction: vi.fn(),
  movimientoInventario: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
  ordenCompra: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
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
    verificar: vi.fn(() => { throw new Error('Token inválido') }),
    firmar: vi.fn(() => 'fake-client-token'),
  },
  jwtTemp: {
    firmar: vi.fn(() => 'fake-temp-token'),
    verificar: vi.fn(() => ({})),
  },
}))

// Mock Cloudinary
vi.mock('cloudinary', () => ({
  default: {
    v2: { config: vi.fn(), uploader: { upload_stream: vi.fn(), destroy: vi.fn() } },
  },
  v2: { config: vi.fn(), uploader: { upload_stream: vi.fn(), destroy: vi.fn() } },
}))

// Mock Multer
vi.mock('multer', () => {
  const memoryStorage = () => ({})
  const multerFn = (_options?: any) => ({
    single: () => (req: any, _res: any, next: any) => { req.file = undefined; next() },
  })
  multerFn.memoryStorage = memoryStorage
  return { default: multerFn }
})

import supertest from 'supertest'
import { createApp } from '../app'

const apiPrefix = '/api/v1'

// ── REPORTES ──────────────────────────────────────────────
describe('Reportes Routes - GET /reportes/ventas', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/reportes/ventas`)
    expect(res.status).toBe(401)
  })

  it('rechaza con rol no autorizado', async () => {
    const res = await supertest(app).get(`${apiPrefix}/reportes/ventas`)
      .set('Authorization', 'Bearer valid-auxiliar-token')
    expect(res.status).toBe(403)
  })

  it('retorna reporte de ventas con totales, por día, por método y lista de ventas', async () => {
    mockPrisma.venta.aggregate
      .mockResolvedValueOnce({ _sum: { total: 1000000, descuento: 50000 }, _count: { id: 20 }, _avg: { total: 50000 } })
      .mockResolvedValueOnce({ _sum: { total: 1000000 }, _count: { id: 20 }, _avg: { total: 50000 } })
    mockPrisma.venta.groupBy
      .mockResolvedValueOnce([{ metodoPago: 'EFECTIVO', _sum: { total: 600000 }, _count: { id: 12 } }])
    mockPrisma.venta.findMany
      .mockResolvedValueOnce([{ id: 'v-1', numero: 1, creadoEn: new Date(), total: 50000, estado: 'PAGADO', metodoPago: 'EFECTIVO', cliente: { nombre: 'Juan', apellido: 'Pérez' } }])
      .mockResolvedValueOnce([{ clienteId: 'c-1' }])
    mockPrisma.sucursal.findMany.mockResolvedValue([{ id: 1, nombre: 'Sede Centro' }])
    const res = await supertest(app).get(`${apiPrefix}/reportes/ventas`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data.totales).toBeDefined()
    expect(res.body.data.porDia).toBeDefined()
    expect(res.body.data.porMetodo).toBeDefined()
    expect(res.body.data.ventas).toBeDefined()
    expect(res.body.data.ventas).toHaveLength(1)
    expect(res.body.data.clientesUnicos).toBe(1)
    expect(res.body.data.sucursales).toBeDefined()
  })

  it('filtra por fechas', async () => {
    mockPrisma.venta.aggregate
      .mockResolvedValue({ _sum: { total: 0, descuento: 0 }, _count: { id: 0 }, _avg: { total: 0 } })
    mockPrisma.venta.groupBy.mockResolvedValue([])
    mockPrisma.venta.findMany.mockResolvedValue([]).mockResolvedValue([])
    mockPrisma.sucursal.findMany.mockResolvedValue([])
    const res = await supertest(app).get(`${apiPrefix}/reportes/ventas?desde=2026-01-01&hasta=2026-12-31`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
  })

  it('filtra por estado PENDIENTE', async () => {
    mockPrisma.venta.aggregate
      .mockResolvedValue({ _sum: { total: 12000, descuento: 0 }, _count: { id: 1 }, _avg: { total: 12000 } })
    mockPrisma.venta.groupBy.mockResolvedValue([])
    mockPrisma.venta.findMany
      .mockResolvedValueOnce([{ id: 'v-pend', numero: 99, creadoEn: new Date(), total: 12000, estado: 'PENDIENTE', metodoPago: 'EFECTIVO', cliente: { nombre: 'Test', apellido: 'User' } }])
      .mockResolvedValueOnce([])
    mockPrisma.sucursal.findMany.mockResolvedValue([])
    const res = await supertest(app).get(`${apiPrefix}/reportes/ventas?estado=PENDIENTE`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data.ventas).toHaveLength(1)
    expect(res.body.data.ventas[0].estado).toBe('PENDIENTE')
  })

  it('maneja error interno', async () => {
    mockPrisma.venta.aggregate.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/reportes/ventas`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(500)
  })
})

describe('Reportes Routes - GET /reportes/inventario', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna reporte de inventario', async () => {
    mockPrisma.lote.aggregate.mockResolvedValue({ _sum: { cantidadActual: 5000 } })
    mockPrisma.producto.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3)
    mockPrisma.lote.findMany.mockResolvedValue([
      { producto: { nombre: 'Acetaminofén' }, codigoLote: 'LOT-001', cantidadActual: 10, fechaVencimiento: new Date('2026-06-01'), id: 'lote-1', loteId: null, productoId: 'p-1', sucursalId: 1, proveedorId: null, ordenCompraId: null, precioCompra: 15000, cantidadInicial: 10, creadoEn: new Date(), actualizadoEn: new Date() },
    ])
    const res = await supertest(app).get(`${apiPrefix}/reportes/inventario`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data.stockTotal).toBe(5000)
    expect(res.body.data.stockCritico).toBe(5)
    expect(res.body.data.agotados).toBe(3)
    expect(res.body.data.porVencer).toHaveLength(1)
  })

  it('maneja error interno', async () => {
    mockPrisma.lote.aggregate.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/reportes/inventario`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(500)
  })
})

describe('Reportes Routes - GET /reportes/compras', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/reportes/compras`)
    expect(res.status).toBe(401)
  })

  it('rechaza con rol no autorizado', async () => {
    const res = await supertest(app).get(`${apiPrefix}/reportes/compras`)
      .set('Authorization', 'Bearer valid-auxiliar-token')
    expect(res.status).toBe(403)
  })

  it('retorna reporte de compras con totales, por mes y por proveedor', async () => {
    mockPrisma.ordenCompra.aggregate.mockResolvedValue({ _sum: { total: 2000000 }, _count: { id: 15 }, _avg: { total: 133333 } })
    mockPrisma.ordenCompra.groupBy
      .mockResolvedValue([{ proveedorId: 'prov-1', _sum: { total: 2000000 }, _count: { id: 15 } }])
    const res = await supertest(app).get(`${apiPrefix}/reportes/compras`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data.totales._sum.total).toBe(2000000)
    expect(res.body.data.porProveedor).toHaveLength(1)
  })

  it('filtra por fechas', async () => {
    mockPrisma.ordenCompra.aggregate.mockResolvedValue({ _sum: { total: 0 }, _count: { id: 0 }, _avg: { total: 0 } })
    mockPrisma.ordenCompra.groupBy.mockResolvedValue([]).mockResolvedValue([])
    const res = await supertest(app).get(`${apiPrefix}/reportes/compras?desde=2026-01-01&hasta=2026-06-30`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
  })

  it('maneja error interno', async () => {
    mockPrisma.ordenCompra.aggregate.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/reportes/compras`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(500)
  })
})

describe('Reportes Routes - GET /reportes/:tipo/csv', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/reportes/ventas/csv`)
    expect(res.status).toBe(401)
  })

  it('exporta CSV de ventas', async () => {
    mockPrisma.venta.findMany.mockResolvedValue([
      { creadoEn: new Date('2026-05-01'), numero: 'V-001', total: 50000, estado: 'PAGADO', metodoPago: 'EFECTIVO', cliente: { nombre: 'Juan', apellido: 'Pérez' } },
      { creadoEn: new Date('2026-05-02'), numero: 'V-002', total: 30000, estado: 'PAGADO', metodoPago: 'TRANSFERENCIA', cliente: null },
    ])
    const res = await supertest(app).get(`${apiPrefix}/reportes/ventas/csv`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.header['content-type']).toContain('text/csv')
    expect(res.text).toContain('V-001')
    expect(res.text).toContain('Mostrador')
    expect(res.text).toContain('Juan Pérez')
  })

  it('exporta CSV de compras', async () => {
    mockPrisma.ordenCompra.findMany.mockResolvedValue([
      { creadoEn: new Date('2026-05-01'), total: 200000, estado: 'RECIBIDA', proveedor: { nombre: 'Proveedor XYZ' } },
    ])
    const res = await supertest(app).get(`${apiPrefix}/reportes/compras/csv`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Proveedor XYZ')
  })

  it('exporta CSV de inventario', async () => {
    mockPrisma.lote.findMany.mockResolvedValue([
      { codigoLote: 'LOT-001', cantidadActual: 50, fechaVencimiento: new Date('2026-12-31'), precioCompra: 15000, producto: { nombre: 'Acetaminofén' } },
    ])
    const res = await supertest(app).get(`${apiPrefix}/reportes/inventario/csv`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Acetaminofén')
    expect(res.text).toContain('LOT-001')
  })

  it('retorna 400 para tipo de reporte no soportado', async () => {
    const res = await supertest(app).get(`${apiPrefix}/reportes/clientes/csv`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(400)
    // El handler setea Content-Type: text/csv primero, así que res.body no se parsea como JSON
    expect(res.text).toContain('no soportado')
  })

  it('maneja error interno en CSV', async () => {
    mockPrisma.venta.findMany.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/reportes/ventas/csv`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(500)
  })
})

// ── IMÁGENES ──────────────────────────────────────────────
describe('Imagenes Routes - POST /imagenes/subir', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).post(`${apiPrefix}/imagenes/subir`)
    expect(res.status).toBe(401)
  })

  it('rechaza con rol no autorizado', async () => {
    const res = await supertest(app).post(`${apiPrefix}/imagenes/subir`)
      .set('Authorization', 'Bearer valid-farmaceuta-token')
    expect(res.status).toBe(403)
  })

  it('rechaza si no se envía imagen', async () => {
    const res = await supertest(app).post(`${apiPrefix}/imagenes/subir`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(400)
  })
})

describe('Imagenes Routes - DELETE /imagenes/:publicId', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).delete(`${apiPrefix}/imagenes/test-public-id`)
    expect(res.status).toBe(401)
  })

  it('rechaza con rol no autorizado (solo ADMIN)', async () => {
    const res = await supertest(app).delete(`${apiPrefix}/imagenes/test-public-id`)
      .set('Authorization', 'Bearer valid-auxiliar-token')
    expect(res.status).toBe(403)
  })
})
