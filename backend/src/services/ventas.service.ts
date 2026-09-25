import { prisma } from '../config/database'
import { InventarioService } from './inventario.service'
import { logger } from '../utils/logger'

// ── Config de negocio (cache corto — editable desde DB sin deploy) ──
let configCache: { data: Record<string, string>; expira: number } | null = null

export function invalidarCacheConfig(): void {
  configCache = null
}

async function obtenerConfig(tx: any): Promise<Record<string, string>> {
  if (configCache && configCache.expira > Date.now()) return configCache.data
  const params = await tx.configParam.findMany()
  const data = Object.fromEntries(params.map((p: any) => [p.clave, p.valor]))
  configCache = { data, expira: Date.now() + 30_000 }
  return data
}

export class VentasService {
  /**
   * ÚNICO camino de dinero del sistema (POS y B2C).
   *
   * Reglas de seguridad:
   *  - `puntosUsados` se recorta al saldo real del cliente (nunca confiar en el cliente).
   *  - `codigoDescuento` se valida y aplica server-side contra la tabla codigos_descuento.
   *  - `precioUnitario` es opcional: si no viene (B2C), se toma del producto en DB.
   *  - El descuento total se limita al subtotal: el total nunca es negativo.
   *  - La regla de puntos es una sola: floor((total - costoEnvio) * PUNTOS_POR_PESO),
   *    vigencia = PUNTOS_VIGENCIA_DIAS desde la compra.
   */
  static async registrarVenta(data: {
    sucursalId: number
    cajaId?: string
    clienteId?: string
    empleadoId: string
    metodoPago: string
    descuento?: number
    codigoDescuento?: string
    puntosUsados?: number
    costoEnvio?: number
    estado?: string // 'PAGADO' (POS) | 'PENDIENTE' (B2C antes de confirmar pasarela)
    registrarPagoEfectivo?: boolean // B2C contra-entrega: crea PagoTransaccion EFECTIVO
    idempotencyKey?: string // Offline fase 1 (ADR 0004): outbox del POS
    items: Array<{ productoId: string; cantidad: number; precioUnitario?: number; descuento?: number }>
  }) {
    // ── 0) Idempotencia offline: si esta venta ya se sincronizó, devolver
    //      la original SIN reprocesar (retry de red no duplica stock).
    if (data.idempotencyKey) {
      const previa = await prisma.ventaSync.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: { venta: { include: { detalles: true } } },
      })
      if (previa) {
        logger.info(`[Venta] Idempotencia offline: key ${data.idempotencyKey} → venta #${previa.venta.numero} ya sincronizada`)
        return previa.venta
      }
    }

    return await prisma.$transaction(async (tx: any) => {
      const config = await obtenerConfig(tx)
      const puntosPorPeso = Number(config.PUNTOS_POR_PESO ?? '0.01')
      const vigenciaDias = Number(config.PUNTOS_VIGENCIA_DIAS ?? '365')

      // ── 1) Cliente y puntos: validar saldo real ──────────────
      let cliente: any = null
      let puntosDescontados = 0
      if (data.clienteId) {
        cliente = await tx.cliente.findUnique({ where: { id: data.clienteId } })
        if (!cliente || !cliente.activo) throw new Error('Cliente no encontrado o inactivo')
        const solicitados = Math.max(0, Math.floor(data.puntosUsados ?? 0))
        puntosDescontados = Math.min(solicitados, cliente.puntosAcumulados)
      }

      // ── 2) FEFO + detalle con costo de lote (margen real) ────
      let subtotal = 0
      const detalles: any[] = []

      for (const item of data.items) {
        // Precio server-side cuando el item no lo trae (B2C)
        let precioUnitario = item.precioUnitario
        if (precioUnitario == null) {
          const producto = await tx.producto.findUnique({
            where: { id: item.productoId },
            select: { precioVenta: true, activo: true },
          })
          if (!producto || !producto.activo) throw new Error(`Producto no disponible: ${item.productoId}`)
          precioUnitario = Number(producto.precioVenta)
        }

        // Descontar inventario FEFO (atómico: falla si el lote cambió en paralelo)
        const lotesUsados = await InventarioService.descontarStockFEFO(
          tx,
          item.productoId,
          data.sucursalId,
          item.cantidad
        )

        let descuentoRestante = item.descuento || 0

        for (const lu of lotesUsados) {
          const valorBruto = precioUnitario * lu.cantidad
          const descuentoAplicar = Math.min(valorBruto, descuentoRestante)
          const valorNeto = valorBruto - descuentoAplicar

          subtotal += valorNeto
          descuentoRestante -= descuentoAplicar

          detalles.push({
            productoId: item.productoId,
            loteId: lu.loteId,
            costoUnitario: Number(lu.precioCompra ?? 0),
            cantidad: lu.cantidad,
            precioUnitario,
            descuento: descuentoAplicar,
            subtotal: valorNeto,
          })
        }
      }

      // ── 3) Cupón server-side: el cliente solo envía el código ─
      let codigoDescuentoId: string | null = null
      let descuentoTotal = Math.max(0, data.descuento ?? 0) // descuento manual solo desde POS autenticado

      if (data.codigoDescuento) {
        const cupon = await tx.codigoDescuento.findUnique({
          where: { codigo: data.codigoDescuento.toUpperCase().trim() },
        })
        const ahora = new Date()
        if (!cupon || !cupon.activo) throw new Error('Cupón inválido')
        if (cupon.fechaInicio && cupon.fechaInicio > ahora) throw new Error('Cupón aún no vigente')
        if (cupon.fechaFin && cupon.fechaFin < ahora) throw new Error('Cupón expirado')
        if (cupon.usosMaximos != null && cupon.usosActuales >= cupon.usosMaximos) throw new Error('Cupón agotado')

        const descuentoCupon = cupon.tipo === 'PORCENTAJE'
          ? (subtotal * Number(cupon.valor)) / 100
          : Math.min(Number(cupon.valor), subtotal)

        descuentoTotal += descuentoCupon
        codigoDescuentoId = cupon.id
        await tx.codigoDescuento.update({
          where: { id: cupon.id },
          data: { usosActuales: { increment: 1 } },
        })
      }

      // El descuento total nunca supera el subtotal
      descuentoTotal = Math.min(descuentoTotal, subtotal)

      const costoEnvio = Math.max(0, data.costoEnvio ?? 0)
      const total = Math.max(0, subtotal - descuentoTotal - puntosDescontados) + costoEnvio

      // ── 4) Registrar venta (numero lo asigna la secuencia de la DB) ──
      const venta = await tx.venta.create({
        data: {
          sucursalId: data.sucursalId,
          cajaId: data.cajaId ?? null,
          empleadoId: data.empleadoId,
          clienteId: data.clienteId ?? null,
          metodoPago: data.metodoPago,
          subtotal,
          descuento: descuentoTotal,
          puntosUsados: puntosDescontados,
          codigoDescuentoId,
          iva: 0,
          costoEnvio,
          total,
          estado: data.estado ?? 'PAGADO',
          detalles: { createMany: { data: detalles } },
        },
        include: { detalles: true },
      })

      // ── 5) Pago contra-entrega (B2C efectivo) ────────────────
      if (data.registrarPagoEfectivo) {
        await tx.pagoTransaccion.create({
          data: {
            ventaId: venta.id,
            pasarela: 'EFECTIVO',
            monto: total,
            moneda: 'COP',
            estado: 'PENDIENTE',
            referenciaExterna: `EF-${venta.numero}`,
          },
        })
      }

      // ── 6) Fidelidad — regla única, server-side ──────────────
      if (cliente) {
        if (puntosDescontados > 0) {
          await tx.cliente.update({
            where: { id: cliente.id },
            data: { puntosAcumulados: { decrement: puntosDescontados } },
          })
        }

        // Puntos sobre lo efectivamente pagado por productos (excluye envío)
        const basePuntos = Math.max(0, total - costoEnvio)
        const puntosGanados = Math.floor(basePuntos * puntosPorPeso)
        if (puntosGanados > 0) {
          const expira = new Date()
          expira.setDate(expira.getDate() + vigenciaDias)
          await tx.cliente.update({
            where: { id: cliente.id },
            data: {
              puntosAcumulados: { increment: puntosGanados },
              puntosExpiranEn: expira,
            },
          })
        }
      }

      logger.info(
        `[Venta] #${venta.numero} — total $${total} — cupón: ${data.codigoDescuento ?? '—'} — puntos usados: ${puntosDescontados}`
      )

      // Registrar la clave de idempotencia dentro de la MISMA transacción:
      // venta creada ⇒ key registrada (átomo). Un sync repetido entra por el
      // early-return de arriba y devuelve esta venta.
      if (data.idempotencyKey) {
        try {
          await tx.ventaSync.create({
            data: { idempotencyKey: data.idempotencyKey, ventaId: venta.id },
          })
        } catch (e: any) {
          // Carrera: otra transacción registró la misma key → toda esta se revierte
          throw new Error(`Venta duplicada (idempotency_key ${data.idempotencyKey} ya registrada)`)
        }
      }

      return venta
    })
  }
}
