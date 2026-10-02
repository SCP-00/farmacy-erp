// ══════════════════════════════════════════════════════════
//  MÓDULO IMPRESIÓN — Tirilla térmica ESC/POS
//
//  - GET  /impresion/config           config de impresora (ADMIN)
//  - PUT  /impresion/config           guarda config por sede (ADMIN)
//  - GET  /impresion/tirilla/:id      bytes ESC/POS de la tirilla (WebUSB)
//  - POST /impresion/tirilla/:id      imprime en la impresora de red
// ══════════════════════════════════════════════════════════
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { responder } from '../../utils/respuesta.utils'
import { autenticar, autorizar, validarCuerpo } from '../../middlewares/index'
import { generarTirillaEscPos, imprimirTirilla, obtenerConfigImpresora } from '../../services/impresion.service'

export const impresionRouter: Router = Router()

const configSchema = z.object({
  sucursalId: z.number().int().positive().optional(),
  host:       z.string().trim().min(1, 'El host es obligatorio').max(255),
  port:       z.number().int().min(1).max(65535).default(9100),
  ancho:      z.number().int().min(32).max(64).optional(),
  abrirCajon: z.boolean().optional(),
})

const tirillaSchema = z.object({
  sucursalId: z.number().int().positive().optional(),
  abrirCajon: z.boolean().optional(),
})

// Clave de config_param según sucursal (o la de respaldo)
function claveConfig(sucursalId?: number): string {
  return sucursalId ? `IMPRESORA_SUCURSAL_${sucursalId}` : 'IMPRESORA_DEFAULT'
}

// ── GET /impresion/config ─────────────────────────────────
impresionRouter.get('/config', autenticar, autorizar('ADMINISTRADOR'),
  async (_req: Request, res: Response) => {
    try {
      const params = await prisma.configParam.findMany({
        where: { clave: { startsWith: 'IMPRESORA_' } },
      })
      const config = params.map((p: any) => ({
        clave: p.clave,
        ...(() => { try { return JSON.parse(p.valor) } catch { return { valorCrudo: p.valor } } })(),
      }))
      return responder.ok(res, config)
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── PUT /impresion/config ─────────────────────────────────
impresionRouter.put('/config', autenticar, autorizar('ADMINISTRADOR'), validarCuerpo(configSchema),
  async (req: Request, res: Response) => {
    const { sucursalId, ...config } = req.body
    try {
      const clave = claveConfig(sucursalId)
      const valor = JSON.stringify({
        host: config.host,
        port: config.port,
        ancho: config.ancho ?? 48,
        abrirCajon: config.abrirCajon ?? true,
      })
      const guardado = await prisma.configParam.upsert({
        where: { clave },
        update: { valor },
        create: { clave, valor, descripcion: `Impresora térmica ${sucursalId ? `sucursal ${sucursalId}` : '(respaldo)'}` },
      })
      return responder.ok(res, guardado, 'Configuración de impresora guardada')
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── GET /impresion/tirilla/:ventaId — bytes ESC/POS ───────
impresionRouter.get('/tirilla/:ventaId', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'),
  async (req: Request, res: Response) => {
    try {
      const resultado = await generarTirillaEscPos(prisma, req.params.ventaId)
      if (!resultado) return responder.noEncontrado(res, 'Venta')
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="tirilla-${resultado.venta.numero}.bin"`)
      return res.status(200).send(resultado.buffer)
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── POST /impresion/tirilla/:ventaId — imprimir en red ────
impresionRouter.post('/tirilla/:ventaId', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'), validarCuerpo(tirillaSchema),
  async (req: Request, res: Response) => {
    try {
      const resultado = await imprimirTirilla(prisma, req.params.ventaId, req.body)
      if (!resultado.impreso) {
        // Sin impresora configurada no es un error del servidor: el POS cae
        // a la impresión del navegador. Se devuelve 200 con impreso:false.
        return responder.ok(res, resultado, resultado.motivo)
      }
      return responder.ok(res, resultado, 'Tirilla enviada a la impresora')
    } catch (err: any) {
      return responder.error(res, `No se pudo imprimir: ${err?.message ?? 'error de red'}`, 502)
    }
  }
)
