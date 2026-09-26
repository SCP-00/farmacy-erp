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
  venta: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  lote: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn() },
  inventario: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  caja: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  cajaMovimiento: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
  proveedor: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  compra: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
  detalleCompra: { create: vi.fn(), createMany: vi.fn() },
  pago: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
  reporte: { findMany: vi.fn() },
  logActividad: { create: vi.fn().mockResolvedValue({}) },
  historialCambio: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  chatbotSesion: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
  alertaInventario: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  loteVenta: { create: vi.fn(), createMany: vi.fn() },
  detalleVenta: { create: vi.fn(), createMany: vi.fn() },
  // Subquery unaccent de búsqueda (migración 0005) — vacío = sin matches
  $queryRaw: vi.fn(async () => [] as Array<{ id: string }>),
  $transaction: vi.fn(),
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

const createMockProducto = (overrides: Record<string, any> = {}) => ({
  id: 'prod-1', nombre: 'Acetaminofén', slug: 'acetaminofen', presentacion: 'Tabletas',
  concentracion: '500 mg', laboratorio: 'Genfar', requiereRx: false,
  precioVenta: 2500, imagenUrl: null, cum: '12345', registroInvima: 'INVIMA-2023-001',
  principioActivo: 'Acetaminofén', atc: 'N02BE01', descripcionAtc: 'Analgésicos',
  titular: 'Genfar', expediente: 'EXP-001', formaFarmaceutica: 'Tableta',
  viaAdministracion: 'Oral', estadoCum: 'ACTIVO', estadoRegistro: 'VIGENTE',
  fechaExpedicion: null, fechaVencimientoRegistro: null, fechaActivoCum: null,
  fechaInactivoCum: null, esMuestraMedica: false, alergenos: '', advertencias: '',
  indicaciones: '', contraindicaciones: '', reaccionesAdversas: '',
  interacciones: '', modoUso: '', unidadReferencia: 'Tableta', cantidad: 10,
  unidadMedida: 'unidades', modalidad: 'Venta Libre', ium: null,
  activo: true, stockMinimo: 5,
  categoria: { id: 1, nombre: 'Analgésicos', slug: 'analgesicos', icono: '💊' },
  categoriaId: 1,
  lotes: [{ cantidadActual: 50, fechaVencimiento: new Date('2026-12-31'), codigoLote: 'LOT-001' }],
  ...overrides,
})

describe('Productos Routes - GET /productos/buscar (público)', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna productos cacheados', async () => {
    mockCache.get.mockResolvedValue({ data: [createMockProducto()], meta: { pagina: 1, limite: 20, total: 1, totalPaginas: 1 } })
    const res = await supertest(app).get(`${apiPrefix}/productos/buscar`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('consulta BD si no hay caché', async () => {
    mockCache.get.mockResolvedValue(null)
    mockPrisma.producto.count.mockResolvedValue(1)
    mockPrisma.producto.findMany.mockResolvedValue([createMockProducto()])
    const res = await supertest(app).get(`${apiPrefix}/productos/buscar`)
    expect(res.status).toBe(200)
    expect(res.body.data[0].nombre).toBe('Acetaminofén')
    expect(res.body.data[0].stockTotal).toBe(50)
    expect(res.body.data[0].lotes).toBeUndefined()
  })

  it('filtra por query q', async () => {
    mockCache.get.mockResolvedValue(null)
    mockPrisma.producto.count.mockResolvedValue(1)
    mockPrisma.producto.findMany.mockResolvedValue([createMockProducto()])
    const res = await supertest(app).get(`${apiPrefix}/productos/buscar?q=acetaminofen`)
    expect(res.status).toBe(200)
  })

  it('búsqueda SIN acentos: "acetaminofen" encuentra "Acetaminofén" (migración 0005)', async () => {
    mockCache.get.mockResolvedValue(null)
    // La subquery unaccent devuelve el id del producto con tilde
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'prod-acento' }])
    mockPrisma.producto.count.mockResolvedValue(1)
    mockPrisma.producto.findMany.mockResolvedValue([createMockProducto({ id: 'prod-acento' })])

    const res = await supertest(app).get(`${apiPrefix}/productos/buscar?q=acetaminofen`)
    expect(res.status).toBe(200)
    // La subquery recibió el término normalizado (sin acentos, LIKE %...%)
    const valoresPrimera = mockPrisma.$queryRaw.mock.calls[0].slice(1)
    expect(valoresPrimera).toContain('%acetaminofen%')
    // El where del findMany filtra por los ids de la subquery
    const whereArg = mockPrisma.producto.findMany.mock.calls[0][0].where
    expect(whereArg.id.in).toEqual(['prod-acento'])
  })

  it('búsqueda CON acentos: el término se normaliza igual ("Acetaminofén" → %acetaminofen%)', async () => {
    mockCache.get.mockResolvedValue(null)
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'prod-acento' }])
    mockPrisma.producto.count.mockResolvedValue(1)
    mockPrisma.producto.findMany.mockResolvedValue([createMockProducto()])

    const res = await supertest(app).get(`${apiPrefix}/productos/buscar?q=${encodeURIComponent('Acetaminofén')}`)
    expect(res.status).toBe(200)
    const valoresSegunda = mockPrisma.$queryRaw.mock.calls[0].slice(1)
    expect(valoresSegunda).toContain('%acetaminofen%')
  })

  it('filtra por categoría', async () => {
    mockCache.get.mockResolvedValue(null)
    mockPrisma.producto.count.mockResolvedValue(1)
    mockPrisma.producto.findMany.mockResolvedValue([createMockProducto()])
    const res = await supertest(app).get(`${apiPrefix}/productos/buscar?categoria=analgesicos`)
    expect(res.status).toBe(200)
  })

  it('filtra por rx=true', async () => {
    mockCache.get.mockResolvedValue(null)
    mockPrisma.producto.count.mockResolvedValue(1)
    mockPrisma.producto.findMany.mockResolvedValue([createMockProducto({ requiereRx: true })])
    const res = await supertest(app).get(`${apiPrefix}/productos/buscar?rx=true`)
    expect(res.status).toBe(200)
  })

  it('ordena por precio ascendente', async () => {
    mockCache.get.mockResolvedValue(null)
    mockPrisma.producto.count.mockResolvedValue(2)
    mockPrisma.producto.findMany.mockResolvedValue([
      createMockProducto({ id: 'prod-1', nombre: 'A', precioVenta: 1000 }),
      createMockProducto({ id: 'prod-2', nombre: 'B', precioVenta: 2000 }),
    ])
    const res = await supertest(app).get(`${apiPrefix}/productos/buscar?ordenar=precio_asc`)
    expect(res.status).toBe(200)
  })

  it('retorna array vacío si no hay resultados', async () => {
    mockCache.get.mockResolvedValue(null)
    mockPrisma.producto.count.mockResolvedValue(0)
    mockPrisma.producto.findMany.mockResolvedValue([])
    const res = await supertest(app).get(`${apiPrefix}/productos/buscar?q=zzzzz`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('maneja error interno', async () => {
    mockCache.get.mockResolvedValue(null)
    mockPrisma.producto.count.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/productos/buscar`)
    expect(res.status).toBe(500)
  })
})

describe('Productos Routes - GET /productos (admin)', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).get(`${apiPrefix}/productos`)
    expect(res.status).toBe(401)
  })

  it('retorna lista administrativa con stockTotal y stockBajo', async () => {
    mockPrisma.producto.count.mockResolvedValue(1)
    mockPrisma.producto.findMany.mockResolvedValue([{
      ...createMockProducto(),
      stockMinimo: 10,
      lotes: [{ cantidadActual: 50, fechaVencimiento: new Date('2026-12-31'), codigoLote: 'LOT-001' }],
    }])
    const res = await supertest(app).get(`${apiPrefix}/productos`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data[0].stockTotal).toBe(50)
    expect(res.body.data[0].stockBajo).toBe(false)
    expect(res.body.data[0].proximoVencer).toBeDefined()
  })

  it('marca stockBajo=true cuando stock <= stockMinimo', async () => {
    mockPrisma.producto.count.mockResolvedValue(1)
    mockPrisma.producto.findMany.mockResolvedValue([{
      ...createMockProducto(),
      stockMinimo: 10,
      lotes: [{ cantidadActual: 3, fechaVencimiento: new Date('2026-12-31'), codigoLote: 'LOT-001' }],
    }])
    const res = await supertest(app).get(`${apiPrefix}/productos`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(res.body.data[0].stockBajo).toBe(true)
  })

  it('filtra por query q', async () => {
    mockPrisma.producto.count.mockResolvedValue(1)
    mockPrisma.producto.findMany.mockResolvedValue([createMockProducto()])
    const res = await supertest(app).get(`${apiPrefix}/productos?q=Acetaminofén`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
  })

  it('maneja error interno', async () => {
    mockPrisma.producto.count.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/productos`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(500)
  })
})

describe('Productos Routes - GET /productos/:id (público)', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna producto con lotes disponibles', async () => {
    mockPrisma.producto.findUnique.mockResolvedValue({
      ...createMockProducto(),
      categoria: { id: 1, nombre: 'Analgésicos', slug: 'analgesicos', icono: '💊', descripcion: '', activa: true, orden: 0, creadoEn: new Date(), actualizadoEn: new Date() },
      lotes: [{ id: 'lote-1', cantidadActual: 50, fechaVencimiento: new Date('2026-12-31'), codigoLote: 'LOT-001', sucursal: { nombre: 'Principal' } }],
    })
    const res = await supertest(app).get(`${apiPrefix}/productos/prod-1`)
    expect(res.status).toBe(200)
    expect(res.body.data.nombre).toBe('Acetaminofén')
  })

  it('retorna 404 si producto no existe', async () => {
    mockPrisma.producto.findUnique.mockResolvedValue(null)
    const res = await supertest(app).get(`${apiPrefix}/productos/prod-999`)
    expect(res.status).toBe(404)
  })

  it('maneja error interno', async () => {
    mockPrisma.producto.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/productos/prod-1`)
    expect(res.status).toBe(500)
  })
})

describe('Productos Routes - POST /productos (admin)', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).post(`${apiPrefix}/productos`).send({ nombre: 'Test' })
    expect(res.status).toBe(401)
  })

  it('crea producto exitosamente', async () => {
    mockPrisma.producto.create.mockResolvedValue(createMockProducto())
    const res = await supertest(app).post(`${apiPrefix}/productos`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ nombre: 'Ibuprofeno', precioVenta: 5000, principioActivo: 'Ibuprofeno' })
    expect(res.status).toBe(201)
    expect(mockCache.delPattern).toHaveBeenCalledWith('productos:buscar:*')
  })

  it('maneja conflicto CUM duplicado (P2002)', async () => {
    mockPrisma.producto.create.mockRejectedValue({ code: 'P2002' })
    const res = await supertest(app).post(`${apiPrefix}/productos`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ nombre: 'Ibuprofeno', precioVenta: 5000 })
    expect(res.status).toBe(409)
  })
})

describe('Productos Routes - PATCH /productos/:id (admin)', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('actualiza producto exitosamente', async () => {
    mockPrisma.producto.findUnique.mockResolvedValue(createMockProducto({ precioVenta: 2500 }))
    mockPrisma.producto.update.mockResolvedValue(createMockProducto({ precioVenta: 3000 }))
    const res = await supertest(app).patch(`${apiPrefix}/productos/prod-1`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ precioVenta: 3000 })
    expect(res.status).toBe(200)
    expect(mockCache.delPattern).toHaveBeenCalledWith('productos:buscar:*')
  })
})

describe('Productos Routes - DELETE /productos/:id (admin)', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('desactiva producto exitosamente', async () => {
    mockPrisma.producto.update.mockResolvedValue(createMockProducto({ activo: false }))
    const res = await supertest(app).delete(`${apiPrefix}/productos/prod-1`)
      .set('Authorization', 'Bearer valid-admin-token')
    expect(res.status).toBe(200)
    expect(mockCache.delPattern).toHaveBeenCalledWith('productos:buscar:*')
  })

  it('rechaza con rol AUXILIAR', async () => {
    const res = await supertest(app).delete(`${apiPrefix}/productos/prod-1`)
      .set('Authorization', 'Bearer valid-auxiliar-token')
    expect(res.status).toBe(403)
  })
})
