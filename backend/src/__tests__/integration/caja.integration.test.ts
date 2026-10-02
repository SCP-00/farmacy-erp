/**
 * TESTS DE INTEGRACIÓN — Arqueo de caja contra PostgreSQL REAL.
 *
 * Valida el esquema de caja (migración 0006: columnas de arqueo, enum
 * TipoMovimientoCaja y tabla caja_movimientos) y el cálculo del efectivo
 * esperado con ventas mixtas y movimientos manuales de efectivo.
 *
 * Requisitos: DATABASE_URL con migraciones aplicadas y seeds cargadas.
 * Correr con: pnpm run test:integration
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { prisma, crearProductoConStock, obtenerAdmin } from './helpers'
import { VentasService } from '../../services/ventas.service'
import { calcularResumenCaja, calcularDiferencia } from '../../services/caja.service'

let admin: { id: string; email: string; rol: string }
const cajasCreadas: string[] = []

beforeAll(async () => {
  admin = await obtenerAdmin()
})

afterEach(async () => {
  // Limpieza acotada: solo las cajas creadas por este archivo.
  for (const cajaId of cajasCreadas) {
    await prisma.cajaMovimiento.deleteMany({ where: { cajaId } })
    await prisma.ventaSync.deleteMany({ where: { venta: { cajaId } } })
    await prisma.detalleVenta.deleteMany({ where: { venta: { cajaId } } })
    await prisma.venta.deleteMany({ where: { cajaId } })
    await prisma.caja.delete({ where: { id: cajaId } })
  }
  cajasCreadas.length = 0
})

describe('Arqueo de caja contra DB real', () => {
  it('calcula el efectivo esperado con ventas mixtas y una sangría', async () => {
    const { productoId } = await crearProductoConStock(20, 5000, 2000)

    const caja = await prisma.caja.create({
      data: { sucursalId: 1, empleadoId: admin.id, montoApertura: 100000 },
    })
    cajasCreadas.push(caja.id)

    // Venta en efectivo $10.000 y venta online $5.000, ambas en la misma caja
    await VentasService.registrarVenta({
      sucursalId: 1, cajaId: caja.id, empleadoId: admin.id, metodoPago: 'EFECTIVO',
      items: [{ productoId, cantidad: 2 }],
    })
    await VentasService.registrarVenta({
      sucursalId: 1, cajaId: caja.id, empleadoId: admin.id, metodoPago: 'WOMPI',
      items: [{ productoId, cantidad: 1 }],
    })

    // Sangría: salen $30.000 de la gaveta
    await prisma.cajaMovimiento.create({
      data: { cajaId: caja.id, tipo: 'SANGRIA', monto: 30000, motivo: 'Retiro a caja fuerte', empleadoId: admin.id },
    })

    const resumen = await calcularResumenCaja(prisma, caja.id)
    expect(resumen).not.toBeNull()
    expect(resumen!.totalEfectivo).toBe(10000)
    expect(resumen!.totalOnline).toBe(5000)
    expect(resumen!.totalTarjeta).toBe(0)
    expect(resumen!.totalVentas).toBe(15000)
    expect(resumen!.totalSangrias).toBe(30000)
    expect(resumen!.totalIngresos).toBe(0)
    // esperado = apertura 100000 + efectivo 10000 − sangría 30000 = 80000
    expect(resumen!.efectivoEsperado).toBe(80000)

    // El movimiento quedó persistido con su enum y su empleado
    expect(resumen!.movimientos).toHaveLength(1)
    expect(resumen!.movimientos[0].tipo).toBe('SANGRIA')
    expect(resumen!.movimientos[0].empleado.nombre).toBeTruthy()
  })

  it('un ingreso de efectivo aumenta el efectivo esperado', async () => {
    const caja = await prisma.caja.create({
      data: { sucursalId: 1, empleadoId: admin.id, montoApertura: 50000 },
    })
    cajasCreadas.push(caja.id)

    await prisma.cajaMovimiento.create({
      data: { cajaId: caja.id, tipo: 'INGRESO', monto: 25000, motivo: 'Cambio adicional', empleadoId: admin.id },
    })

    const resumen = await calcularResumenCaja(prisma, caja.id)
    // esperado = 50000 + 0 ventas + 25000 ingreso = 75000
    expect(resumen!.efectivoEsperado).toBe(75000)
    expect(calcularDiferencia(73000, resumen!.efectivoEsperado)).toBe(-2000)
  })
})
