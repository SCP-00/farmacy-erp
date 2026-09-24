import { Router, Request, Response } from 'express'
import { prisma } from '../../config/database'
import { responder, parsePaginacion } from '../../utils/respuesta.utils'
import { autenticar, autorizar, validarCuerpo, limitarCreacion } from '../../middlewares/index'
import { registrarVentaSchema } from '../../schemas/ventas.schema'
import { VentasService } from '../../services/ventas.service'
import { eventBus, Eventos } from '../../services/eventbus.service'

export const ventasRouter: Router = Router()

// ── GET /dashboard ────────────────────────────────────────
ventasRouter.get('/dashboard',
  autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'),
  async (_req: Request, res: Response) => {
    try {
      const hoy = new Date(); hoy.setHours(0,0,0,0)
      const fin = new Date(); fin.setHours(23,59,59,999)
      const en30 = new Date(); en30.setDate(en30.getDate() + 30)

      const [ventas, stockCritico, porVencer] = await Promise.all([
        prisma.venta.aggregate({
          where:  { creadoEn: { gte: hoy, lte: fin }, estado: 'PAGADO' },
          _sum:   { total: true },
          _count: { id: true },
        }),
        prisma.producto.count({
          where: {
            activo: true,
            lotes: { none: { cantidadActual: { gt: 0 }, fechaVencimiento: { gt: new Date() } } },
          },
        }),
        prisma.lote.count({
          where: {
            cantidadActual:   { gt: 0 },
            fechaVencimiento: { gte: new Date(), lte: en30 },
          },
        }),
      ])

      return responder.ok(res, {
        total_dia:    Number(ventas._sum.total ?? 0),
        transacciones:ventas._count.id,
        stock_critico:stockCritico,
        por_vencer:   porVencer,
      })
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── GET / ─────────────────────────────────────────────────
ventasRouter.get('/', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'),
  async (req: Request, res: Response) => {
    const { pagina, limite, skip } = parsePaginacion(req.query as any)
    const { desde, hasta, estado } = req.query as any
    const esAdmin = req.empleado!.rol === 'ADMINISTRADOR'

    const where: any = {}
    if (!esAdmin) where.empleadoId = req.empleado!.id
    if (desde) where.creadoEn = { ...where.creadoEn, gte: new Date(desde) }
    if (hasta) where.creadoEn = { ...where.creadoEn, lte: new Date(hasta) }
    if (estado) where.estado = estado

    try {
      const [total, ventas] = await Promise.all([
        prisma.venta.count({ where }),
        prisma.venta.findMany({
          where, skip, take: limite,
          orderBy: { creadoEn: 'desc' },
          include: {
            empleado: { select: { nombre: true, apellido: true } },
            cliente:  { select: { nombre: true, apellido: true } },
            caja: { include: { sucursal: { select: { nombre: true } } } },
            _count:   { select: { detalles: true } },
          },
        }),
      ])

      return responder.lista(res,
        ventas.map((v: any) => ({
          ...v,
          cajero: v.empleado ? `${v.empleado.nombre} ${v.empleado.apellido}` : 'Sistema',
          cliente: v.cliente ? `${v.cliente.nombre} ${v.cliente.apellido}` : null,
          sucursal: v.caja?.sucursal?.nombre,
          items: v._count.detalles,
          empleado: undefined, _count: undefined,
        })),
        { pagina, limite, total, totalPaginas: Math.ceil(total / limite) }
      )
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── POST / — Registrar venta (transacción atómica limpia) ─
ventasRouter.post('/', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'), limitarCreacion,
  validarCuerpo(registrarVentaSchema), async (req: Request, res: Response) => {
    try {
      // Delegamos la complejidad al Servicio de Dominio
      const venta = await VentasService.registrarVenta({
        ...req.body,
        empleadoId: req.empleado!.id
      })

      // Emitir evento de venta registrada (para SSE + WS)
      eventBus.emit(Eventos.VENTA_REGISTRADA, {
        ventaId: venta.id,
        numero: venta.numero,
        total: venta.total,
        empleadoId: req.empleado!.id,
        sucursalId: req.body.sucursalId,
        metodoPago: req.body.metodoPago,
        itemsCount: req.body.items?.length ?? 0,
      })

      return responder.creado(res, {
        ventaId: venta.id,
        ventaNum: venta.numero,
        total: venta.total,
      }, 'Venta registrada exitosamente')
    } catch (err: any) {
      return responder.error(res, err.message || 'Error procesando la venta', 400)
    }
  }
)

// ── POST /:id/devolucion ──────────────────────────────────
ventasRouter.post('/:id/devolucion', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'), limitarCreacion,
  async (req: Request, res: Response) => {
    const { motivo, reintegraStock = true } = req.body
    const ventaId = req.params.id

    try {
      const venta = await prisma.venta.findUnique({
        where: { id: ventaId },
        include: { detalles: true, devolucion: true },
      })

      if (!venta)              return responder.noEncontrado(res, 'Venta')
      if (venta.devolucion)    return responder.error(res, 'Esta venta ya tiene una devolución')
      if (venta.estado !== 'PAGADO') return responder.error(res, 'Solo se pueden devolver ventas pagadas')

      // Límite de días configurable en config_param (antes hardcodeado)
      const paramDias = await prisma.configParam.findUnique({ where: { clave: 'DEVOLUCION_DIAS_LIMITE' } })
      const diasLimite = Number(paramDias?.valor ?? 15)
      const diasDesdeVenta = Math.floor(
        (Date.now() - venta.creadoEn.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (diasDesdeVenta > diasLimite) {
        return responder.error(res, `Han pasado más de ${diasLimite} días desde la compra`)
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.venta.update({ where: { id: ventaId }, data: { estado: 'DEVUELTO' } })
        await tx.devolucion.create({
          data: { ventaId, motivo, totalDevuelto: venta.total, reintegraStock },
        })

        if (reintegraStock) {
          for (const d of venta.detalles) {
            if (d.loteId) {
              // Solo reintegra a lotes NO vencidos (producto no vendible si venció)
              const lote = await tx.lote.findUnique({
                where: { id: d.loteId },
                select: { fechaVencimiento: true },
              })
              if (lote && lote.fechaVencimiento > new Date()) {
                await tx.lote.update({
                  where: { id: d.loteId },
                  data:  { cantidadActual: { increment: d.cantidad } },
                })
              }
            }
          }
        }

        // ── Fidelidad: reversión de puntos (antes el cliente se quedaba con todo) ──
        if (venta.clienteId) {
          // 1) Revertir puntos GANADOS con la MISMA regla única de config:
          //    floor((total - costoEnvio) * PUNTOS_POR_PESO); el envío no genera puntos
          const paramPuntos = await prisma.configParam.findUnique({ where: { clave: 'PUNTOS_POR_PESO' } })
          const puntosPorPeso = Number(paramPuntos?.valor ?? '0.01')
          const basePuntos = Math.max(0, Number(venta.total) - Number(venta.costoEnvio ?? 0))
          const puntosGanados = Math.floor(basePuntos * puntosPorPeso)
          // 2) Re-creditar puntos USADOS en esa venta
          const puntosUsados = venta.puntosUsados ?? 0
          const delta = puntosUsados - puntosGanados
          if (delta !== 0) {
            await tx.cliente.update({
              where: { id: venta.clienteId },
              data: { puntosAcumulados: delta > 0 ? { increment: delta } : { decrement: -delta } },
            })
          }
        }
      })

      return responder.ok(res, null, 'Devolución procesada exitosamente')
    } catch (err) { return responder.serverError(res, err) }
  }
)
