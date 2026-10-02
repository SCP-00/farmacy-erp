/**
 * TESTS DE INTEGRACIÓN — Concurrencia multi-caja contra PostgreSQL REAL.
 *
 * Escenario: una farmacia con VARIAS cajas (LAN) vendiendo al mismo tiempo
 * del MISMO lote y la MISMA sucursal. El FEFO atómico (SELECT ... FOR UPDATE)
 * debe garantizar que NUNCA se venda stock inexistente, aunque las ventas
 * lleguen en paralelo.
 *
 * Requisitos: DATABASE_URL con migraciones aplicadas y seeds cargadas.
 * Correr con: pnpm run test:integration
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { prisma, limpiarTransaccional, obtenerAdmin, crearProductoConStock } from './helpers'
import { VentasService } from '../../services/ventas.service'

let admin: { id: string; email: string; rol: string }
const cajasCreadas: string[] = []

beforeAll(async () => {
  admin = await obtenerAdmin()
})

beforeEach(async () => {
  await limpiarTransaccional()
})

afterAll(async () => {
  // ON DELETE SET NULL en ventas.caja_id → borrar las cajas de prueba es seguro
  if (cajasCreadas.length > 0) {
    await prisma.caja.deleteMany({ where: { id: { in: cajasCreadas } } }).catch(() => undefined)
  }
  await prisma.$disconnect()
})

function vender(productoId: string, cantidad: number, cajaId?: string) {
  return VentasService.registrarVenta({
    sucursalId: 1,
    cajaId,
    empleadoId: admin.id,
    metodoPago: 'EFECTIVO',
    items: [{ productoId, cantidad }],
  })
}

describe('Concurrencia multi-caja contra DB real', () => {
  it('12 ventas simultáneas de 1 unidad contra un lote de 5 venden exactamente 5', async () => {
    const { productoId, loteId } = await crearProductoConStock(5)

    const resultados = await Promise.allSettled(
      Array.from({ length: 12 }, () => vender(productoId, 1)),
    )

    const exitosas = resultados.filter(r => r.status === 'fulfilled').length
    const fallidas = resultados.filter(r => r.status === 'rejected').length

    // Nunca más ventas que unidades disponibles
    expect(exitosas).toBe(5)
    expect(fallidas).toBe(7)
    expect(exitosas + fallidas).toBe(12)

    const lote = await prisma.lote.findUnique({ where: { id: loteId } })
    expect(lote!.cantidadActual).toBe(0)

    // La suma de lo vendido coincide EXACTAMENTE con el stock inicial
    const vendidas = await prisma.detalleVenta.aggregate({
      where: { productoId, loteId },
      _sum: { cantidad: true },
    })
    expect(vendidas._sum.cantidad).toBe(5)
  })

  it('dos cajas distintas compiten por 3 unidades: una gana, la otra no sobrevende', async () => {
    const { productoId, loteId } = await crearProductoConStock(3)

    // Dos cajas REALES de la misma sede
    const cajaA = await prisma.caja.create({ data: { sucursalId: 1, empleadoId: admin.id, montoApertura: 0 } })
    const cajaB = await prisma.caja.create({ data: { sucursalId: 1, empleadoId: admin.id, montoApertura: 0 } })
    cajasCreadas.push(cajaA.id, cajaB.id)

    // Caja A pide 2, caja B pide 2, al mismo tiempo: solo cabe una operación
    const [a, b] = await Promise.allSettled([
      vender(productoId, 2, cajaA.id),
      vender(productoId, 2, cajaB.id),
    ])

    const ok = [a, b].filter(r => r.status === 'fulfilled').length
    expect(ok).toBe(1)

    const lote = await prisma.lote.findUnique({ where: { id: loteId } })
    // Queda 1 unidad: la que la caja perdedora no pudo llevarse
    expect(lote!.cantidadActual).toBe(1)
  })

  it('con cantidades mezcladas el stock final nunca es negativo y todo cuadra', async () => {
    const { productoId, loteId } = await crearProductoConStock(8)

    // Cantidades mezcladas y simultáneas (la suma de peticiones supera el stock)
    const cantidades = [3, 1, 4, 2, 5, 2, 1, 3]
    await Promise.allSettled(cantidades.map(c => vender(productoId, c)))

    const lote = await prisma.lote.findUnique({ where: { id: loteId } })
    expect(lote!.cantidadActual).toBeGreaterThanOrEqual(0)

    const vendidas = await prisma.detalleVenta.aggregate({
      where: { productoId, loteId },
      _sum: { cantidad: true },
    })
    const unidadesVendidas = vendidas._sum.cantidad ?? 0

    // Consistencia contable: lo vendido + lo que queda = stock inicial
    expect(unidadesVendidas).toBeLessThanOrEqual(8)
    expect(unidadesVendidas + lote!.cantidadActual).toBe(8)
  })
})
