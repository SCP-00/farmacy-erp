// ══════════════════════════════════════════════════════════
//  MÓDULO CAJA — Apertura, movimientos, arqueo y cierre
//
//  Diseño del cierre (a prueba de farmacia real):
//   - El cajero SOLO reporta el efectivo físico contado (`efectivoContado`).
//   - Los totales por método los calcula el servidor desde las ventas.
//   - Los movimientos manuales (sangría/ingreso) ajustan el efectivo esperado.
//   - `diferencia` = contado − esperado (0 = cuadrado).
// ══════════════════════════════════════════════════════════
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { responder } from '../../utils/respuesta.utils'
import { autenticar, autorizar, validarCuerpo } from '../../middlewares/index'
import { eventBus, Eventos } from '../../services/eventbus.service'
import { calcularResumenCaja, calcularDiferencia } from '../../services/caja.service'

export const cajaRouter: Router = Router()

// ── Schemas de validación ─────────────────────────────────
const abrirSchema = z.object({
  sucursalId:    z.number().int().positive(),
  montoApertura: z.number().min(0),
})

const movimientoSchema = z.object({
  tipo:  z.enum(['INGRESO', 'SANGRIA']),
  monto: z.number().positive(),
  motivo: z.string().trim().min(3, 'El motivo es obligatorio').max(255),
})

const cierreSchema = z.object({
  efectivoContado: z.number().min(0),
  observaciones:   z.string().max(1000).optional(),
  // Desglose por denominación (opcional, para auditoría)
  denominaciones:  z.unknown().optional(),
})

/** Un FARMACEUTA solo opera su propia caja; el ADMINISTRADOR puede operar cualquiera. */
function puedeOperarCaja(req: Request, caja: { empleadoId: string }): boolean {
  return req.empleado!.rol === 'ADMINISTRADOR' || caja.empleadoId === req.empleado!.id
}

// ── GET /caja/actual — caja abierta del empleado ─────────
cajaRouter.get('/actual', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'),
  async (req: Request, res: Response) => {
    try {
      const caja = await prisma.caja.findFirst({
        where: { empleadoId: req.empleado!.id, cerradaEn: null },
        include: { sucursal: { select: { nombre: true } } },
      })
      return responder.ok(res, caja)
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── GET /caja/actual/resumen — totales esperados del turno ─
cajaRouter.get('/actual/resumen', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'),
  async (req: Request, res: Response) => {
    try {
      const caja = await prisma.caja.findFirst({
        where: { empleadoId: req.empleado!.id, cerradaEn: null },
      })
      if (!caja) return responder.ok(res, null)
      const resumen = await calcularResumenCaja(prisma, caja.id)
      return responder.ok(res, resumen)
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── POST /caja/abrir ─────────────────────────────────────
cajaRouter.post('/abrir', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'), validarCuerpo(abrirSchema),
  async (req: Request, res: Response) => {
    const { sucursalId, montoApertura } = req.body
    try {
      const yaAbierta = await prisma.caja.findFirst({
        where: { empleadoId: req.empleado!.id, cerradaEn: null },
      })
      if (yaAbierta) return responder.error(res, 'Ya tienes una caja abierta', 409)

      const caja = await prisma.caja.create({
        data: { sucursalId, empleadoId: req.empleado!.id, montoApertura },
      })

      eventBus.emit(Eventos.CAJA_ABIERTA, {
        cajaId: caja.id,
        empleadoId: req.empleado!.id,
        sucursalId,
        montoApertura,
        abiertaEn: caja.abiertaEn.toISOString(),
      })

      return responder.creado(res, caja, 'Caja abierta')
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── POST /caja/:id/movimiento — sangría o ingreso de efectivo ─
cajaRouter.post('/:id/movimiento', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'), validarCuerpo(movimientoSchema),
  async (req: Request, res: Response) => {
    const { tipo, monto, motivo } = req.body
    try {
      const caja = await prisma.caja.findUnique({ where: { id: req.params.id } })
      if (!caja) return responder.noEncontrado(res, 'Caja')
      if (caja.cerradaEn) return responder.error(res, 'No se pueden registrar movimientos en una caja cerrada', 409)
      if (!puedeOperarCaja(req, caja)) return responder.prohibido(res, 'Esta caja pertenece a otro empleado')

      const movimiento = await prisma.cajaMovimiento.create({
        data: { cajaId: caja.id, tipo, monto, motivo, empleadoId: req.empleado!.id },
      })

      const resumen = await calcularResumenCaja(prisma, caja.id)
      return responder.creado(res, { movimiento, resumen }, tipo === 'SANGRIA' ? 'Sangría registrada' : 'Ingreso registrado')
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── GET /caja/:id/resumen — totales esperados de una caja ─
cajaRouter.get('/:id/resumen', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'),
  async (req: Request, res: Response) => {
    try {
      const resumen = await calcularResumenCaja(prisma, req.params.id)
      if (!resumen) return responder.noEncontrado(res, 'Caja')
      return responder.ok(res, resumen)
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── POST /caja/:id/cerrar — arqueo + cierre ──────────────
cajaRouter.post('/:id/cerrar', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'), validarCuerpo(cierreSchema),
  async (req: Request, res: Response) => {
    const { efectivoContado, observaciones, denominaciones } = req.body
    try {
      const caja = await prisma.caja.findUnique({ where: { id: req.params.id } })
      if (!caja) return responder.noEncontrado(res, 'Caja')
      if (caja.cerradaEn) return responder.error(res, 'La caja ya está cerrada', 409)
      if (!puedeOperarCaja(req, caja)) return responder.prohibido(res, 'Esta caja pertenece a otro empleado')

      // No cerrar con ventas a medio procesar (R_RF4.3)
      const pendientes = await prisma.venta.count({
        where: { cajaId: caja.id, estado: 'PENDIENTE' },
      })
      if (pendientes > 0) {
        return responder.error(res, `Hay ${pendientes} venta(s) pendientes por procesar`)
      }

      const resumen = await calcularResumenCaja(prisma, caja.id)
      if (!resumen) return responder.noEncontrado(res, 'Caja')

      const diferencia = calcularDiferencia(efectivoContado, resumen.efectivoEsperado)

      const cajaCerrada = await prisma.caja.update({
        where: { id: caja.id },
        data: {
          // montoCierre = efectivo físico contado (arqueo)
          montoCierre:      efectivoContado,
          efectivoContado,
          efectivoEsperado: resumen.efectivoEsperado,
          // Totales de sistema, calculados server-side
          totalEfectivo:    resumen.totalEfectivo,
          totalTarjeta:     resumen.totalTarjeta,
          totalOnline:      resumen.totalOnline,
          totalVentas:      resumen.totalVentas,
          totalIngresos:    resumen.totalIngresos,
          totalSangrias:    resumen.totalSangrias,
          denominaciones:   denominaciones ?? undefined,
          diferencia,
          observaciones:    observaciones ?? null,
          cerradaEn:        new Date(),
        },
      })

      eventBus.emit(Eventos.CAJA_CERRADA, {
        cajaId: caja.id,
        empleadoId: req.empleado!.id,
        totalVentas: resumen.totalVentas,
        efectivoEsperado: resumen.efectivoEsperado,
        efectivoContado,
        diferencia,
      })

      return responder.ok(res, cajaCerrada, 'Caja cerrada exitosamente')
    } catch (err) { return responder.serverError(res, err) }
  }
)

// ── GET /caja/historial ──────────────────────────────────
cajaRouter.get('/historial', autenticar, autorizar('ADMINISTRADOR', 'FARMACEUTA'),
  async (req: Request, res: Response) => {
    const esAdmin = req.empleado!.rol === 'ADMINISTRADOR'
    try {
      const cajas = await prisma.caja.findMany({
        where: esAdmin ? {} : { empleadoId: req.empleado!.id },
        orderBy: { abiertaEn: 'desc' },
        take: 30,
        include: {
          empleado: { select: { nombre: true, apellido: true } },
          sucursal: { select: { nombre: true } },
          _count: { select: { ventas: true } },
        },
      })
      return responder.ok(res, cajas)
    } catch (err) { return responder.serverError(res, err) }
  }
)
