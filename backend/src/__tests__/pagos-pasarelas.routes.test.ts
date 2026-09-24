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

  // ── Stripe configurado ──
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake'
  process.env.STRIPE_PUBLIC_KEY = 'pk_test_fake'

  // ── MercadoPago configurado ──
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-12345'
  process.env.MERCADOPAGO_PUBLIC_KEY = 'TEST-67890'
})

vi.mock('dotenv', () => ({ default: { config: vi.fn() }, config: vi.fn() }))

const mockPrisma = vi.hoisted(() => ({
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  cliente: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  empleado: { findUnique: vi.fn() },
  pedidoOnline: { findUnique: vi.fn(), update: vi.fn() },
  pagoTransaccion: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  venta: { findUnique: vi.fn() },
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

// Hoisted mock Stripe instance — allows direct reference in tests
const mockStripeInstance = vi.hoisted(() => ({
  paymentIntents: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  webhooks: { constructEvent: vi.fn() },
}))

vi.mock('stripe', () => ({ default: vi.fn(() => mockStripeInstance) }))
// Hoisted mock for Preference.create — accessible from tests
const mockMPPreferenceCreate = vi.hoisted(() => vi.fn())

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn(),
  Preference: vi.fn(() => ({ create: mockMPPreferenceCreate })),
}))

// Mock global fetch for MercadoPago webhook (calls MP API)
vi.stubGlobal('fetch', vi.fn())

import supertest from 'supertest'
import { createApp } from '../app'

const apiPrefix = '/api/v1'

// ═══════════════════════════════════════════════════════════
//  Stripe — crear-intent (configurado)
// ═══════════════════════════════════════════════════════════
describe('Stripe configurado — POST /pagos/stripe/crear-intent', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna 404 si el pedido no existe', async () => {
    mockPrisma.pedidoOnline.findUnique.mockResolvedValue(null)
    const res = await supertest(app).post(`${apiPrefix}/pagos/stripe/crear-intent`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ pedidoId: '11111111-1111-4111-1111-111111111111' })
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('Pedido')
  })

  it('crea Checkout Session exitosamente con monto server-side y upsert transacción', async () => {
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      id: 'cs_789',
      url: 'https://checkout.stripe.com/c/pay/cs_789',
    })
    mockPrisma.pedidoOnline.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-1111-111111111111',
      numero: 99,
      total: 75000,
      estado: 'PENDIENTE',
      cliente: { email: 'cliente@test.com' },
    })
    mockPrisma.pagoTransaccion.upsert.mockResolvedValue({ id: 'stripe-pago-1', estado: 'PENDIENTE' })

    const res = await supertest(app).post(`${apiPrefix}/pagos/stripe/crear-intent`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ pedidoId: '11111111-1111-4111-1111-111111111111' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.sessionUrl).toBe('https://checkout.stripe.com/c/pay/cs_789')
    // Monto SIEMPRE server-side: total del pedido en DB (75000 × 100)
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 7500000, currency: 'cop' }),
          }),
        ],
        metadata: expect.objectContaining({ numeroPedido: '99' }),
      })
    )
    expect(mockPrisma.pagoTransaccion.upsert).toHaveBeenCalledTimes(1)
  })

  it('maneja error interno de Stripe', async () => {
    mockPrisma.pedidoOnline.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).post(`${apiPrefix}/pagos/stripe/crear-intent`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ pedidoId: '11111111-1111-4111-1111-111111111111' })
    expect(res.status).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════
//  Stripe — webhook (configurado)
// ═══════════════════════════════════════════════════════════
describe('Stripe configurado — POST /pagos/stripe/webhook', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('procesa payment_intent.succeeded y actualiza estado', async () => {
    // Configurar constructEvent para que retorne un evento válido
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          metadata: { pedidoId: '11111111-1111-4111-1111-111111111111' },
        },
      },
    })
    mockPrisma.pagoTransaccion.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.pedidoOnline.update.mockResolvedValue({})

    const res = await supertest(app).post(`${apiPrefix}/pagos/stripe/webhook`)
      .set('stripe-signature', 'fake_sig')
      .send({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123', metadata: { pedidoId: '11111111-1111-4111-1111-111111111111' } } },
      })

    expect(res.status).toBe(200)
    expect(mockPrisma.pagoTransaccion.updateMany).toHaveBeenCalled()
    expect(mockPrisma.pedidoOnline.update).toHaveBeenCalled()
  })

  it('procesa payment_intent.payment_failed y actualiza a RECHAZADO', async () => {
    // Configurar constructEvent para que retorne un evento fallido
    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_456',
          metadata: {},
        },
      },
    })
    mockPrisma.pagoTransaccion.updateMany.mockResolvedValue({ count: 1 })

    const res = await supertest(app).post(`${apiPrefix}/pagos/stripe/webhook`)
      .set('stripe-signature', 'fake_sig')
      .send({
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_456', metadata: {} } },
      })

    expect(res.status).toBe(200)
    expect(mockPrisma.pagoTransaccion.updateMany).toHaveBeenCalled()
    // No pedido update because metadata.pedidoId is empty
    expect(mockPrisma.pedidoOnline.update).not.toHaveBeenCalled()
  })

  it('retorna 400 si la firma del webhook es inválida', async () => {
    // Configurar constructEvent para que lance (firma inválida)
    mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const res = await supertest(app).post(`${apiPrefix}/pagos/stripe/webhook`)
      .set('stripe-signature', 'bad_sig')
      .send({ type: 'payment_intent.succeeded', data: {} })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('inválida')
  })
})

// ═══════════════════════════════════════════════════════════
//  MercadoPago — crear preferencia (configurado)
// ═══════════════════════════════════════════════════════════
describe('MercadoPago configurado — POST /pagos/mercadopago/crear', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna 404 si el pedido no existe', async () => {
    mockPrisma.pedidoOnline.findUnique.mockResolvedValue(null)
    const res = await supertest(app).post(`${apiPrefix}/pagos/mercadopago/crear`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({ pedidoId: '11111111-1111-4111-1111-111111111111', items: [{ nombre: 'Prod', cantidad: 1, precioUnitario: 50000 }] })
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('Pedido')
  })

  it('crea preferencia exitosamente y upsert transacción', async () => {
    mockMPPreferenceCreate.mockResolvedValue({
      id: 'pref_789',
      init_point: 'https://mercadopago.com/init/pref_789',
    })
    mockPrisma.pedidoOnline.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-1111-111111111111',
      numero: 77,
      total: 50000,
      estado: 'PENDIENTE',
      cliente: { email: 'cliente@test.com' },
    })
    mockPrisma.pagoTransaccion.upsert.mockResolvedValue({ id: 'mp-pago-1', estado: 'PENDIENTE' })

    const res = await supertest(app).post(`${apiPrefix}/pagos/mercadopago/crear`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({
        pedidoId: '11111111-1111-4111-1111-111111111111',
        items: [{ nombre: 'Ibuprofeno', cantidad: 2, precioUnitario: 8500 }],
      })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.preferenceId).toBe('pref_789')
    expect(res.body.data.initPoint).toBe('https://mercadopago.com/init/pref_789')
    expect(mockMPPreferenceCreate).toHaveBeenCalled()
    expect(mockPrisma.pagoTransaccion.upsert).toHaveBeenCalledTimes(1)
  })

  it('maneja error interno', async () => {
    mockPrisma.pedidoOnline.findUnique.mockRejectedValue(new Error('DB error'))
    const res = await supertest(app).post(`${apiPrefix}/pagos/mercadopago/crear`)
      .set('Authorization', 'Bearer valid-client-token')
      .send({
        pedidoId: '11111111-1111-4111-1111-111111111111',
        items: [{ nombre: 'Prod', cantidad: 1, precioUnitario: 10000 }],
      })
    expect(res.status).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════
//  MercadoPago — webhook (configurado)
// ═══════════════════════════════════════════════════════════
describe('MercadoPago configurado — POST /pagos/mercadopago/webhook', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => { vi.clearAllMocks() })

  it('retorna 200 para eventos no payment', async () => {
    const res = await supertest(app).post(`${apiPrefix}/pagos/mercadopago/webhook`)
      .send({ type: 'test', data: { id: null } })
    expect(res.status).toBe(200)
    // fetch should NOT be called for non-payment events
    expect(fetch).not.toHaveBeenCalled()
  })

  it('procesa payment aprobado y actualiza estado', async () => {
    // Mock fetch to return a mock MP API response
    const mockFetchResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'approved',
        external_reference: '11111111-1111-4111-1111-111111111111',
      }),
    }
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse as any)
    mockPrisma.pagoTransaccion.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.pedidoOnline.update.mockResolvedValue({})

    const res = await supertest(app).post(`${apiPrefix}/pagos/mercadopago/webhook`)
      .send({ type: 'payment', data: { id: '12345' } })

    expect(res.status).toBe(200)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.mercadopago.com/v1/payments/12345'),
      expect.any(Object),
    )
    expect(mockPrisma.pagoTransaccion.updateMany).toHaveBeenCalled()
    expect(mockPrisma.pedidoOnline.update).toHaveBeenCalled()
  })

  it('procesa payment rechazado sin actualizar pedido', async () => {
    const mockFetchResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'rejected',
        external_reference: '11111111-1111-4111-1111-111111111111',
      }),
    }
    vi.mocked(fetch).mockResolvedValue(mockFetchResponse as any)
    mockPrisma.pagoTransaccion.updateMany.mockResolvedValue({ count: 1 })

    const res = await supertest(app).post(`${apiPrefix}/pagos/mercadopago/webhook`)
      .send({ type: 'payment', data: { id: '67890' } })

    expect(res.status).toBe(200)
    expect(fetch).toHaveBeenCalled()
    expect(mockPrisma.pagoTransaccion.updateMany).toHaveBeenCalled()
    // pedidoOnline.update should NOT be called for 'rejected' status
    expect(mockPrisma.pedidoOnline.update).not.toHaveBeenCalled()
  })
})
