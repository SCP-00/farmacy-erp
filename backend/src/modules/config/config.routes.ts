import { Router, Request, Response } from 'express'
import { prisma } from '../../config/database'
import { cache } from '../../config/redis'
import { responder } from '../../utils/respuesta.utils'

export const configRouter: Router = Router()

// Claves seguras para exponer públicamente (personalización de la tienda
// por farmacia). NADA de secrets ni claves de pasarelas aquí.
const CLAVES_PUBLICAS = [
  'ENVIO_GRATIS_DESDE',
  'ENVIO_COSTO_DEFAULT',
  'ENVIO_TARIFAS_CIUDADES',
  'PUNTOS_POR_PESO',
  'PUNTOS_VIGENCIA_DIAS',
  'FARMACIA_NOMBRE',
  'FARMACIA_TELEFONO',
  'FARMACIA_DIRECCION',
  'FARMACIA_WHATSAPP',
  'TIENDA_LEMA',
  'TIENDA_BANNER_ACTIVO',
  'TIENDA_MENSAJE_BANNER',
  'CHATBOT_ACTIVADO',
] as const

// Cache corto: esta ruta la llama el frontend en cada carga de la tienda
const CACHE_KEY = 'config:publico'
const CACHE_TTL_SEG = 60

// GET /config/publico — personalización visible sin autenticación
configRouter.get('/publico', async (_req: Request, res: Response) => {
  try {
    const cacheado = (await cache.get(CACHE_KEY)) as string | null
    if (cacheado) return responder.ok(res, JSON.parse(cacheado))

    const params = await prisma.configParam.findMany({
      where: { clave: { in: [...CLAVES_PUBLICAS] } },
    })

    // Defense-in-depth: filtrar en código también. Si alguien guarda un
    // secret en config_param, este endpoint NUNCA lo expone.
    const whitelist = new Set<string>(CLAVES_PUBLICAS)
    const config: Record<string, string> = {}
    for (const p of params) {
      if (whitelist.has(p.clave)) config[p.clave] = p.valor
    }

    // Defaults amables si la farmacia aún no personalizó nada
    if (!config.FARMACIA_NOMBRE) config.FARMACIA_NOMBRE = 'Farmacy'
    if (!config.PUNTOS_POR_PESO) config.PUNTOS_POR_PESO = '0.01'

    await cache.set(CACHE_KEY, JSON.stringify(config), CACHE_TTL_SEG)
    return responder.ok(res, config)
  } catch (err) {
    return responder.serverError(res, err)
  }
})

// Invalidación manual: la UI admin puede llamarla tras editar config_param
configRouter.post('/invalidar-cache', async (_req: Request, res: Response) => {
  await cache.del(CACHE_KEY).catch(() => undefined)
  return responder.ok(res, null, 'Cache de configuración invalidado')
})
