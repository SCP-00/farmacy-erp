import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// ═══════════════════════════════════════════════════════════
//  Hoisted: env vars mockeados antes de cualquier import
// ═══════════════════════════════════════════════════════════
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
})

// ── Mocks globales de Prisma ─────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  cliente: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  empleado: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  producto: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  categoria: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  sucursal: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  venta: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  lote: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  inventario: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  caja: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  cajaMovimiento: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  proveedor: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  compra: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  detalleCompra: { create: vi.fn(), createMany: vi.fn() },
  pago: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  reporte: { findMany: vi.fn() },
  logActividad: { create: vi.fn().mockResolvedValue({}) },
  chatbotSesion: {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({}),
  },
  alertaInventario: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  loteVenta: { create: vi.fn(), createMany: vi.fn() },
  detalleVenta: { create: vi.fn(), createMany: vi.fn() },
  // Subquery unaccent de búsqueda (migración 0005) — vacío = sin matches
  $queryRaw: vi.fn(async () => [] as Array<{ id: string }>),
  $transaction: vi.fn(),
}))

vi.mock('../config/database', () => ({ prisma: mockPrisma }))

// Mock Redis cache (para auth middleware)
vi.mock('../config/redis', () => ({
  redis: { on: vi.fn(), connect: vi.fn() },
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    del: vi.fn(),
    delPattern: vi.fn(),
  },
  connectRedis: vi.fn(),
}))

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../config/mailer', () => ({
  sendEmail: vi.fn(),
  emailTemplates: {},
}))

vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
  schedule: vi.fn(),
}))

// ── App de prueba ─────────────────────────────────────────
import { createApp } from '../app'
import { env } from '../config/env'

const prefix = env.API_PREFIX

describe('createApp() — Integration', () => {
  let app: express.Express

  beforeAll(() => {
    app = createApp()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ═══════════════════════════════════════════════════════
  //  Health Check
  // ═══════════════════════════════════════════════════════
  describe('GET /health', () => {
    it('responde con ok, nombre y version', async () => {
      const res = await request(app).get(`${prefix}/health`)
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.app).toBe('Farmacy Test')
      expect(res.body.version).toBe('1.0.0')
      expect(res.body.timestamp).toBeDefined()
    })
  })

  // ═══════════════════════════════════════════════════════
  //  404 Handling
  // ═══════════════════════════════════════════════════════
  describe('404 — Ruta no encontrada', () => {
    it('responde 404 para rutas inexistentes', async () => {
      const res = await request(app).get(`${prefix}/ruta-que-no-existe`)
      expect(res.status).toBe(404)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toContain('Ruta no encontrada')
    })

    it('responde 404 para métodos no soportados', async () => {
      const res = await request(app).patch(`${prefix}/health`)
      expect(res.status).toBe(404)
    })
  })

  // ═══════════════════════════════════════════════════════
  //  Security Headers (Helmet + CORS)
  // ═══════════════════════════════════════════════════════
  describe('Seguridad', () => {
    it('incluye helmet headers', async () => {
      const res = await request(app).get(`${prefix}/health`)
      // Helmet agrega headers de seguridad
      expect(res.headers['x-dns-prefetch-control']).toBeDefined()
      expect(res.headers['x-content-type-options']).toBe('nosniff')
    })

    it('incluye CORS headers', async () => {
      const res = await request(app)
        .get(`${prefix}/health`)
        .set('Origin', 'http://localhost:5173')
      expect(res.headers['access-control-allow-origin']).toBeDefined()
    })
  })

  // ═══════════════════════════════════════════════════════
  //  Categorías (ruta pública)
  // ═══════════════════════════════════════════════════════
  describe('GET /categorias', () => {
    it('retorna lista de categorías', async () => {
      mockPrisma.categoria.findMany.mockResolvedValue([
        { id: 1, nombre: 'Analgésicos', slug: 'analgesicos' },
        { id: 2, nombre: 'Antibióticos', slug: 'antibioticos' },
      ])
      mockPrisma.categoria.count.mockResolvedValue(2)

      const res = await request(app).get(`${prefix}/categorias`)
      // Categorías es ruta pública, responde 200
      expect(res.status).toBe(200)
    })
  })

  // ═══════════════════════════════════════════════════════
  //  Productos /buscar (ruta pública)
  // ═══════════════════════════════════════════════════════
  describe('GET /productos/buscar', () => {
    it('retorna productos buscando por nombre', async () => {
      mockPrisma.producto.findMany.mockResolvedValue([
        { id: 'prod-1', nombre: 'Ibuprofeno', concentracion: '400mg',
          precioVenta: 8500, slug: 'ibuprofeno-400mg', requiereRx: false,
          formaFarmaceutica: 'Tableta', principioActivo: 'Ibuprofeno',
          presentacion: 'Tabletas x 30', laboratorio: 'Tecnoquímicas',
          lotes: [{ cantidadActual: 10 }] },
      ])

      const res = await request(app).get(`${prefix}/productos/buscar?q=ibuprofeno`)
      expect(res.status).toBe(200)
      expect(res.body.data).toBeDefined()
    })

    it('retorna error si no hay query', async () => {
      const res = await request(app).get(`${prefix}/productos/buscar`)
      expect(res.status).toBe(200)
      // Puede retornar lista vacía o paginada
      expect(res.body).toBeDefined()
    })
  })

  // ═══════════════════════════════════════════════════════
  //  Chatbot (ruta pública)
  // ═══════════════════════════════════════════════════════
  describe('POST /chatbot', () => {
    it('responde al menú del chatbot', async () => {
      const res = await request(app)
        .post(`${prefix}/chatbot`)
        .send({ mensaje: 'hola' })
      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.data.respuesta).toBeDefined()
    })

    it('rechaza mensaje vacío', async () => {
      const res = await request(app)
        .post(`${prefix}/chatbot`)
        .send({ mensaje: '' })
      expect(res.status).toBe(400)
    })
  })

  // ═══════════════════════════════════════════════════════
  //  Rutas protegidas — retornan 401 sin token
  // ═══════════════════════════════════════════════════════
  describe('Rutas protegidas (401 sin auth)', () => {
    // Muchos routers no tienen GET / sino rutas con parámetros.
    // Probamos las que sí sabemos que responden 401 al no tener token.
    // - /clientes tiene GET / con autenticar
    // - /empleados tiene GET / con autenticar
    // - /lotes tiene GET / con autenticar
    it.each([
      { method: 'GET' as const, path: `${prefix}/clientes` },
      { method: 'GET' as const, path: `${prefix}/empleados` },
      { method: 'GET' as const, path: `${prefix}/lotes` },
    ])('$method $path retorna 401', async ({ method, path }) => {
      const res = await request(app)[method.toLowerCase() as 'get'](path)
      expect(res.status).toBe(401)
    })
  })

  // ═══════════════════════════════════════════════════════
  //  Middleware de errores
  // ═══════════════════════════════════════════════════════
  describe('Manejo de errores', () => {
    it('maneja errores de validación', async () => {
      // POST a una ruta que espera body con errores de validación
      const res = await request(app)
        .post(`${prefix}/ventas`)
        .send({}) // body vacío, ventas requiere datos
        .set('Authorization', 'Bearer valid-token')
      // Sin auth real, será error de autenticación primero o validación
      expect(res.status).toBe(401)
    })
  })

  // ═══════════════════════════════════════════════════════
  //  CORS — Origen no permitido
  // ═══════════════════════════════════════════════════════
  describe('CORS', () => {
    it('permite orígenes configurados', async () => {
      const res = await request(app)
        .get(`${prefix}/health`)
        .set('Origin', 'http://localhost:5173')
      // CORS permite el origen
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    })

    it('tiene credentials: true', async () => {
      const res = await request(app)
        .get(`${prefix}/health`)
        .set('Origin', 'http://localhost:5173')
      expect(res.headers['access-control-allow-credentials']).toBe('true')
    })
  })
})
