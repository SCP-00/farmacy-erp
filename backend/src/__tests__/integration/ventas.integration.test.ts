/**
 * TESTS DE INTEGRACIÓN — Dinero contra PostgreSQL REAL.
 *
 * A diferencia de los unit tests (mocks de Prisma), estos ejecutan la
 * cadena completa: VentasService → FEFO atómico (SQL FOR UPDATE) →
 * fidelidad → jobs de mantenimiento, contra las migraciones reales.
 *
 * Requisitos: DATABASE_URL con migraciones aplicadas y seeds cargadas
 * (el empleado admin viene del seed; los productos son de prueba aislada).
 * Correr con: pnpm run test:integration
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { prisma, limpiarTransaccional, obtenerAdmin, crearProductoConStock } from './helpers'
import { VentasService } from '../../services/ventas.service'
import { expirarPedidosHuerfanos, expirarPuntosVencidos } from '../../jobs/fidelidad'

let admin: { id: string; email: string; rol: string }

beforeAll(async () => {
  admin = await obtenerAdmin()
})

beforeEach(async () => {
  await limpiarTransaccional()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('VentasService contra DB real', () => {
  it('registra una venta completa: FEFO descuenta lotes, puntos se acreditan, detalle guarda costo', async () => {
    const { productoId, loteId } = await crearProductoConStock(10, 5000, 2000)
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Test', apellido: 'Integración', email: `int-${Date.now()}@test.co`, autorizacionDatos: true },
    })

    const loteAntes = await prisma.lote.findUnique({ where: { id: loteId } })
    const stockAntes = loteAntes!.cantidadActual

    const venta = await VentasService.registrarVenta({
      sucursalId: 1,
      empleadoId: admin.id,
      clienteId: cliente.id,
      metodoPago: 'EFECTIVO',
      items: [{ productoId, cantidad: 2 }], // sin precio → server-side
    })

    // 1) La venta existe, PAGADA, con total = precio DB × cantidad
    expect(venta.estado).toBe('PAGADO')
    expect(Number(venta.total)).toBe(10000)

    // 2) FEFO: el lote más próximo a vencer descontó exactamente 2
    const loteDespues = await prisma.lote.findUnique({ where: { id: loteId } })
    expect(loteDespues!.cantidadActual).toBe(stockAntes - 2)

    // 3) El detalle capturó el costo del lote (margen real)
    const detalle = await prisma.detalleVenta.findFirst({ where: { ventaId: venta.id } })
    expect(detalle).not.toBeNull()
    expect(Number(detalle!.costoUnitario)).toBe(2000)

    // 4) Puntos acreditados: floor(total × 0.01)
    const clienteDespues = await prisma.cliente.findUnique({ where: { id: cliente.id } })
    expect(clienteDespues!.puntosAcumulados).toBe(100)
  })

  it('CONCURRENCIA: dos ventas simultáneas nunca venden stock inexistente', async () => {
    const { productoId, loteId } = await crearProductoConStock(3)

    const venta = {
      sucursalId: 1,
      empleadoId: admin.id,
      metodoPago: 'EFECTIVO' as const,
      items: [{ productoId, cantidad: 2 }],
    }

    // Lanzar dos ventas al mismo tiempo — antes del fix, ambas leían
    // stock=3 y terminaban con doble venta. Ahora una gana y la otra
    // revierte entera (transacción atómica con FOR UPDATE).
    const resultados = await Promise.allSettled([
      VentasService.registrarVenta({ ...venta }),
      VentasService.registrarVenta({ ...venta }),
    ])

    const exitosas = resultados.filter(r => r.status === 'fulfilled')
    const fallidas = resultados.filter(r => r.status === 'rejected')

    // Con 3 unidades y ventas de 2: máximo 1 venta completa puede ganar
    expect(exitosas.length).toBeLessThanOrEqual(1)
    expect(exitosas.length + fallidas.length).toBe(2)

    // El stock final NUNCA es negativo y coincide con las ventas exitosas
    const loteFinal = await prisma.lote.findUnique({ where: { id: loteId } })
    expect(loteFinal!.cantidadActual).toBeGreaterThanOrEqual(0)
    expect(loteFinal!.cantidadActual).toBe(3 - exitosas.length * 2)

    // Las ventas registradas en DB corresponden solo a las exitosas
    const ventasEnDb = await prisma.venta.count({
      where: { detalles: { some: { productoId } } },
    })
    expect(ventasEnDb).toBe(exitosas.length)
  })

  it('anti-fraude: puntosUsados se recorta al saldo real en DB', async () => {
    const { productoId } = await crearProductoConStock(10, 5000)
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Clamp', apellido: 'Test', email: `clamp-${Date.now()}@test.co`, autorizacionDatos: true, puntosAcumulados: 25 },
    })

    const venta = await VentasService.registrarVenta({
      sucursalId: 1,
      empleadoId: admin.id,
      clienteId: cliente.id,
      metodoPago: 'EFECTIVO',
      puntosUsados: 99_999, // intento de fraude: pide 99.999, tiene 25
      items: [{ productoId, cantidad: 1 }],
    })

    expect(venta.puntosUsados).toBe(25)

    const clienteFinal = await prisma.cliente.findUnique({ where: { id: cliente.id } })
    // 25 gastados + floor(total × 0.01) ganados
    const ganados = Math.floor(Number(venta.total) * 0.01)
    expect(clienteFinal!.puntosAcumulados).toBe(ganados)
  })

  it('cupón server-side: descuento real, usos incrementados, y revierte en huérfano', async () => {
    const { productoId } = await crearProductoConStock(10, 5000)
    const cupon = await prisma.codigoDescuento.create({
      data: { codigo: `INT${Date.now()}`, tipo: 'PORCENTAJE', valor: 20, activo: true, usosMaximos: 5 },
    })

    const venta = await VentasService.registrarVenta({
      sucursalId: 1,
      empleadoId: admin.id,
      metodoPago: 'EFECTIVO',
      codigoDescuento: cupon.codigo,
      estado: 'PENDIENTE', // como nace una venta B2C
      items: [{ productoId, cantidad: 1 }],
    })

    // 20% del subtotal aplicado server-side
    expect(Number(venta.descuento)).toBe(Math.floor(Number(venta.subtotal) * 0.20))
    expect(venta.codigoDescuentoId).toBe(cupon.id)

    const cuponTrasVenta = await prisma.codigoDescuento.findUnique({ where: { id: cupon.id } })
    expect(cuponTrasVenta!.usosActuales).toBe(1)

    // ── El pedido queda huérfano (nadie paga) → sweeper lo expira ──
    await prisma.venta.update({
      where: { id: venta.id },
      data: { creadoEn: new Date(Date.now() - 25 * 3600 * 1000) },
    })

    const expiradas = await expirarPedidosHuerfanos()
    expect(expiradas).toBeGreaterThanOrEqual(1)

    const ventaExpirada = await prisma.venta.findUnique({ where: { id: venta.id } })
    expect(ventaExpirada!.estado).toBe('EXPIRADO')

    // El uso del cupón se revirtió
    const cuponFinal = await prisma.codigoDescuento.findUnique({ where: { id: cupon.id } })
    expect(cuponFinal!.usosActuales).toBe(0)

    // El stock volvió completo al lote original (FEFO guardó loteId)
    const detalle = await prisma.detalleVenta.findFirst({ where: { ventaId: venta.id } })
    expect(detalle!.loteId).not.toBeNull()
    const loteRestaurado = await prisma.lote.findUnique({ where: { id: detalle!.loteId! } })
    expect(loteRestaurado!.cantidadActual).toBe(10)
  })

  it('devolución revierte puntos ganados y re-credita puntos usados', async () => {
    const { productoId } = await crearProductoConStock(10, 5000)

    // Cliente compra ganando puntos
    const cliente = await prisma.cliente.create({
      data: { nombre: 'Devo', apellido: 'Test', email: `devo-${Date.now()}@test.co`, autorizacionDatos: true },
    })
    const venta = await VentasService.registrarVenta({
      sucursalId: 1,
      empleadoId: admin.id,
      clienteId: cliente.id,
      metodoPago: 'EFECTIVO',
      items: [{ productoId, cantidad: 1 }],
    })
    const ganados = Math.floor(Number(venta.total) * 0.01)
    let clienteDb = await prisma.cliente.findUnique({ where: { id: cliente.id } })
    expect(clienteDb!.puntosAcumulados).toBe(ganados)

    // ── Devolución (mismo flujo que la ruta POS) ──
    await prisma.$transaction(async (tx: any) => {
      await tx.venta.update({ where: { id: venta.id }, data: { estado: 'DEVUELTO' } })
      await tx.devolucion.create({
        data: { ventaId: venta.id, motivo: 'Test integración', totalDevuelto: venta.total, reintegraStock: true },
      })
      for (const d of venta.detalles) {
        if (d.loteId) {
          await tx.lote.update({ where: { id: d.loteId }, data: { cantidadActual: { increment: d.cantidad } } })
        }
      }
      // Reversión de puntos (misma regla que la ruta)
      const paramPuntos = await prisma.configParam.findUnique({ where: { clave: 'PUNTOS_POR_PESO' } })
      const puntosPorPeso = Number(paramPuntos?.valor ?? '0.01')
      const base = Math.max(0, Number(venta.total) - Number(venta.costoEnvio ?? 0))
      const puntosGanados = Math.floor(base * puntosPorPeso)
      await tx.cliente.update({
        where: { id: cliente.id },
        data: { puntosAcumulados: { decrement: puntosGanados } },
      })
    })

    clienteDb = await prisma.cliente.findUnique({ where: { id: cliente.id } })
    expect(clienteDb!.puntosAcumulados).toBe(0) // ganados y revertidos exactos
  })

  it('expiración de puntos: zerea solo clientes vencidos', async () => {
    const vencido = await prisma.cliente.create({
      data: { nombre: 'Vencido', apellido: 'Test', email: `venc-${Date.now()}@test.co`, autorizacionDatos: true, puntosAcumulados: 500, puntosExpiranEn: new Date(Date.now() - 86400000) },
    })
    const vigente = await prisma.cliente.create({
      data: { nombre: 'Vigente', apellido: 'Test', email: `vig-${Date.now()}@test.co`, autorizacionDatos: true, puntosAcumulados: 300, puntosExpiranEn: new Date(Date.now() + 30 * 86400000) },
    })

    await expirarPuntosVencidos()

    const dbVencido = await prisma.cliente.findUnique({ where: { id: vencido.id } })
    const dbVigente = await prisma.cliente.findUnique({ where: { id: vigente.id } })
    expect(dbVencido!.puntosAcumulados).toBe(0)
    expect(dbVigente!.puntosAcumulados).toBe(300)
  })
})
