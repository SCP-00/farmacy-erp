/**
 * TESTS DE INTEGRACIÓN — Tirilla ESC/POS contra PostgreSQL REAL.
 *
 * Valida que cargarVentaParaTicket traiga las relaciones correctas
 * (detalles→producto, cliente, empleado, caja→sucursal) con los nombres
 * de campo reales de Prisma, y que la tirilla se genere sin imprimir.
 *
 * Requisitos: DATABASE_URL con migraciones aplicadas y seeds cargadas.
 * Correr con: pnpm run test:integration
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { prisma, crearProductoConStock, obtenerAdmin } from './helpers'
import { VentasService } from '../../services/ventas.service'
import { generarTirillaEscPos } from '../../services/impresion.service'
import { ESCPOS } from '../../utils/escpos.utils'

let admin: { id: string; email: string; rol: string }
const ventasCreadas: string[] = []

beforeAll(async () => {
  admin = await obtenerAdmin()
})

afterEach(async () => {
  for (const ventaId of ventasCreadas) {
    await prisma.ventaSync.deleteMany({ where: { ventaId } })
    await prisma.detalleVenta.deleteMany({ where: { ventaId } })
    await prisma.venta.delete({ where: { id: ventaId } })
  }
  ventasCreadas.length = 0
})

describe('Tirilla ESC/POS contra DB real', () => {
  it('genera la tirilla de una venta real con sus datos', async () => {
    const { productoId } = await crearProductoConStock(5, 4000, 2000)

    const venta = await VentasService.registrarVenta({
      sucursalId: 1,
      empleadoId: admin.id,
      metodoPago: 'EFECTIVO',
      items: [{ productoId, cantidad: 1 }],
    })
    ventasCreadas.push(venta.id)

    const resultado = await generarTirillaEscPos(prisma, venta.id)
    expect(resultado).not.toBeNull()

    const texto = resultado!.buffer.toString('latin1')
    // Encabezado con el número de ticket real
    expect(texto).toContain(`#F-${String(venta.numero).padStart(5, '0')}`)
    expect(texto).toContain('TOTAL:')
    expect(texto).toContain('EFECTIVO')
    expect(texto).toContain('$4.000')
    // Arranca con INIT y termina con corte
    expect([...resultado!.buffer.subarray(0, 2)]).toEqual(ESCPOS.INIT)
    expect([...resultado!.buffer].join(',')).toContain(ESCPOS.CUT_PARCIAL.join(','))
  })

  it('no falla si la venta no existe', async () => {
    expect(await generarTirillaEscPos(prisma, '00000000-0000-0000-0000-000000000000')).toBeNull()
  })
})
