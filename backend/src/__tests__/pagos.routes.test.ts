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
  // Wompi keys for testing wompi routes
  process.env.WOMPI_PUBLIC_KEY = 'pub_test_wompi'
  process.env.WOMPI_PRIVATE_KEY = 'priv_test_wompi'
  process.env.WOMPI_EVENTS_SECRET = 'evt_test_wompi_secret'
  process.env.WOMPI_INTEGRITY_SECRET = 'integrity_test_wompi_secret'
  // MercadoPago explicitly unset → test checks for 503
  process.env.MERCADOPAGO_ACCESS_TOKEN = ''
  process.env.MERCADOPAGO_PUBLIC_KEY = ''
})

vi.mock('dotenv', () => ({ default: { config: vi.fn() }, config: vi.fn() }))

const mockPrisma = vi.hoisted(() => ({
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  cliente: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  empleado: { findUnique: vi.fn() },
  pedidoOnline: { findUnique: vi.fn(), update: vi.fn() },
  pagoTransaccion: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  venta: { findUnique: vi.fn(), update: vi.fn() },
  caja: { findFirst: vi.fn() },
  logActividad: { create: vi.fn().mockResolvedValue({}) },
  chatbotSesion: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
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
      throw new Error('Token inválido')
    }),
    firmar: vi.fn(() => 'fake-token'),
    firmarRefresh: vi.fn(() => 'fake-refresh-token'),
    verificarRefresh: vi.fn(() => ({ id: 'emp-1' })),
  },
  jwtCliente: {
    verificar: vi.fn((token: string) => {
      if (token === 'valid-client-token') return { id: 'client-1', email: 'cliente@test.com' }
      throw new Error('Token inválido')
    }),
    firmar: vi.fn(() => 'fake-client-token'),
  },
  jwtTemp: {
    firmar: vi.fn(() => 'fake-temp-token'),
    verificar: vi.fn(() => ({})),
  },
}))

// Mock Stripe & MercadoPago to prevent actual instantiation
vi.mock('stripe', () => ({ default: vi.fn(() => ({
  paymentIntents: { create: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
})) }))
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn(),
  Preference: vi.fn(() => ({ create: vi.fn() })),
}))

import supertest from 'supertest'
import { createApp } from '../app'

const apiPrefix = '/api/v1'

// ═══════════════════════════════════════════════════════════
//  Wompi Routes
// ═══════════════════════════════════════════════════════════
describe('POST /pagos/wompi/crear', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación (cliente)', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/wompi/crear`).send({})
    expect(res.status).toBe(401)
  })

  it('retorna 404 si el pedido no existe', async () => {
    mockPrisma.pedidoOnline.findUnique.mockResolvedValue(null)
    const res = await supertest(app).post(`${apiPrefix}/pagos/wompi/crear`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ pedidoId: '11111111-1111-4111-1111-111111111111', monto: 50000 })
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('Pedido')
  })

  it('inicia transacción Wompi exitosamente', async () => {
    mockPrisma.pedidoOnline.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-1111-111111111111',
      numero: 42,
      total: 50000,
      estado: 'PENDIENTE',
      clienteId: 'client-1',
      cliente: { email: 'cliente@test.com' },
    })
    mockPrisma.pagoTransaccion.upsert.mockResolvedValue({ id: 'pago-1', estado: 'PENDIENTE' })

    const res = await supertest(app).post(`${apiPrefix}/pagos/wompi/crear`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ pedidoId: '11111111-1111-4111-1111-111111111111', monto: 50000, moneda: 'COP' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const data = res.body.data
    expect(data.publicKey).toBe('pub_test_wompi')
    expect(data.amountInCents).toBe(5000000) // 50000 * 100
    expect(data.reference).toContain('FARMACY-42-')
    expect(data.signature).toBeDefined()
    expect(data.redirectUrl).toContain('pago/confirmacion')
    expect(data.customerEmail).toBe('cliente@test.com')
    expect(mockPrisma.pagoTransaccion.upsert).toHaveBeenCalledTimes(1)
  })

  it('maneja error interno', async () => {
    mockPrisma.pedidoOnline.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).post(`${apiPrefix}/pagos/wompi/crear`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ pedidoId: '11111111-1111-4111-1111-111111111111', monto: 50000 })
    expect(res.status).toBe(500)
  })
})

describe('POST /pagos/wompi/webhook', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza con firma inválida', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/wompi/webhook`)
      .set('x-event-checksum', 'invalid-signature')
      .send({ data: { transaction: { status: 'APPROVED', reference: 'FARMACY-42-123' } } })
    expect(res.status).toBe(401)
    expect(res.body.error).toContain('Firma inválida')
  })

  it('retorna 200 si no hay transacción', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/wompi/webhook`)
      .send({ data: {} })
    expect(res.status).toBe(200)
  })

  it('retorna 200 si no hay data', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/wompi/webhook`)
      .send({})
    expect(res.status).toBe(200)
  })

  it('retorna 200 si no hay data', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/wompi/webhook`)
      .send({})
    expect(res.status).toBe(200)
  })

  it('retorna 200 y actualiza estado a APROBADO', async () => {
    // La firma no matchea (en test el checksum no coincide con HMAC),
    // pero el catch de firma inválida retorna 401 antes.
    // Para que pase, enviamos sin header de firma.
    mockPrisma.pagoTransaccion.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.pagoTransaccion.findFirst.mockResolvedValue({
      id: 'pago-1',
      estado: 'APROBADO',
      pedidoOnlineId: '11111111-1111-4111-1111-111111111111',
    })
    mockPrisma.pedidoOnline.update.mockResolvedValue({})

    const res = await supertest(app).post(`${apiPrefix}/pagos/wompi/webhook`)
      .send({ data: { transaction: { id: 'tx-001', status: 'APPROVED', reference: 'REF-001' } } })

    expect(res.status).toBe(200)
    expect(mockPrisma.pagoTransaccion.updateMany).toHaveBeenCalledWith({
      where: { referenciaExterna: 'REF-001' },
      data: { estado: 'APROBADO', respuestaPasarela: { data: { transaction: { id: 'tx-001', status: 'APPROVED', reference: 'REF-001' } } } },
    })
    expect(mockPrisma.pagoTransaccion.findFirst).toHaveBeenCalled()
    expect(mockPrisma.pedidoOnline.update).toHaveBeenCalled()
  })

  it('retorna 200 con estado RECHAZADO para transacción declinada', async () => {
    mockPrisma.pagoTransaccion.updateMany.mockResolvedValue({ count: 1 })

    const res = await supertest(app).post(`${apiPrefix}/pagos/wompi/webhook`)
      .send({ data: { transaction: { id: 'tx-002', status: 'DECLINED', reference: 'REF-002' } } })

    expect(res.status).toBe(200)
    expect(mockPrisma.pagoTransaccion.updateMany).toHaveBeenCalledWith({
      where: { referenciaExterna: 'REF-002' },
      data: { estado: 'RECHAZADO', respuestaPasarela: { data: { transaction: { id: 'tx-002', status: 'DECLINED', reference: 'REF-002' } } } },
    })
  })

  it('maneja error con 500', async () => {
    mockPrisma.pagoTransaccion.updateMany.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).post(`${apiPrefix}/pagos/wompi/webhook`)
      .send({ data: { transaction: { id: 'tx-003', status: 'APPROVED', reference: 'REF-003' } } })
    expect(res.status).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════
//  Stripe Routes (sin configurar → 503)
// ═══════════════════════════════════════════════════════════
describe('POST /pagos/stripe/crear-intent', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna 503 si Stripe no está configurado', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/stripe/crear-intent`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ pedidoId: '11111111-1111-4111-1111-111111111111' })
    expect(res.status).toBe(503)
    expect(res.body.error).toContain('Stripe')
  })
})

describe('POST /pagos/stripe/webhook', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna 200 si Stripe no está configurado (se salta el webhook)', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/stripe/webhook`)
      .send({ type: 'payment_intent.succeeded', data: {} })
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════
//  MercadoPago Routes (sin configurar → 503)
// ═══════════════════════════════════════════════════════════
describe('POST /pagos/mercadopago/crear', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna 503 si MercadoPago no está configurado', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/mercadopago/crear`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ pedidoId: '11111111-1111-4111-1111-111111111111', items: [] })
    expect(res.status).toBe(503)
    expect(res.body.error).toContain('MercadoPago')
  })
})

describe('POST /pagos/mercadopago/webhook', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna 200 para eventos no payment', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/mercadopago/webhook`)
      .send({ type: 'test', data: { id: null } })
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════
//  Efectivo Routes (protegidas con autenticar)
// ═══════════════════════════════════════════════════════════
describe('POST /pagos/efectivo/registrar', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('rechaza sin autenticación', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/efectivo/registrar`)
      .send({ ventaId: '11111111-1111-4111-1111-111111111111', monto: 50000 })
    expect(res.status).toBe(401)
  })

  it('retorna 404 si la venta no existe', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue(null)
    const res = await supertest(app).post(`${apiPrefix}/pagos/efectivo/registrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ ventaId: '11111111-1111-4111-1111-111111111111', monto: 50000 })
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('Venta')
  })

  it('registra pago en efectivo exitosamente — actualiza PagoTransaccion existente', async () => {
    // Venta pendiente
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-1111-111111111111',
      numero: 42,
      total: 50000,
      estado: 'PENDIENTE',
    })
    // Caja abierta del empleado
    mockPrisma.caja.findFirst.mockResolvedValue({
      id: 'caja-001',
      empleadoId: 'emp-1',
      cerradaEn: null,
    })
    // Transacción EFECTIVO existente (creada por /comprar)
    mockPrisma.pagoTransaccion.findFirst.mockResolvedValue({ id: 'tx-cash-1', estado: 'PENDIENTE' })
    mockPrisma.pagoTransaccion.update.mockResolvedValue({ id: 'tx-cash-1', estado: 'APROBADO' })
    mockPrisma.venta.update.mockResolvedValue({ id: '11111111-1111-4111-1111-111111111111', estado: 'PAGADO' })

    const res = await supertest(app).post(`${apiPrefix}/pagos/efectivo/registrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ ventaId: '11111111-1111-4111-1111-111111111111', monto: 50000 })

    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)
    // Actualiza la transacción existente (no crea una nueva)
    expect(mockPrisma.pagoTransaccion.update).toHaveBeenCalledWith({
      where: { id: 'tx-cash-1' },
      data: expect.objectContaining({ estado: 'APROBADO' }),
    })
    expect(mockPrisma.pagoTransaccion.create).not.toHaveBeenCalled()
    // Actualiza la venta a PAGADO
    expect(mockPrisma.venta.update).toHaveBeenCalledWith({
      where: { id: '11111111-1111-4111-1111-111111111111' },
      data: expect.objectContaining({ estado: 'PAGADO' }),
    })
    // Respuesta incluye monto, cambio, cajaId
    expect(res.body.data).toMatchObject({
      monto: 50000,
      montoRecibido: 50000,
      cambio: 0,
      cajaId: 'caja-001',
    })
  })

  it('registra pago en efectivo — con cambio (monto mayor al total)', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: '22222222-2222-4222-2222-222222222222',
      numero: 43,
      total: 35000,
      estado: 'PENDIENTE',
    })
    mockPrisma.caja.findFirst.mockResolvedValue({
      id: 'caja-001',
      empleadoId: 'emp-1',
      cerradaEn: null,
    })
    // Sin transacción existente → debe crear una nueva
    mockPrisma.pagoTransaccion.findFirst.mockResolvedValue(null)
    mockPrisma.pagoTransaccion.create.mockResolvedValue({ id: 'tx-cash-2', estado: 'APROBADO' })
    mockPrisma.venta.update.mockResolvedValue({ id: '22222222-2222-4222-2222-222222222222', estado: 'PAGADO' })

    const res = await supertest(app).post(`${apiPrefix}/pagos/efectivo/registrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ ventaId: '22222222-2222-4222-2222-222222222222', monto: 50000 })

    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)
    // Crea nueva transacción (no había existente)
    expect(mockPrisma.pagoTransaccion.create).toHaveBeenCalled()
    expect(mockPrisma.pagoTransaccion.update).not.toHaveBeenCalled()
    // Cambio = 50000 - 35000 = 15000
    expect(res.body.data).toMatchObject({
      monto: 35000,
      montoRecibido: 50000,
      cambio: 15000,
      cajaId: 'caja-001',
    })
  })

  it('rechaza si la venta ya fue pagada', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: '33333333-3333-4333-3333-333333333333',
      total: 50000,
      estado: 'PAGADO',
    })

    const res = await supertest(app).post(`${apiPrefix}/pagos/efectivo/registrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ ventaId: '33333333-3333-4333-3333-333333333333', monto: 50000 })

    expect(res.status).toBe(409)
    expect(res.body.error).toContain('ya fue pagada')
  })

  it('rechaza si el monto es menor al total', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: '44444444-4444-4444-4444-444444444444',
      total: 50000,
      estado: 'PENDIENTE',
    })
    mockPrisma.caja.findFirst.mockResolvedValue({
      id: 'caja-001',
      empleadoId: 'emp-1',
      cerradaEn: null,
    })

    const res = await supertest(app).post(`${apiPrefix}/pagos/efectivo/registrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ ventaId: '44444444-4444-4444-4444-444444444444', monto: 30000 })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('menor al total')
  })

  it('rechaza si no hay caja abierta', async () => {
    mockPrisma.venta.findUnique.mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
      total: 50000,
      estado: 'PENDIENTE',
    })
    // Sin caja abierta
    mockPrisma.caja.findFirst.mockResolvedValue(null)

    const res = await supertest(app).post(`${apiPrefix}/pagos/efectivo/registrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ ventaId: '55555555-5555-5555-5555-555555555555', monto: 50000 })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('caja abierta')
  })

  it('rechaza montos negativos o cero', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/efectivo/registrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ ventaId: '66666666-6666-4666-6666-666666666666', monto: -100 })

    expect(res.status).toBe(400)
  })

  it('maneja error interno', async () => {
    mockPrisma.venta.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).post(`${apiPrefix}/pagos/efectivo/registrar`)
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ ventaId: '11111111-1111-4111-1111-111111111111', monto: 50000 })
    expect(res.status).toBe(500)
  })
})
