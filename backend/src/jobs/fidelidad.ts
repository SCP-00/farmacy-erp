// ══════════════════════════════════════════════════════════
//  fidelidad.ts — Jobs de fidelidad y pedidos huérfanos
//
//  1) EXPIRACIÓN DE PUNTOS: clientes cuyo puntosExpiranEn ya pasó
//     pierden el saldo (regla de negocio real — antes era solo
//     promesa de marketing sin código).
//
//  2) PEDIDOS HUÉRFANOS: ventas B2C en PENDIENTE cuyo pago nunca
//     fue confirmado (pasarela rechazada / usuario abandonó) seguían
//     secuestrando stock FEFO para siempre. Este sweeper las cancela
//     (estado EXPIRADO), reintegra el stock a los lotes originales y
//     revierte el uso del cupón. Ejecutar DESPUÉS del delay máximo de
//     confirmación de pasarelas (PEDIDO_HUERFANO_HORAS, default 24h).
//
//  Nota: los puntos GANADOS por una venta nunca existieron (se
//  otorgan solo al confirmar pago en el flujo normal), por eso el
//  sweeper no toca saldos — solo stock y cupones.
// ══════════════════════════════════════════════════════════
import cron from 'node-cron'
import { prisma } from '../config/database'
import { logger } from '../utils/logger'

const TZ = 'America/Bogota'

async function obtenerHorasHuerfano(): Promise<number> {
  try {
    const param = await prisma.configParam.findUnique({ where: { clave: 'PEDIDO_HUERFANO_HORAS' } })
    const horas = Number(param?.valor)
    return Number.isFinite(horas) && horas > 0 ? horas : 24
  } catch {
    return 24
  }
}

// ── 1) Expiración de puntos — diaria 03:00 ────────────────
export async function expirarPuntosVencidos(): Promise<number> {
  const ahora = new Date()
  const clientes = await prisma.cliente.findMany({
    where: {
      puntosAcumulados: { gt: 0 },
      puntosExpiranEn: { lt: ahora },
    },
    select: { id: true, puntosAcumulados: true },
  })

  for (const c of clientes) {
    await prisma.cliente.update({
      where: { id: c.id },
      data: { puntosAcumulados: 0, puntosExpiranEn: null },
    })
  }

  if (clientes.length > 0) {
    logger.info(`[Fidelidad] ${clientes.length} clientes con puntos expirados zereados`)
  }
  return clientes.length
}

// ── 2) Sweeper de pedidos huérfanos — cada hora ───────────
export async function expirarPedidosHuerfanos(): Promise<number> {
  const horas = await obtenerHorasHuerfano()
  const corte = new Date(Date.now() - horas * 60 * 60 * 1000)

  // Ventas PENDIENTE sin pago APROBADO creadas antes del corte.
  // (POS nunca crea PENDIENTE sin pago: ese estado solo nace en B2C.)
  const huerfanas = await prisma.venta.findMany({
    where: {
      estado: 'PENDIENTE',
      creadoEn: { lt: corte },
      pagos: { none: { estado: 'APROBADO' } },
    },
    include: {
      detalles: { select: { loteId: true, cantidad: true } },
      codigoDescuento: { select: { id: true } },
    },
    take: 200, // lotes acotados por corrida
  })

  for (const venta of huerfanas) {
    try {
      await prisma.$transaction(async (tx: any) => {
        // Reintegrar stock SOLO a lotes que aún no vencieron
        for (const d of venta.detalles) {
          if (!d.loteId) continue
          const lote = await tx.lote.findUnique({
            where: { id: d.loteId },
            select: { fechaVencimiento: true },
          })
          if (!lote) continue
          if (lote.fechaVencimiento > new Date()) {
            await tx.lote.update({
              where: { id: d.loteId },
              data: { cantidadActual: { increment: d.cantidad } },
            })
          }
          // Lote vencido: el stock NO se reintegra (producto no vendible)
        }

        // Revertir el uso del cupón para no consumir usos de nada
        if (venta.codigoDescuento?.id) {
          await tx.codigoDescuento.update({
            where: { id: venta.codigoDescuento.id },
            data: { usosActuales: { decrement: 1 } },
          })
        }

        await tx.venta.update({
          where: { id: venta.id },
          data: { estado: 'EXPIRADO' },
        })

        // Marcar transacciones de pago pendientes como rechazadas por expiración
        await tx.pagoTransaccion.updateMany({
          where: { ventaId: venta.id, estado: 'PENDIENTE' },
          data: { estado: 'RECHAZADO' },
        })
      })
      logger.info(`[Fidelidad] Pedido huérfano #${venta.numero} expirado — stock reintegrado`)
    } catch (err: any) {
      logger.error(`[Fidelidad] Error expirando venta ${venta.id}: ${err.message}`)
    }
  }

  return huerfanas.length
}

// ── Registro de cron jobs ─────────────────────────────────
export function iniciarJobsFidelidad(): void {
  cron.schedule('0 3 * * *', () => {
    expirarPuntosVencidos().catch((err) =>
      logger.error(`[Fidelidad] Error en expiración de puntos: ${err.message}`)
    )
  }, { timezone: TZ })

  cron.schedule('0 * * * *', () => {
    expirarPedidosHuerfanos().catch((err) =>
      logger.error(`[Fidelidad] Error en sweeper de huérfanos: ${err.message}`)
    )
  }, { timezone: TZ })

  logger.info('[Fidelidad] Jobs programados — puntos (03:00 diaria) y huérfanos (cada hora)')
}
