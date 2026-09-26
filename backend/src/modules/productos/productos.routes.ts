// ══════════════════════════════════════════════════════════
//  MÓDULO PRODUCTOS (Con soporte para CUM / INVIMA / Alérgenos)
// ══════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { cache } from '../../config/redis'
import { responder, parsePaginacion } from '../../utils/respuesta.utils'
import { qLike } from '../../utils/texto.utils'
import { autenticar, autorizar, validarQuery, limitarCreacion, limitarBusqueda } from '../../middlewares/index'

export const productosRouter: Router = Router()

// ── Schemas de Validación ─────────────────────────────────
const buscarSchema = z.object({
  q:          z.string().optional().default(''),
  categoria:  z.string().optional(),
  rx:         z.enum(['true','false']).optional(),
  ordenar:    z.enum(['nombre','precio_asc','precio_desc','stock']).optional().default('nombre'),
  pagina:     z.string().optional().default('1'),
  limite:     z.string().optional().default('20'),
})

// Schema para GET / (admin list) — previene inyección de objetos en query params
const listarAdminSchema = z.object({
  q:           z.string().optional(),
  categoriaId: z.string().optional(),
  activo:      z.string().optional(),
  pagina:      z.string().optional(),
  limite:      z.string().optional(),
})

// ══════════════════════════════════════════════════════════
//  GET /buscar — Búsqueda pública (Excluye Muestras Médicas)
// ══════════════════════════════════════════════════════════
productosRouter.get('/buscar', limitarBusqueda, validarQuery(buscarSchema), async (req: Request, res: Response) => {
  const { q, categoria, rx, ordenar } = req.query as any
  const { skip, limite: lim, pagina: pag } = parsePaginacion(req.query as any)

  const cacheKey = `productos:buscar:${JSON.stringify(req.query)}`
  const cached = await cache.get(cacheKey)
  if (cached) return responder.lista(res, (cached as any).data, (cached as any).meta)

  try {
    const where: any = {
      activo: true,
      esMuestraMedica: false, // ⚠️ BLOQUEO LEGAL: Muestras médicas no se venden
      lotes: {
        some: {
          cantidadActual: { gt: 0 },
          fechaVencimiento: { gt: new Date() },
        },
      },
    }

    if (q && q.trim().length > 0) {
      // Búsqueda insensible a acentos (migración 0005): "acetaminofen"
      // encuentra "Acetaminofén". nombre_normalizado (columna mantenida
      // por trigger) usa el índice GIN trigram; el resto de columnas se
      // normaliza en la misma query con unaccent(lower(...)).
      const patron = qLike(q)
      const filas = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT p.id FROM "productos" p
        WHERE p."nombre_normalizado" LIKE ${patron}
           OR unaccent(lower(p."principio_activo")) LIKE ${patron}
           OR unaccent(lower(p."laboratorio")) LIKE ${patron}
           OR unaccent(lower(p."concentracion")) LIKE ${patron}
           OR unaccent(lower(p."descripcion")) LIKE ${patron}`
      where.id = { in: filas.map(f => f.id) }
    }

    if (categoria) where.categoria = { slug: categoria }
    if (rx !== undefined) where.requiereRx = rx === 'true'

    const orderMap: Record<string, any> = {
      nombre:      { nombre: 'asc' },
      precio_asc:  { precioVenta: 'asc' },
      precio_desc: { precioVenta: 'desc' },
      stock:       { lotes: { _count: 'desc' } },
    }

    const [total, productos] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where,
        skip,
        take: lim,
        orderBy: orderMap[ordenar] ?? { nombre: 'asc' },
        select: {
          id: true, nombre: true, slug: true, presentacion: true,
          concentracion: true, laboratorio: true, requiereRx: true,
          precioVenta: true, imagenUrl: true, cum: true, registroInvima: true,
          principioActivo: true, atc: true, descripcionAtc: true,
          titular: true, expediente: true,
          formaFarmaceutica: true, viaAdministracion: true,
          estadoCum: true, estadoRegistro: true,
          fechaExpedicion: true, fechaVencimientoRegistro: true,
          fechaActivoCum: true, fechaInactivoCum: true,
          esMuestraMedica: true,
          alergenos: true, advertencias: true,
          indicaciones: true, contraindicaciones: true,
          reaccionesAdversas: true, interacciones: true, modoUso: true,
          unidadReferencia: true, cantidad: true, unidadMedida: true,
          modalidad: true, ium: true,
          categoria: { select: { nombre: true, slug: true, icono: true } },
          lotes: {
            where: { cantidadActual: { gt: 0 }, fechaVencimiento: { gt: new Date() } },
            select: { cantidadActual: true },
          },
        },
      }),
    ])

    const resultado = productos.map((p: any) => ({
      ...p,
      stockTotal: p.lotes.reduce((s: number, l: any) => s + l.cantidadActual, 0),
      lotes: undefined,
    }))

    const meta = { pagina: pag, limite: lim, total, totalPaginas: Math.ceil(total / lim) }
    await cache.set(cacheKey, { data: resultado, meta }, 300)

    return responder.lista(res, resultado, meta)
  } catch (err) {
    return responder.serverError(res, err)
  }
})

// ══════════════════════════════════════════════════════════
//  GET / — Listado administrativo completo
// ══════════════════════════════════════════════════════════
productosRouter.get('/', autenticar, validarQuery(listarAdminSchema), limitarBusqueda, async (req: Request, res: Response) => {
  const { skip, limite, pagina } = parsePaginacion(req.query as any)
  const { q, categoriaId, activo } = req.query as any

  const where: any = {}
  if (q) {
    // Misma técnica que /buscar: unaccent (migración 0005)
    const patron = qLike(q)
    const filas = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id FROM "productos" p
      WHERE p."nombre_normalizado" LIKE ${patron}
         OR unaccent(lower(p."registro_invima")) LIKE ${patron}
         OR unaccent(lower(p."cum")) LIKE ${patron}`
    where.id = { in: filas.map(f => f.id) }
  }
  if (categoriaId) where.categoriaId = parseInt(categoriaId)
  if (activo !== undefined) where.activo = activo === 'true'

  try {
    const [total, productos] = await Promise.all([
      prisma.producto.count({ where }),
      prisma.producto.findMany({
        where, skip, take: limite,
        orderBy: { nombre: 'asc' },
        include: {
          categoria: { select: { nombre: true, icono: true } },
          lotes: {
            where: { cantidadActual: { gt: 0 } },
            select: { cantidadActual: true, fechaVencimiento: true, codigoLote: true },
            orderBy: { fechaVencimiento: 'asc' },
          },
        },
      }),
    ])

    const resultado = productos.map((p: any) => ({
      ...p,
      stockTotal: p.lotes.reduce((s: number, l: any) => s + l.cantidadActual, 0),
      proximoVencer: p.lotes[0]?.fechaVencimiento ?? null,
      stockBajo: p.lotes.reduce((s: number, l: any) => s + l.cantidadActual, 0) <= p.stockMinimo,
    }))

    return responder.lista(res, resultado, {
      pagina, limite, total, totalPaginas: Math.ceil(total / limite),
    })
  } catch (err) {
    return responder.serverError(res, err)
  }
})

// ── GET /:id ──────────────────────────────────────────────
productosRouter.get('/:id', limitarBusqueda, async (req: Request, res: Response) => {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: req.params.id },
      include: {
        categoria: true,
        lotes: {
          where: { cantidadActual: { gt: 0 } },
          orderBy: { fechaVencimiento: 'asc' },
          include: { sucursal: { select: { nombre: true } } },
        },
      },
    })
    if (!producto) return responder.noEncontrado(res, 'Producto')
    return responder.ok(res, producto)
  } catch (err) {
    return responder.serverError(res, err)
  }
})

// ── POST / ────────────────────────────────────────────────
productosRouter.post('/', autenticar, autorizar('ADMINISTRADOR', 'AUXILIAR'), limitarCreacion, async (req: Request, res: Response) => {
  const data = req.body
  const slug = data.nombre.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    + (data.cum ? '-' + data.cum : '')

  try {
    const producto = await prisma.producto.create({
      data: { ...data, slug, precioVenta: data.precioVenta },
      include: { categoria: { select: { nombre: true } } },
    })
    await cache.delPattern('productos:buscar:*')
    return responder.creado(res, producto)
  } catch (err: any) {
    if (err.code === 'P2002') {
      return responder.error(res, 'Ya existe un producto con ese CUM o Registro INVIMA', 409)
    }
    return responder.serverError(res, err)
  }
})

// ── PATCH /:id ────────────────────────────────────────────
// Registra automáticamente cambios en precio + campos críticos en HistorialCambio
const CAMPOS_TRACKING = ['precioVenta', 'precioPromedio', 'stockMinimo', 'nombre', 'requiereRx', 'activo', 'laboratorio', 'presentacion', 'concentracion', 'descripcion']

productosRouter.patch('/:id', autenticar, autorizar('ADMINISTRADOR', 'AUXILIAR'), limitarCreacion, async (req: Request, res: Response) => {
  try {
    const anterior = await prisma.producto.findUnique({
      where: { id: req.params.id },
      select: Object.fromEntries(CAMPOS_TRACKING.map(c => [c, true])) as any,
    })

    if (!anterior) return responder.noEncontrado(res, 'Producto')

    const producto = await prisma.producto.update({
      where: { id: req.params.id },
      data: req.body,
    })

    // Registrar cambios en HistorialCambio
    const cambios: Array<{ empleadoId: string; productoId: string; campo: string; valorAnterior: string; valorNuevo: string }> = []
    for (const campo of CAMPOS_TRACKING) {
      const oldVal = String(anterior[campo as keyof typeof anterior] ?? '')
      const newVal = String(req.body[campo] ?? '')
      if (campo in req.body && oldVal !== newVal) {
        cambios.push({
          empleadoId: req.empleado!.id,
          productoId: req.params.id,
          campo,
          valorAnterior: oldVal,
          valorNuevo: newVal,
        })
      }
    }

    if (cambios.length > 0) {
      await prisma.historialCambio.createMany({ data: cambios })
    }

    await cache.delPattern('productos:buscar:*')
    return responder.ok(res, producto, 'Producto actualizado')
  } catch (err) {
    return responder.serverError(res, err)
  }
})

// ── DELETE /:id ───────────────────────────────────────────
productosRouter.delete('/:id', autenticar, autorizar('ADMINISTRADOR'), async (req: Request, res: Response) => {
  try {
    await prisma.producto.update({
      where: { id: req.params.id },
      data: { activo: false },
    })
    await cache.delPattern('productos:buscar:*')
    return responder.ok(res, null, 'Producto desactivado')
  } catch (err) {
    return responder.serverError(res, err)
  }
})