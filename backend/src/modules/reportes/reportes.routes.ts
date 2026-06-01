import { Router, Request, Response } from 'express'
import { prisma } from '../../config/database'
import { responder } from '../../utils/respuesta.utils'
import { autenticar, autorizar } from '../../middlewares/index'

export const reportesRouter: Router = Router()

reportesRouter.get('/ventas', autenticar, autorizar('ADMINISTRADOR'),
  async (req: Request, res: Response) => {
    const { desde, hasta, sucursalId } = req.query as any
    try {
      const { estado } = req.query as any
      const where: any = {}
      if (desde) where.creadoEn = { gte: new Date(desde) }
      if (hasta) where.creadoEn = { ...where.creadoEn, lte: new Date(hasta) }
      if (sucursalId) where.sucursalId = parseInt(sucursalId)
      if (estado && ['PAGADO', 'PENDIENTE', 'COMPLETADO', 'CANCELADO', 'DEVUELTO'].includes(estado)) {
        where.estado = estado
      }

      // ── Consultas en paralelo ──
      const desdeDate = desde ? new Date(desde) : new Date('2000-01-01')
      const hastaDate = hasta ? new Date(hasta) : new Date('2100-01-01')

      const [totales, porDia, porMetodo, ventas] = await Promise.all([
        prisma.venta.aggregate({
          where,
          _sum:   { total: true, descuento: true },
          _count: { id: true },
          _avg:   { total: true },
        }),
        prisma.$queryRawUnsafe<Array<{ fecha: string; total: number; count: bigint }>>(
          `SELECT DATE(creado_en) as fecha, SUM(total) as total, COUNT(*) as count
           FROM venta
           WHERE creado_en >= $1 AND creado_en <= $2${where.estado ? ` AND estado = $3` : ''}
           GROUP BY DATE(creado_en)
           ORDER BY fecha ASC`,
          desdeDate,
          hastaDate,
          ...(where.estado ? [where.estado] : [])
        ).catch(() => []),
        prisma.venta.groupBy({
          by: ['metodoPago'],
          where,
          _sum:   { total: true },
          _count: { id: true },
        }),
        prisma.venta.findMany({
          where,
          orderBy: { creadoEn: 'desc' },
          include: {
            cliente: { select: { nombre: true, apellido: true, email: true } },
          },
        }),
      ])

      const ventasMapeadas = ventas.map(v => ({
        id: v.id,
        factura: `F-${String(v.numero).padStart(5, '0')}`,
        fecha: v.creadoEn,
        cliente: v.cliente,
        metodoPago: v.metodoPago,
        total: v.total,
        estado: v.estado,
      }))

      // KPIs: facturación solo de ventas PAGADO
      const wherePagado = { ...where, estado: 'PAGADO' }
      const totalesPagados = await prisma.venta.aggregate({
        where: wherePagado,
        _sum: { total: true },
        _count: { id: true },
        _avg: { total: true },
      })
      const clientesUnicos = await prisma.venta.findMany({
        where: { ...where, clienteId: { not: null } },
        select: { clienteId: true },
        distinct: ['clienteId'],
      })

      return responder.ok(res, {
        totales: {
          _sum: { total: totalesPagados._sum.total, descuento: totales._sum.descuento },
          _count: { id: totalesPagados._count.id },
          _avg: { total: totalesPagados._avg?.total ?? 0 },
        },
        porDia,
        porMetodo,
        ventas: ventasMapeadas,
        totalVentas: ventasMapeadas.length,
        montoTotal: Number(totalesPagados._sum.total ?? 0),
        clientesUnicos: clientesUnicos.length,
        sucursales: await prisma.sucursal.findMany({ select: { id: true, nombre: true } }),
      })
    } catch (err) { return responder.serverError(res, err) }
  }
)

reportesRouter.get('/inventario', autenticar, autorizar('ADMINISTRADOR'),
  async (_req: Request, res: Response) => {
    try {
      const en30 = new Date(); en30.setDate(en30.getDate() + 30)
      const [stockTotal, stockCritico, porVencer, agotados] = await Promise.all([
        prisma.lote.aggregate({
          where: { cantidadActual: { gt: 0 } },
          _sum: { cantidadActual: true },
        }),
        prisma.producto.count({
          where: {
            activo: true,
            lotes: { some: { cantidadActual: { lte: 10 } } },
          },
        }),
        prisma.lote.findMany({
          where: { cantidadActual: { gt: 0 }, fechaVencimiento: { gte: new Date(), lte: en30 } },
          include: { producto: { select: { nombre: true } } },
          orderBy: { fechaVencimiento: 'asc' },
        }),
        prisma.producto.count({
          where: { activo: true, lotes: { none: { cantidadActual: { gt: 0 } } } },
        }),
      ])

      return responder.ok(res, {
        stockTotal: stockTotal._sum.cantidadActual,
        stockCritico, agotados, porVencer,
      })
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── GET /compras ───────────────────────────────────────────
reportesRouter.get('/compras', autenticar, autorizar('ADMINISTRADOR'),
  async (req: Request, res: Response) => {
    const { desde, hasta } = req.query as any
    try {
      const where: any = {}
      if (desde) where.creadoEn = { gte: new Date(desde) }
      if (hasta) where.creadoEn = { ...where.creadoEn, lte: new Date(hasta) }

      const [totales, porMes, porProveedor] = await Promise.all([
        prisma.ordenCompra.aggregate({
          where,
          _sum:   { total: true },
          _count: { id: true },
          _avg:   { total: true },
        }),
        prisma.$queryRawUnsafe<Array<{ mes: string; total: number; count: bigint }>>(
          `SELECT TO_CHAR(creado_en, 'YYYY-MM') as mes, SUM(total) as total, COUNT(*) as count
           FROM orden_compra
           WHERE ($1::date IS NULL OR creado_en >= $1)
             AND ($2::date IS NULL OR creado_en <= $2)
           GROUP BY TO_CHAR(creado_en, 'YYYY-MM')
           ORDER BY mes ASC`,
          desde ? new Date(desde) : null,
          hasta ? new Date(hasta) : null
        ).catch(() => []),
        prisma.ordenCompra.groupBy({
          by: ['proveedorId'],
          where,
          _sum:   { total: true },
          _count: { id: true },
        }),
      ])

      return responder.ok(res, { totales, porMes, porProveedor })
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── GET /:tipo/csv — Exportar reporte como CSV ──────────
reportesRouter.get('/:tipo/csv', autenticar, autorizar('ADMINISTRADOR'),
  async (req: Request, res: Response) => {
    const { tipo } = req.params
    const { desde, hasta } = req.query as any

    try {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${tipo}-${new Date().toISOString().slice(0, 10)}.csv"`)

      let csv = ''

      if (tipo === 'ventas') {
        csv = 'Fecha,Numero,Cliente,Total,Estado,MetodoPago\n'
        const where: any = {}
        if (desde) where.creadoEn = { gte: new Date(desde) }
        if (hasta) where.creadoEn = { ...where.creadoEn, lte: new Date(hasta) }

        const ventas = await prisma.venta.findMany({
          where,
          orderBy: { creadoEn: 'desc' },
          select: {
            creadoEn: true, numero: true, total: true,
            estado: true, metodoPago: true,
            cliente: { select: { nombre: true, apellido: true } },
          },
        })

        for (const v of ventas) {
          const cliente = v.cliente ? `${v.cliente.nombre} ${v.cliente.apellido}` : 'Mostrador'
          csv += `${v.creadoEn.toISOString()},${v.numero},"${cliente}",${v.total},${v.estado},${v.metodoPago}\n`
        }
      } else if (tipo === 'compras') {
        csv = 'Fecha,Proveedor,Total,Estado\n'
        const where: any = {}
        if (desde) where.creadoEn = { gte: new Date(desde) }
        if (hasta) where.creadoEn = { ...where.creadoEn, lte: new Date(hasta) }

        const ordenes = await prisma.ordenCompra.findMany({
          where,
          orderBy: { creadoEn: 'desc' },
          select: {
            creadoEn: true, total: true, estado: true,
            proveedor: { select: { nombre: true } },
          },
        })

        for (const o of ordenes) {
          csv += `${o.creadoEn.toISOString()},"${o.proveedor.nombre}",${o.total},${o.estado}\n`
        }
      } else if (tipo === 'inventario') {
        csv = 'Producto,Lote,Cantidad,Vence,Precio\n'
        const lotes = await prisma.lote.findMany({
          where: { cantidadActual: { gt: 0 } },
          orderBy: { fechaVencimiento: 'asc' },
          select: {
            codigoLote: true, cantidadActual: true,
            fechaVencimiento: true, precioCompra: true,
            producto: { select: { nombre: true } },
          },
        })

        for (const l of lotes) {
          csv += `"${l.producto.nombre}",${l.codigoLote},${l.cantidadActual},${l.fechaVencimiento.toISOString().slice(0, 10)},${l.precioCompra}\n`
        }
      } else {
        return responder.error(res, `Tipo de reporte no soportado: ${tipo}`, 400)
      }

      return res.send(csv)
    } catch (err) { return responder.serverError(res, err) }
  }
)