import cron from 'node-cron'
import { prisma } from '../config/database'
import { encolarEmail } from './queue'
import { logger } from '../utils/logger'

// Cada día a las 7:00 AM hora Colombia
const CRON_HORARIO = '0 7 * * *'

export function iniciarJobAlertas(): void {
  cron.schedule(
    CRON_HORARIO,
    async () => {
      logger.info('[Job Alertas] Iniciando verificación diaria de inventario...')
      await verificarVencimientos()
      await verificarStockMinimo()
    },
    { timezone: 'America/Bogota' }
  )

  logger.info('[Job Alertas] Programado — todos los días a las 7:00 AM')
}

// ── Umbrales de alerta de vencimiento ──────────────────────
export const UMBRALES_DIAS = [30, 15, 0]

export function obtenerUmbral(diasRestantes: number): { tipo: string; mensaje: string } | null {
  if (diasRestantes <= 0) {
    return { tipo: 'VENCIDO', mensaje: '⚠️ VENCIDO' }
  }
  if (diasRestantes <= 15) {
    return { tipo: 'CRITICO', mensaje: `🔴 Vence en ${diasRestantes} días` }
  }
  if (diasRestantes <= 30) {
    return { tipo: 'PROXIMO_VENCER', mensaje: `🟡 Vence en ${diasRestantes} días` }
  }
  return null
}

// ── Verifica lotes próximos a vencer (30/15/0 días) ────────
async function verificarVencimientos(): Promise<void> {
  const hoy       = new Date()
  const en30Dias  = new Date(hoy)
  en30Dias.setDate(hoy.getDate() + 30)
  // También incluir lotes ya vencidos (dias < 0)
  const hace7Dias = new Date(hoy)
  hace7Dias.setDate(hoy.getDate() - 7)

  try {
    const lotes = await prisma.lote.findMany({
      where: {
        cantidadActual: { gt: 0 },
        fechaVencimiento: {
          gte: hace7Dias,
          lte: en30Dias,
        },
      },
      include: {
        producto:  { select: { nombre: true, concentracion: true } },
        sucursal:  { select: { nombre: true } },
      },
    })

    if (lotes.length === 0) {
      logger.info('[Job Alertas] Sin lotes próximos a vencer')
      return
    }

    // Agrupar por umbral para estadísticas
    let vencidos = 0, criticos = 0, proximos = 0

    // Limpiar alertas previas no leídas de estos lotes antes de crear las nuevas
    const loteIds = lotes.map((l: any) => l.id)
    await prisma.alertaInventario.deleteMany({
      where: { loteId: { in: loteIds }, leida: false },
    }).catch(() => {})

    // Crear alertas frescas en la BD
    for (const lote of lotes) {
      const diasRestantes = Math.ceil(
        (lote.fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
      )

      const umbral = obtenerUmbral(diasRestantes)
      if (!umbral) continue

      if (umbral.tipo === 'VENCIDO') vencidos++
      else if (umbral.tipo === 'CRITICO') criticos++
      else proximos++

      await prisma.alertaInventario.create({
        data: {
          loteId: lote.id,
          tipo: umbral.tipo,
          mensaje: `${lote.producto.nombre} ${lote.producto.concentracion ?? ''} — Lote ${lote.codigoLote} — ${umbral.mensaje} (${lote.sucursal.nombre})`,
        },
      }).catch(() => {})
    }

    logger.warn(`[Job Alertas] Vencidos: ${vencidos} | Críticos: ${criticos} | Próximos: ${proximos}`)

    // Notificar al administrador por email (solo si hay críticos o vencidos)
    if (vencidos + criticos > 0) {
      const admins = await prisma.empleado.findMany({
        where: { rol: 'ADMINISTRADOR', activo: true },
        select: { email: true, nombre: true },
      })

      const resumen = lotes
        .filter((l: { fechaVencimiento: Date }) => {
          const d = Math.ceil((l.fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
          return d <= 15
        })
        .map((l: { producto: { nombre: string; concentracion: string | null }; codigoLote: string; fechaVencimiento: Date; sucursal: { nombre: string } }) => {
          const dias = Math.ceil((l.fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
          const tag = dias <= 0 ? '⚠️ VENCIDO' : '🔴 CRÍTICO'
          return `${tag} — ${l.producto.nombre} ${l.producto.concentracion ?? ''} — Lote ${l.codigoLote} (${l.sucursal.nombre})`
        })
        .join('\n')

      const asunto = vencidos > 0
        ? `🚨 Farmacy: ${vencidos} lotes VENCIDOS y ${criticos} críticos`
        : `⚠️ Farmacy: ${criticos} lotes en estado crítico`

      for (const admin of admins) {
        encolarEmail(
          admin.email,
          asunto,
          `<pre style="font-family:sans-serif;padding:20px">${resumen}</pre>`,
        )
      }
    }
  } catch (err) {
    logger.error('[Job Alertas] Error verificando vencimientos:', err)
  }
}

// ── Verifica stock mínimo ─────────────────────────────────
async function verificarStockMinimo(): Promise<void> {
  try {
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      include: {
        lotes: {
          where: {
            cantidadActual: { gt: 0 },
            fechaVencimiento: { gt: new Date() },
          },
          select: { cantidadActual: true, sucursalId: true },
          include: { sucursal: { select: { nombre: true } } },
        },
      },
    })

    const criticos = productos.filter((p: any) => {
      const stock = p.lotes.reduce((s: number, l: { cantidadActual: number }) => s + l.cantidadActual, 0)
      return stock <= p.stockMinimo
    })

    if (criticos.length === 0) {
      logger.info('[Job Alertas] Sin productos en stock crítico')
      return
    }

    for (const prod of criticos) {
      const stock = prod.lotes.reduce((s: number, l: any) => s + l.cantidadActual, 0)
      await prisma.alertaInventario.create({
        data: {
          tipo: 'STOCK_MINIMO',
          mensaje: `${prod.nombre} ${prod.concentracion ?? ''} — Stock actual: ${stock} (mínimo: ${prod.stockMinimo})`,
        },
      }).catch(() => {})
    }

    logger.warn(`[Job Alertas] ${criticos.length} productos en stock crítico`)

  } catch (err) {
    logger.error('[Job Alertas] Error verificando stock mínimo:', err)
  }
}
