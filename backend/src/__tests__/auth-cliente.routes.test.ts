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
  process.env.SOPORTE_EMAIL = 'soporte@farmacy.co'
})

vi.mock('dotenv', () => ({ default: { config: vi.fn() }, config: vi.fn() }))

const mockPrisma = vi.hoisted(() => ({
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  cliente: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
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

const mockBcrypt = vi.hoisted(() => ({ compare: vi.fn(), hash: vi.fn() }))
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))
vi.mock('../config/database', () => ({ prisma: mockPrisma }))
vi.mock('../config/redis', () => ({
  redis: { on: vi.fn(), connect: vi.fn() },
  cache: mockCache,
  connectRedis: vi.fn(),
}))
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock('../config/mailer', () => ({ sendEmail: vi.fn(), emailTemplates: { verificarEmail: vi.fn(() => '<html/>'), resetPassword: vi.fn(() => '<html/>') } }))
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() }, schedule: vi.fn() }))

vi.mock('../utils/jwt.utils', () => ({
  jwtEmpleado: {
    verificar: vi.fn(() => { throw new Error('Token inválido') }),
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

describe('Auth Cliente - POST /clientes/auth/registro', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza nombre muy corto', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'A', apellido: 'Pérez', email: 'test@test.com',
      password: 'Password1!', autorizacionDatos: true,
    })
    expect(res.status).toBe(422)
  })

  it('rechaza password sin número', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'Juan', apellido: 'Pérez', email: 'test@test.com',
      password: 'Password!', autorizacionDatos: true,
    })
    expect(res.status).toBe(422)
  })

  it('rechaza password sin especial', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'Juan', apellido: 'Pérez', email: 'test@test.com',
      password: 'Password1', autorizacionDatos: true,
    })
    expect(res.status).toBe(422)
  })

  it('rechaza autorizacionDatos false', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'Juan', apellido: 'Pérez', email: 'test@test.com',
      password: 'Password1!', autorizacionDatos: false,
    })
    expect(res.status).toBe(422)
  })

  it('rechaza email duplicado con 409', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({ id: 'existing' })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'Juan', apellido: 'Pérez', email: 'existente@test.com',
      password: 'Password1!', autorizacionDatos: true,
    })
    expect(res.status).toBe(409)
  })

  it('registra cliente exitosamente', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    mockBcrypt.hash.mockResolvedValue('$2a$12$hash')
    mockPrisma.cliente.create.mockResolvedValue({ id: 'cli-1', nombre: 'Juan', email: 'juan@test.com' })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'Juan', apellido: 'Pérez', email: 'juan@test.com',
      password: 'Password1!', autorizacionDatos: true,
    })
    expect(res.status).toBe(201)
    expect(mockPrisma.cliente.create).toHaveBeenCalled()
  })

  // ── Tests de caracteres especiales en contraseña ─────────
  // El regex actual: /[!@#$%^&*_\-+=]/
  // Verifica que los nuevos caracteres agregados funcionan

  it('acepta password con guión bajo (_)', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    mockBcrypt.hash.mockResolvedValue('$2a$12$hash')
    mockPrisma.cliente.create.mockResolvedValue({ id: 'cli-2', nombre: 'Ana', email: 'ana@test.com' })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'Ana', apellido: 'López', email: 'ana@test.com',
      password: 'Password1_', autorizacionDatos: true,
    })
    expect(res.status).toBe(201)
  })

  it('acepta password con guión (-)', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    mockBcrypt.hash.mockResolvedValue('$2a$12$hash')
    mockPrisma.cliente.create.mockResolvedValue({ id: 'cli-3', nombre: 'Luis', email: 'luis@test.com' })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'Luis', apellido: 'García', email: 'luis@test.com',
      password: 'Password1-', autorizacionDatos: true,
    })
    expect(res.status).toBe(201)
  })

  it('acepta password con signo más (+)', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    mockBcrypt.hash.mockResolvedValue('$2a$12$hash')
    mockPrisma.cliente.create.mockResolvedValue({ id: 'cli-4', nombre: 'María', email: 'maria@test.com' })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'María', apellido: 'Martínez', email: 'maria@test.com',
      password: 'Password1+', autorizacionDatos: true,
    })
    expect(res.status).toBe(201)
  })

  it('acepta password con igual (=)', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    mockBcrypt.hash.mockResolvedValue('$2a$12$hash')
    mockPrisma.cliente.create.mockResolvedValue({ id: 'cli-5', nombre: 'Carlos', email: 'carlos@test.com' })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'Carlos', apellido: 'Ruiz', email: 'carlos@test.com',
      password: 'Password1=', autorizacionDatos: true,
    })
    expect(res.status).toBe(201)
  })

  it('acepta password con múltiples símbolos variados', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    mockBcrypt.hash.mockResolvedValue('$2a$12$hash')
    mockPrisma.cliente.create.mockResolvedValue({ id: 'cli-6', nombre: 'Sofía', email: 'sofia@test.com' })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'Sofía', apellido: 'Torres', email: 'sofia@test.com',
      password: 'S0f!@-_+=', autorizacionDatos: true,
    })
    expect(res.status).toBe(201)
  })

  it('maneja error interno', async () => {
    mockPrisma.cliente.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/registro`).send({
      nombre: 'Juan', apellido: 'Pérez', email: 'juan@test.com',
      password: 'Password1!', autorizacionDatos: true,
    })
    expect(res.status).toBe(500)
  })
})

describe('Auth Cliente - POST /clientes/auth/login', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza email inválido', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/login`).send({
      email: 'invalido', password: '12345678',
    })
    expect(res.status).toBe(422)
  })

  it('rechaza credenciales inválidas', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/login`).send({
      email: 'no@existe.com', password: 'Password1!',
    })
    expect(res.status).toBe(401)
  })

  it('rechaza email no verificado', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({
      id: '1', activo: true, password: '$2a$12$hash', emailVerificado: false,
    })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/login`).send({
      email: 'no-verificado@test.com', password: 'Password1!',
    })
    expect(res.status).toBe(403)
  })

  it('login exitoso retorna token y cliente', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({
      id: 'cli-1', activo: true, password: '$2a$12$hash',
      emailVerificado: true, nombre: 'Juan', apellido: 'Pérez',
      email: 'juan@test.com', puntosAcumulados: 100,
    })
    mockBcrypt.compare.mockResolvedValue(true)
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/login`).send({
      email: 'juan@test.com', password: 'Password1!',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.cliente.email).toBe('juan@test.com')
    expect(res.body.data.cliente.puntos).toBe(100)
  })

  it('maneja error interno', async () => {
    mockPrisma.cliente.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/login`).send({
      email: 'juan@test.com', password: 'Password1!',
    })
    expect(res.status).toBe(500)
  })
})

describe('Auth Cliente - POST /clientes/auth/verificar-email', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin token', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/verificar-email`).send({})
    expect(res.status).toBe(400)
  })

  it('rechaza token inválido', async () => {
    mockPrisma.cliente.findFirst.mockResolvedValue(null)
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/verificar-email`).send({ token: 'invalid' })
    expect(res.status).toBe(400)
  })

  it('verifica email exitosamente', async () => {
    mockPrisma.cliente.findFirst.mockResolvedValue({ id: 'cli-1' })
    mockPrisma.cliente.update.mockResolvedValue({})
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/verificar-email`).send({ token: 'valid-token' })
    expect(res.status).toBe(200)
  })
})

describe('Auth Cliente - POST /clientes/auth/recuperar-password', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin email', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/recuperar-password`).send({})
    expect(res.status).toBe(400)
  })

  it('responde igual si email no existe (no revela info)', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/recuperar-password`).send({ email: 'no@existe.com' })
    expect(res.status).toBe(200)
  })

  it('envía correo si email existe', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({ id: 'cli-1', nombre: 'Juan' })
    mockPrisma.cliente.update.mockResolvedValue({})
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/recuperar-password`).send({ email: 'juan@test.com' })
    expect(res.status).toBe(200)
  })
})

describe('Auth Cliente - POST /clientes/auth/reset-password', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin token y password', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/reset-password`).send({})
    expect(res.status).toBe(400)
  })

  it('rechaza token inválido o expirado', async () => {
    mockPrisma.cliente.findFirst.mockResolvedValue(null)
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/reset-password`).send({ token: 'invalid', password: 'NewPass1!' })
    expect(res.status).toBe(400)
  })

  it('resetea password exitosamente', async () => {
    mockPrisma.cliente.findFirst.mockResolvedValue({ id: 'cli-1' })
    mockBcrypt.hash.mockResolvedValue('$2a$12$newhash')
    mockPrisma.cliente.update.mockResolvedValue({})
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/reset-password`).send({ token: 'valid', password: 'NewPass1!' })
    expect(res.status).toBe(200)
  })
})

describe('Auth Cliente - GET /clientes/auth/me', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin token', async () => {
    const res = await supertest(app).get(`${apiPrefix}/clientes/auth/me`)
    expect(res.status).toBe(401)
  })

  it('retorna perfil del cliente', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({
      id: 'cli-1', nombre: 'Juan', apellido: 'Pérez',
      email: 'juan@test.com', telefono: '555-0000',
      ciudad: 'Bogotá', puntosAcumulados: 100,
      puntosExpiranEn: null, creadoEn: new Date(),
    })
    const res = await supertest(app).get(`${apiPrefix}/clientes/auth/me`)
      .set('Authorization', 'Bearer valid-client-token')
    expect(res.status).toBe(200)
    expect(res.body.data.email).toBe('juan@test.com')
  })

  it('retorna 404 si cliente no existe', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue(null)
    const res = await supertest(app).get(`${apiPrefix}/clientes/auth/me`)
      .set('Authorization', 'Bearer valid-client-token')
    expect(res.status).toBe(404)
  })
})

describe('Auth Cliente - GET /clientes/auth/pedidos', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin token', async () => {
    const res = await supertest(app).get(`${apiPrefix}/clientes/auth/pedidos`)
    expect(res.status).toBe(401)
  })

  it('retorna lista de pedidos', async () => {
    mockPrisma.venta.findMany.mockResolvedValue([{ id: 'v-1', numero: 'V-001', total: 50000, estado: 'PAGADO', creadoEn: new Date(), detalles: [{ producto: { nombre: 'Acetaminofén' }, id: 'det-1', cantidad: 2, precioUnitario: 2500, subtotal: 5000, loteId: null, productoId: 'p-1', ventaId: 'v-1' }] }])
    const res = await supertest(app).get(`${apiPrefix}/clientes/auth/pedidos`)
      .set('Authorization', 'Bearer valid-client-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })
})

describe('Auth Cliente - POST /clientes/auth/favoritos', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin productoId', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/favoritos`)
      .set('Authorization', 'Bearer valid-client-token').send({})
    expect(res.status).toBe(400)
  })

  it('agrega a favoritos si no existe', async () => {
    mockPrisma.favorito.findFirst.mockResolvedValue(null)
    mockPrisma.favorito.create.mockResolvedValue({ id: 'fav-1', productoId: 'prod-1', clienteId: 'cli-1' })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/favoritos`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ productoId: 'prod-1' })
    expect(res.status).toBe(201)
  })

  it('elimina de favoritos si ya existe', async () => {
    mockPrisma.favorito.findFirst.mockResolvedValue({ id: 'fav-1' })
    mockPrisma.favorito.delete.mockResolvedValue({})
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/favoritos`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ productoId: 'prod-1' })
    expect(res.status).toBe(200)
  })
})

describe('Auth Cliente - POST /clientes/auth/logout', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin token', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/logout`)
    expect(res.status).toBe(401)
  })

  it('cierra sesión exitosamente', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/logout`)
      .set('Authorization', 'Bearer valid-client-token')
    expect(res.status).toBe(200)
    expect(mockCache.set).toHaveBeenCalled()
  })
})

describe('Auth Cliente Perfil - GET /clientes/auth/me', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin token', async () => {
    const res = await supertest(app).get(`${apiPrefix}/clientes/auth/me`)
    expect(res.status).toBe(401)
  })

  it('retorna perfil', async () => {
    mockPrisma.cliente.findUnique.mockResolvedValue({ id: 'cli-1', nombre: 'Juan', apellido: 'Pérez', email: 'juan@test.com', telefono: null, ciudad: null, puntosAcumulados: 0, puntosExpiranEn: null, creadoEn: new Date() })
    const res = await supertest(app).get(`${apiPrefix}/clientes/auth/me`)
      .set('Authorization', 'Bearer valid-client-token')
    expect(res.status).toBe(200)
  })
})

describe('Auth Cliente Perfil - PATCH /clientes/auth/me', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('actualiza perfil', async () => {
    mockPrisma.cliente.update.mockResolvedValue({ id: 'cli-1', nombre: 'Juan', apellido: 'Pérez', email: 'juan@test.com', telefono: '555-1234', ciudad: 'Bogotá' })
    const res = await supertest(app).patch(`${apiPrefix}/clientes/auth/me`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ telefono: '555-1234', ciudad: 'Bogotá' })
    expect(res.status).toBe(200)
  })

  it('maneja error interno al actualizar perfil', async () => {
    mockPrisma.cliente.update.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).patch(`${apiPrefix}/clientes/auth/me`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ telefono: '555-9999' })
    expect(res.status).toBe(500)
  })
})

describe('Auth Cliente Perfil - GET /clientes/auth/favoritos', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna favoritos', async () => {
    mockPrisma.favorito.findMany.mockResolvedValue([{ id: 'fav-1', productoId: 'prod-1', creadoEn: new Date(), producto: { id: 'prod-1', nombre: 'Acetaminofén', slug: 'acetaminofen', imagenUrl: null, precioVenta: 2500 } }])
    const res = await supertest(app).get(`${apiPrefix}/clientes/auth/favoritos`)
      .set('Authorization', 'Bearer valid-client-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('retorna favoritos vacío si no hay', async () => {
    mockPrisma.favorito.findMany.mockResolvedValue([])
    const res = await supertest(app).get(`${apiPrefix}/clientes/auth/favoritos`)
      .set('Authorization', 'Bearer valid-client-token')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('maneja error interno al obtener favoritos', async () => {
    mockPrisma.favorito.findMany.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).get(`${apiPrefix}/clientes/auth/favoritos`)
      .set('Authorization', 'Bearer valid-client-token')
    expect(res.status).toBe(500)
  })
})

describe('Auth Cliente - POST /clientes/auth/pedidos/:id/devolucion-request', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/pedidos/v-1/devolucion-request`).send({ motivo: 'Defectuoso' })
    expect(res.status).toBe(401)
  })

  it('rechaza sin motivo', async () => {
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/pedidos/v-1/devolucion-request`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({})
    expect(res.status).toBe(400)
  })

  it('retorna 404 si venta no existe', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue(null)
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/pedidos/v-999/devolucion-request`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ motivo: 'Defectuoso' })
    expect(res.status).toBe(404)
  })

  it('rechaza si la venta no pertenece al cliente', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: 'v-1', numero: 'V-001', total: 50000, clienteId: 'otro-cliente', creadoEn: new Date(),
      cliente: { nombre: 'Otro', apellido: 'User' }
    })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/pedidos/v-1/devolucion-request`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ motivo: 'Defectuoso' })
    expect(res.status).toBe(401)
  })

  it('rechaza si pasaron más de 15 días', async () => {
    const fechaVieja = new Date()
    fechaVieja.setDate(fechaVieja.getDate() - 20)
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: 'v-1', numero: 'V-001', total: 50000, clienteId: 'cli-1', creadoEn: fechaVieja,
      cliente: { nombre: 'Juan', apellido: 'Pérez' }
    })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/pedidos/v-1/devolucion-request`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ motivo: 'Defectuoso' })
    expect(res.status).toBe(400)
  })

  it('envía correo de solicitud exitosamente', async () => {
    const fechaReciente = new Date()
    fechaReciente.setDate(fechaReciente.getDate() - 3)
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: 'v-1', numero: 'V-001', total: 50000, clienteId: 'cli-1', creadoEn: fechaReciente,
      cliente: { nombre: 'Juan', apellido: 'Pérez' }
    })
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/pedidos/v-1/devolucion-request`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ motivo: 'Producto defectuoso' })
    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })

  it('maneja error interno', async () => {
    mockPrisma.venta.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).post(`${apiPrefix}/clientes/auth/pedidos/v-1/devolucion-request`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ motivo: 'Error' })
    expect(res.status).toBe(500)
  })
})
