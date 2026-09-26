/**
 * TESTS DE INTEGRACIÓN — Búsqueda sin acentos (migración 0005).
 *
 * Verifica el hallazgo real del E2E: "Acetaminofen" sin tilde debe
 * encontrar "Acetaminofén". Ejecuta el router real de productos contra
 * PostgreSQL con la columna generada nombre_normalizado + unaccent.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import { prisma, limpiarTransaccional } from './helpers'
import { productosRouter } from '../../modules/productos/productos.routes'
import { cache } from '../../config/redis'

const app = express()
app.use('/api/v1/productos', productosRouter)

let productoId: string

beforeAll(async () => {
  await limpiarTransaccional()
  // Redis cachea /buscar 300s y persiste entre corridas locales: limpiar
  // para que el producto recién creado sea visible en cada corrida.
  try { await cache.delPattern('productos:buscar:*') } catch { /* sin Redis */ }
  const categoria = await prisma.categoria.findFirst({ where: { nombre: 'Test Integración' } })
    ?? await prisma.categoria.create({ data: { nombre: 'Test Integración', slug: 'test-integracion' } })
  const producto = await prisma.producto.create({
    data: {
      cum: `TEST-ACC-${Date.now()}`,
      registroInvima: 'TEST-INVIMA-ACC',
      nombre: 'TEST-INT Acetaminofén Integración',
      principioActivo: 'Paracetamol',
      categoriaId: categoria.id,
      precioVenta: 4500,
      activo: true,
      lotes: {
        create: {
          sucursalId: 1,
          codigoLote: `LOTE-ACC-${Date.now()}`,
          fechaVencimiento: new Date(Date.now() + 365 * 86400000),
          cantidadInicial: 10,
          cantidadActual: 10,
          precioCompra: 2000,
        },
      },
    },
  })
  productoId = producto.id
})

afterAll(async () => {
  await limpiarTransaccional()
  // El helper no borra productos (protege el catálogo): este sí es de prueba
  await prisma.producto.deleteMany({ where: { nombre: { startsWith: 'TEST-INT' } } })
  await prisma.$disconnect()
})

describe('GET /productos/buscar — insensible a acentos (migración 0005)', () => {
  it('encuentra el producto SIN tilde: q=acetaminofen', async () => {
    const res = await supertest(app).get('/api/v1/productos/buscar?q=acetaminofen')
    expect(res.status).toBe(200)
    const ids = res.body.data.map((p: { id: string }) => p.id)
    expect(ids).toContain(productoId)
  })

  it('encuentra el producto CON tilde: q=Acetaminofén', async () => {
    const res = await supertest(app).get(`/api/v1/productos/buscar?q=${encodeURIComponent('Acetaminofén')}`)
    expect(res.status).toBe(200)
    const ids = res.body.data.map((p: { id: string }) => p.id)
    expect(ids).toContain(productoId)
  })

  it('encuentra por principio activo sin tilde: q=paracetamol', async () => {
    const res = await supertest(app).get('/api/v1/productos/buscar?q=paracetamol')
    expect(res.status).toBe(200)
    const ids = res.body.data.map((p: { id: string }) => p.id)
    expect(ids).toContain(productoId)
  })

  it('excluye productos agotados o inactivos aunque coincida el nombre', async () => {
    // Sin lotes vigentes el producto no aparece en la búsqueda pública.
    // Término distinto a los tests anteriores para no leer caché de Redis.
    await prisma.lote.updateMany({ where: { productoId }, data: { cantidadActual: 0 } })
    const res = await supertest(app).get(`/api/v1/productos/buscar?q=${encodeURIComponent('integracion')}`)
    expect(res.status).toBe(200)
    const ids = res.body.data.map((p: { id: string }) => p.id)
    expect(ids).not.toContain(productoId)
  })
})
