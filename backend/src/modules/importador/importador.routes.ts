import { Router, Request, Response } from 'express'
import { parse } from 'csv-parse/sync'
import { prisma } from '../../config/database'
import { cache } from '../../config/redis'
import { responder } from '../../utils/respuesta.utils'
import { autenticar, autorizar } from '../../middlewares/index'
import { logger } from '../../utils/logger'

export const importadorRouter: Router = Router()

/**
 * Importador de catálogo CSV — carga masiva de productos.
 *
 * Formato esperado (cabecera en la primera línea, delimitador coma o ';'):
 *   cum,nombre,principioActivo,laboratorio,presentacion,concentracion,
 *   precioVenta,stockMinimo,requiereRx,categoria,alergenos,advertencias
 *
 * Reglas:
 *  - `cum` y `nombre` son obligatorios por fila.
 *  - `categoria` se resuelve por nombre (crea la categoría si no existe).
 *  - Upsert por CUM: actualiza precio/stockMinimo si el producto existe.
 *  - Nunca parcial: cada fila se procesa de forma independiente y se
 *    reporta el resultado por fila (creado/actualizado/error).
 */

const CAMPOS_REQUERIDOS = ['cum', 'nombre']

function limpiarValor(v: unknown): string {
  return String(v ?? '').trim()
}

function slugificar(nombre: string, cum: string): string {
  return (
    nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-') + (cum ? '-' + cum : '')
  )
}

// POST /importar/productos — filas CSV crudas en body (texto/csv)
importadorRouter.post(
  '/productos',
  autenticar,
  autorizar('ADMINISTRADOR', 'AUXILIAR'),
  async (req: Request, res: Response) => {
    const csvCrudo = req.body?.csv
    if (!csvCrudo || typeof csvCrudo !== 'string' || !csvCrudo.trim()) {
      return responder.error(res, 'Campo "csv" requerido (contenido del archivo)', 400)
    }
    if (csvCrudo.length > 2_000_000) {
      return responder.error(res, 'Archivo demasiado grande (máx 2MB por lote)', 413)
    }

    let filas: Record<string, string>[]
    try {
      filas = parse(csvCrudo, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: [',', ';'],
        bom: true,
      })
    } catch (err: any) {
      return responder.error(res, `CSV inválido: ${err.message}`, 400)
    }

    if (!filas.length) return responder.error(res, 'El CSV no contiene filas', 400)
    if (filas.length > 5_000) {
      return responder.error(res, 'Máximo 5.000 filas por lote', 413)
    }

    // Cache de categorías para no consultar por fila
    const categoriasCache = new Map<string, number>()
    const resolverCategoria = async (nombreCategoria: string): Promise<number> => {
      const clave = nombreCategoria.toLowerCase()
      if (categoriasCache.has(clave)) return categoriasCache.get(clave)!
      let cat = await prisma.categoria.findFirst({ where: { nombre: { equals: nombreCategoria, mode: 'insensitive' } } })
      if (!cat) {
        cat = await prisma.categoria.create({
          data: {
            nombre: nombreCategoria,
            slug: nombreCategoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-'),
          },
        })
      }
      categoriasCache.set(clave, cat.id)
      return cat.id
    }

    const resultados: Array<{ fila: number; cum: string; accion: 'creado' | 'actualizado' | 'error'; detalle?: string }> = []
    let creados = 0
    let actualizados = 0
    let errores = 0

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i]
      const cum = limpiarValor(fila.cum)
      const nombre = limpiarValor(fila.nombre)

      // Validación mínima por fila
      const faltantes = CAMPOS_REQUERIDOS.filter((c) => !limpiarValor(fila[c]))
      if (faltantes.length) {
        resultados.push({ fila: i + 1, cum: cum || '(vacío)', accion: 'error', detalle: `Campos requeridos faltantes: ${faltantes.join(', ')}` })
        errores++
        continue
      }

      try {
        const datosProducto = {
          nombre,
          principioActivo: limpiarValor(fila.principioActivo),
          laboratorio: limpiarValor(fila.laboratorio) || null,
          presentacion: limpiarValor(fila.presentacion) || null,
          concentracion: limpiarValor(fila.concentracion) || null,
          precioVenta: Number(limpiarValor(fila.precioVenta) || '0'),
          stockMinimo: Number(limpiarValor(fila.stockMinimo) || '10'),
          requiereRx: ['true', 'si', 'sí', '1', 'x'].includes(limpiarValor(fila.requiereRx).toLowerCase()),
          alergenos: limpiarValor(fila.alergenos) || null,
          advertencias: limpiarValor(fila.advertencias) || null,
        }

        if (datosProducto.precioVenta < 0 || !Number.isFinite(datosProducto.precioVenta)) {
          throw new Error(`precioVenta inválido: ${fila.precioVenta}`)
        }

        const categoriaId = await resolverCategoria(limpiarValor(fila.categoria) || 'General')

        const existente = await prisma.producto.findUnique({ where: { cum } })
        if (existente) {
          await prisma.producto.update({
            where: { cum },
            data: { ...datosProducto, categoriaId },
          })
          resultados.push({ fila: i + 1, cum, accion: 'actualizado' })
          actualizados++
        } else {
          await prisma.producto.create({
            data: {
              cum,
              registroInvima: limpiarValor(fila.registroInvima) || 'SIN-REGISTRO',
              slug: slugificar(nombre, cum),
              ...datosProducto,
              categoriaId,
            },
          })
          resultados.push({ fila: i + 1, cum, accion: 'creado' })
          creados++
        }
      } catch (err: any) {
        resultados.push({ fila: i + 1, cum, accion: 'error', detalle: err.message?.slice(0, 200) })
        errores++
      }
    }

    // Invalidar cache de catálogo tras la carga
    await cache.delPattern('productos:buscar:*').catch(() => undefined)
    logger.info(`[Importador] CSV: ${creados} creados, ${actualizados} actualizados, ${errores} errores`)

    return responder.ok(res, {
      totalFilas: filas.length,
      creados,
      actualizados,
      errores,
      resultados,
    }, 'Importación procesada')
  }
)
