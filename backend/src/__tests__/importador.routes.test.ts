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
  categoria: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  producto: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../config/database', () => ({ prisma: mockPrisma }))
vi.mock('../config/redis', () => ({
  redis: { on: vi.fn(), connect: vi.fn() },
  // cache.get debe resolver null (token NO revocado) para que pase autenticar()
  cache: { delPattern: vi.fn().mockResolvedValue(0), get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() },
  connectRedis: vi.fn(),
}))
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() }, schedule: vi.fn() }))

// JWT mockeado con el mismo contrato que otros tests de rutas
vi.mock('../utils/jwt.utils', () => ({
  jwtEmpleado: {
    verificar: vi.fn((token: string) => {
      if (token === 'valid-admin-token') return { id: 'emp-1', nombre: 'Admin', email: 'admin@test.com', rol: 'ADMINISTRADOR', sucursalId: 1 }
      if (token === 'valid-aux-token') return { id: 'emp-2', nombre: 'Aux', email: 'aux@test.com', rol: 'AUXILIAR', sucursalId: 1 }
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

const CSV_VALIDO = `cum,nombre,precioVenta,categoria,requiereRx
1998346-R1,Acetaminofen 500mg,3500,Analgésicos,no
2000123-R2,Ibuprofeno 400mg,5200,Antiinflamatorios,no`

describe('POST /importar/productos', () => {
  let app: express.Express
  beforeAll(() => { app = createApp() })
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.categoria.findFirst.mockResolvedValue({ id: 1, nombre: 'Analgésicos' })
    mockPrisma.producto.findUnique.mockResolvedValue(null)
    mockPrisma.producto.create.mockResolvedValue({})
    mockPrisma.producto.update.mockResolvedValue({})
  })

  it('rechaza sin csv', async () => {
    const res = await supertest(app)
      .post('/api/v1/importar/productos')
      .set('Authorization', 'Bearer valid-admin-token')
      .send({})
    expect(res.status).toBe(400)
  })

  it('importa filas válidas: crea productos y cuenta resultados', async () => {
    const res = await supertest(app)
      .post('/api/v1/importar/productos')
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ csv: CSV_VALIDO })

    expect(res.status).toBe(200)
    expect(res.body.data.totalFilas).toBe(2)
    expect(res.body.data.creados).toBe(2)
    expect(res.body.data.errores).toBe(0)
    expect(mockPrisma.producto.create).toHaveBeenCalledTimes(2)
  })

  it('reporta error por fila sin abortar el lote (fila con cum vacío)', async () => {
    const csv = `cum,nombre,precioVenta,categoria
,Producto sin CUM,1000,General
9999999-R9,Producto bueno,2000,General`
    const res = await supertest(app)
      .post('/api/v1/importar/productos')
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ csv })

    expect(res.status).toBe(200)
    expect(res.body.data.errores).toBe(1)
    expect(res.body.data.creados).toBe(1)
    const err = res.body.data.resultados.find((r: any) => r.accion === 'error')
    expect(err.detalle).toContain('cum')
  })

  it('hace upsert: actualiza si el CUM ya existe', async () => {
    // Solo el primer CUM existe; el segundo se crea
    mockPrisma.producto.findUnique
      .mockResolvedValueOnce({ id: 'p-1', cum: '1998346-R1' })
      .mockResolvedValueOnce(null)
    const res = await supertest(app)
      .post('/api/v1/importar/productos')
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ csv: CSV_VALIDO })

    expect(res.body.data.creados).toBe(1)
    expect(res.body.data.actualizados).toBe(1)
    expect(mockPrisma.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cum: '1998346-R1' } })
    )
  })

  it('rechaza precioVenta negativo por fila', async () => {
    const csv = `cum,nombre,precioVenta,categoria
111-R1,Producto con precio loco,-500,General`
    const res = await supertest(app)
      .post('/api/v1/importar/productos')
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ csv })

    expect(res.body.data.errores).toBe(1)
    const err = res.body.data.resultados[0]
    expect(err.detalle).toContain('precioVenta')
  })

  it('crea la categoría si no existe', async () => {
    mockPrisma.categoria.findFirst.mockResolvedValue(null)
    mockPrisma.categoria.create.mockResolvedValue({ id: 99 })

    const res = await supertest(app)
      .post('/api/v1/importar/productos')
      .set('Authorization', 'Bearer valid-admin-token')
      .send({ csv: CSV_VALIDO })

    expect(res.status).toBe(200)
    expect(mockPrisma.categoria.create).toHaveBeenCalled()
  })
})
