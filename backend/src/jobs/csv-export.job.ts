// ══════════════════════════════════════════════════════════
//  csv-export.job.ts — Lógica de exportación CSV asíncrona
//  Usada por BullMQ worker y también exportable para uso
//  síncrono directo (compatibilidad con ruta existente).
// ══════════════════════════════════════════════════════════
import { prisma } from '../config/database'

export async function exportarCSV(
  tipo: 'ventas' | 'compras' | 'inventario',
  desde?: string,
  hasta?: string,
): Promise<string> {
  let csv = ''

  if (tipo === 'ventas') {
    csv = 'Fecha,Numero,Cliente,Total,Estado,MetodoPago\n'
    const where: Record<string, unknown> = {}
    if (desde) where.creadoEn = { gte: new Date(desde) }
    if (hasta) where.creadoEn = { ...(where.creadoEn as object), lte: new Date(hasta) }

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
    const where: Record<string, unknown> = {}
    if (desde) where.creadoEn = { gte: new Date(desde) }
    if (hasta) where.creadoEn = { ...(where.creadoEn as object), lte: new Date(hasta) }

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
    throw new Error(`Tipo de reporte no soportado: ${tipo}`)
  }

  return csv
}

/** Obtener CSV exportado desde Redis (para descarga async) */
export async function obtenerCSVResultado(jobId: string): Promise<string | null> {
  const { redis } = await import('../config/redis')
  return redis.get(`csv:${jobId}`)
}
