import { prisma } from '../config/database'

export class InventarioService {
  /**
   * Obtiene todos los lotes de un producto que tengan stock,
   * ordenados por fecha de vencimiento ascendente (FEFO).
   */
  static async obtenerLotesFEFO(productoId: string, sucursalId: number) {
    return prisma.lote.findMany({
      where: {
        productoId,
        sucursalId,
        cantidadActual: { gt: 0 },
        fechaVencimiento: { gt: new Date() },
      },
      orderBy: { fechaVencimiento: 'asc' },
    })
  }

  /**
   * Descuenta stock de un producto usando el método FEFO.
   * Se ejecuta dentro de una transacción de Prisma.
   *
   * ATOMICIDAD (hardening de concurrencia):
   *  - Bloquea los lotes con SELECT ... FOR UPDATE: dos transacciones
   *    concurrentes no pueden descontar el mismo lote a la vez.
   *  - Usa decrement relativo (nunca read-then-write): sin pérdida de updates.
   *  - Revalida el stock dentro del lock y lanza si es insuficiente →
   *    la transacción entera se revierte (venta y stock, todo o nada).
   */
  static async descontarStockFEFO(
    tx: any,
    productoId: string,
    sucursalId: number,
    cantidadSolicitada: number
  ) {
    const lotes = await tx.$queryRaw<any[]>`
      SELECT "id", "cantidad_actual", "precio_compra"
      FROM "lotes"
      WHERE "producto_id" = ${productoId}::uuid
        AND "sucursal_id" = ${sucursalId}
        AND "cantidad_actual" > 0
        AND "fecha_vencimiento" > NOW()
      ORDER BY "fecha_vencimiento" ASC
      FOR UPDATE
    `

    let restante = cantidadSolicitada
    const detallesLotesModificados = []

    for (const lote of lotes) {
      if (restante <= 0) break

      const cantidadADescontar = Math.min(lote.cantidad_actual, restante)

      // Decrement atómico + revalidación dentro del lock.
      // Si otro tx ya consumió stock, el WHERE no matchea y lo detectamos.
      const actualizado = await tx.lote.updateMany({
        where: {
          id: lote.id,
          cantidadActual: { gte: cantidadADescontar },
        },
        data: { cantidadActual: { decrement: cantidadADescontar } },
      })

      if (actualizado.count === 0) {
        throw new Error(`Conflicto de stock en lote ${lote.id} — reintentar transacción`)
      }

      detallesLotesModificados.push({
        loteId: lote.id,
        cantidad: cantidadADescontar,
        precioCompra: lote.precio_compra,
      })

      restante -= cantidadADescontar
    }

    if (restante > 0) {
      throw new Error(`Sin stock suficiente para el producto ${productoId}. Faltan ${restante} unidades.`)
    }

    return detallesLotesModificados
  }

  /**
   * Recalcula el costo promedio de un producto en base a sus lotes actuales.
   */
  static async actualizarCostoPromedio(productoId: string, nuevoPrecioCompraFallback: number) {
    const lotes = await prisma.lote.findMany({
      where: { productoId, cantidadActual: { gt: 0 } },
      select: { cantidadActual: true, precioCompra: true },
    })

    const totalCantidad = lotes.reduce((s: number, l: any) => s + l.cantidadActual, 0)
    const totalCosto = lotes.reduce((s: number, l: any) => s + (l.cantidadActual * Number(l.precioCompra)), 0)
    const promedio = totalCantidad > 0 ? (totalCosto / totalCantidad) : nuevoPrecioCompraFallback

    await prisma.producto.update({
      where: { id: productoId },
      data: { precioPromedio: promedio },
    })

    return promedio
  }
}
