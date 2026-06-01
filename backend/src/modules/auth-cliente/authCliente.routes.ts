// ══════════════════════════════════════════════════════════
//  MÓDULO AUTH CLIENTE — Tienda web
//  POST /api/v1/clientes/auth/registro
//  POST /api/v1/clientes/auth/login
//  GET  /api/v1/clientes/auth/google
//  GET  /api/v1/clientes/auth/google/callback
//  POST /api/v1/clientes/auth/verificar-email
//  POST /api/v1/clientes/auth/recuperar-password
//  POST /api/v1/clientes/auth/reset-password
//  GET  /api/v1/clientes/auth/me
// ══════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express'
import passport from 'passport'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { cache } from '../../config/redis'
import { jwtCliente, jwtTemp } from '../../utils/jwt.utils'
import { responder } from '../../utils/respuesta.utils'
import { autenticarCliente, validarCuerpo, limitarLogin, limitarCreacion, limitarRegistro } from '../../middlewares/index'
import { sendEmail, emailTemplates } from '../../config/mailer'
import { env } from '../../config/env'
import { logger } from '../../utils/logger'

// ── Schemas ───────────────────────────────────────────────
const registroSchema = z.object({
  nombre:   z.string().min(2, 'Nombre muy corto'),
  apellido: z.string().min(2, 'Apellido muy corto'),
  email:    z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[!@#$%^&*_\-+=]/, 'Debe contener al menos un carácter especial'),
  tipoDoc: z.string().optional(),
  documento: z.string().optional(),
  autorizacionDatos: z.boolean().refine(v => v === true, {
    message: 'Debes aceptar el tratamiento de datos personales (Ley 1581)',
  }),
})

const loginSchema = z.object({
  email:    z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
})

// ── Router ────────────────────────────────────────────────
export const authClienteRouter: Router = Router()

// ── POST /registro ────────────────────────────────────────
authClienteRouter.post(
  '/registro',
  limitarRegistro,
  validarCuerpo(registroSchema),
  async (req: Request, res: Response) => {
    const { nombre, apellido, email, password, tipoDoc, documento, autorizacionDatos } = req.body

    try {
      const existe = await prisma.cliente.findUnique({ where: { email } })
      if (existe) return responder.error(res, 'Ya existe una cuenta con ese email', 409)

      const hash  = await bcrypt.hash(password, 12)
      const token = crypto.randomBytes(32).toString('hex')

      const cliente = await prisma.cliente.create({
        data: {
          nombre, apellido, email,
          password: hash,
          tipoDoc: tipoDoc || undefined,
          documento: documento || undefined,
          autorizacionDatos,
          tokenVerificacion: token, // Token para verificación por email
        },
        select: { id: true, nombre: true, email: true },
      })

      // Enviar email de verificación (siempre que haya SMTP configurado)
      if (env.SMTP_HOST) {
        const url = `${env.FRONTEND_URL}/verificar-email?token=${token}`
        sendEmail({
          to: email,
          subject: 'Verifica tu cuenta en Farmacy',
          html: emailTemplates.verificarEmail(nombre, url),
        })
      }

      logger.info(`[AuthCliente] Nuevo registro: ${email}`)
      return responder.creado(res, cliente, 'Cuenta creada. Revisa tu correo para verificarla.')

    } catch (err) {
      return responder.serverError(res, err)
    }
  }
)

// ── POST /login ───────────────────────────────────────────
authClienteRouter.post(
  '/login',
  limitarLogin,
  validarCuerpo(loginSchema),
  async (req: Request, res: Response) => {
    const { email, password } = req.body

    try {
      const cliente = await prisma.cliente.findUnique({ where: { email } })
      if (!cliente || !cliente.activo || !cliente.password) {
        return responder.noAutorizado(res, 'Credenciales inválidas')
      }

      if (!cliente.emailVerificado) {
        return responder.error(res, 'Debes verificar tu email primero. Revisa tu bandeja de entrada.', 403)
      }

      const ok = await bcrypt.compare(password, cliente.password)
      if (!ok) return responder.noAutorizado(res, 'Credenciales inválidas')

      const token = jwtCliente.firmar({
        id:     cliente.id,
        nombre: `${cliente.nombre} ${cliente.apellido}`,
        email:  cliente.email,
        tipo:   'cliente',
      })

      return responder.ok(res, {
        token,
        cliente: {
          id:      cliente.id,
          nombre:  cliente.nombre,
          apellido: cliente.apellido,
          email:   cliente.email,
          puntos:  cliente.puntosAcumulados,
        },
      }, 'Login exitoso')

    } catch (err) {
      return responder.serverError(res, err)
    }
  }
)

// ── GET /google ───────────────────────────────────────────
authClienteRouter.get('/google',
  passport.authenticate('google', { scope: ['email', 'profile'], session: false })
)

authClienteRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${env.FRONTEND_URL}/login?error=google` }),
  (req: Request, res: Response) => {
    const cliente = req.user as any
    const token = jwtCliente.firmar({
      id: cliente.id, nombre: cliente.nombre, email: cliente.email, tipo: 'cliente',
    })
    // Redirige al frontend con el token en la URL
    res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`)
  }
)

// ── POST /verificar-email ─────────────────────────────────
authClienteRouter.post('/verificar-email', limitarCreacion, async (req: Request, res: Response) => {
  const { token } = req.body
  if (!token) return responder.error(res, 'Token requerido')

  try {
    const cliente = await prisma.cliente.findFirst({
      where: { tokenVerificacion: token },
    })
    if (!cliente) return responder.error(res, 'Token inválido o expirado', 400)

    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { emailVerificado: true, tokenVerificacion: null },
    })
    return responder.ok(res, null, 'Email verificado exitosamente')
  } catch (err) {
    return responder.serverError(res, err)
  }
})

// ── POST /recuperar-password ──────────────────────────────
authClienteRouter.post('/recuperar-password', limitarCreacion, async (req: Request, res: Response) => {
  const { email } = req.body
  if (!email) return responder.error(res, 'Email requerido')

  try {
    const cliente = await prisma.cliente.findUnique({ where: { email } })
    // Siempre responde igual para no revelar si el email existe
    if (!cliente) return responder.ok(res, null, 'Si el email existe, recibirás un correo')

    const token   = crypto.randomBytes(32).toString('hex')
    const expira  = new Date(Date.now() + 3600000) // 1 hora

    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { tokenResetPass: token, tokenResetExpira: expira },
    })

    const url = `${env.FRONTEND_URL}/reset-password?token=${token}`
    sendEmail({
      to: email,
      subject: 'Restablece tu contraseña — Farmacy',
      html: emailTemplates.resetPassword(cliente.nombre, url),
    })

    return responder.ok(res, null, 'Si el email existe, recibirás un correo')
  } catch (err) {
    return responder.serverError(res, err)
  }
})

// ── POST /reset-password ──────────────────────────────────
authClienteRouter.post('/reset-password', limitarCreacion, async (req: Request, res: Response) => {
  const { token, password } = req.body
  if (!token || !password) return responder.error(res, 'Token y contraseña requeridos')

  try {
    const cliente = await prisma.cliente.findFirst({
      where: {
        tokenResetPass: token,
        tokenResetExpira: { gte: new Date() },
      },
    })
    if (!cliente) return responder.error(res, 'Token inválido o expirado', 400)

    const hash = await bcrypt.hash(password, 12)
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { password: hash, tokenResetPass: null, tokenResetExpira: null },
    })
    return responder.ok(res, null, 'Contraseña actualizada exitosamente')
  } catch (err) {
    return responder.serverError(res, err)
  }
})

// ── GET /me ───────────────────────────────────────────────
authClienteRouter.get('/me', autenticarCliente, async (req: Request, res: Response) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: req.cliente!.id },        select: {
        id: true, nombre: true, apellido: true, email: true,
        tipoDoc: true, documento: true,
        telefono: true, ciudad: true, puntosAcumulados: true,
        puntosExpiranEn: true, creadoEn: true,
      },
    })
    if (!cliente) return responder.noEncontrado(res, 'Cliente')
    return responder.ok(res, cliente)
  } catch (err) {
    return responder.serverError(res, err)
  }
})

// ── PATCH /me — Actualizar perfil del cliente autenticado
authClienteRouter.patch('/me', autenticarCliente, limitarCreacion, async (req: Request, res: Response) => {
  const schema = z.object({
    nombre: z.string().min(2).optional(),
    apellido: z.string().min(2).optional(),
    telefono: z.string().optional().transform(v => v || undefined),
    ciudad: z.string().optional().transform(v => v || undefined),
    tipoDoc: z.string().optional().transform(v => v || undefined),
    documento: z.string().optional().transform(v => v || undefined),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return responder.error(res, 'Datos inválidos: ' + parsed.error.errors.map(e => e.message).join(', '), 400)
  }

  try {
    const cliente = await prisma.cliente.update({
      where: { id: req.cliente!.id },
      data: parsed.data,
      select: {
        id: true, nombre: true, apellido: true, email: true,
        tipoDoc: true, documento: true,
        telefono: true, ciudad: true, puntosAcumulados: true,
      },
    })
    logger.info(`[AuthCliente] Perfil actualizado: ${cliente.email}`)
    return responder.ok(res, cliente, 'Perfil actualizado exitosamente')
  } catch (err) {
    return responder.serverError(res, err)
  }
})

// ── POST /comprar — Cliente autenticado realiza una compra B2C
// Crea una venta con estado PENDIENTE, registra los items del carrito,
// y descuenta stock de lotes siguiendo FEFO (First Expiry, First Out).
authClienteRouter.post('/comprar', autenticarCliente, limitarCreacion, async (req: Request, res: Response) => {
  const { metodoPago, items, descuento = 0, puntosUsados = 0, direccionEnvio, ciudad } = req.body
  const clienteId = req.cliente!.id

  if (!items?.length) return responder.error(res, 'El carrito está vacío', 400)
  if (!metodoPago) return responder.error(res, 'Método de pago requerido', 400)

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Verificar cliente
      const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: clienteId } })
      let subtotal = 0

      // 2. Verificar stock y calcular total
      for (const item of items) {
        const lotesDisponibles = await tx.lote.findMany({
          where: {
            productoId: item.productoId,
            cantidadActual: { gte: item.cantidad },
            fechaVencimiento: { gte: new Date() },
          },
          orderBy: [{ fechaVencimiento: 'asc' }, { creadoEn: 'asc' }],
          take: 10,
        })

        const stockTotal = lotesDisponibles.reduce((s, l) => s + l.cantidadActual, 0)
        if (stockTotal < item.cantidad) {
          throw new Error(`Stock insuficiente para producto ${item.productoId}`)
        }

        const producto = await tx.producto.findUniqueOrThrow({ where: { id: item.productoId } })
        subtotal += Number(producto.precioVenta) * item.cantidad
      }

      // 3. Calcular costo de envío por ciudad
      const TARIFAS_ENVIO: Record<string, number> = {
        'bogotá': 5000, 'medellín': 7000, 'cali': 8000,
        'barranquilla': 10000, 'cartagena': 10000, 'pereira': 5000,
        'manizales': 6000, 'armenia': 6000, 'bucaramanga': 8000,
        'cúcuta': 10000, 'ibagué': 7000, 'villavicencio': 8000,
        'pasto': 10000, 'sincelejo': 10000, 'montería': 10000,
        'neiva': 9000, 'santa marta': 10000, 'valledupar': 10000,
      }
      const ciudadLower = (ciudad || cliente.ciudad || '').toLowerCase().trim()
      const costoEnvio = TARIFAS_ENVIO[ciudadLower] ?? 10000

      // Envío gratis sobre $50.000
      const envioGratis = subtotal >= 50000
      const costoEnvioFinal = envioGratis ? 0 : costoEnvio

      const puntosDescontados = Number(puntosUsados) || 0
      const total = Math.max(0, subtotal - descuento + costoEnvioFinal - puntosDescontados)

      // 4. Generar número de venta
      // 4. Obtener empleado administrador por defecto para B2C
      const adminEmpleado = await tx.empleado.findFirst({
        where: { rol: 'ADMINISTRADOR', activo: true },
        orderBy: { email: 'asc' },
      })
      if (!adminEmpleado) throw new Error('No hay administrador configurado para ventas B2C')

      const ultimaVenta = await tx.venta.findFirst({ orderBy: { numero: 'desc' } })
      const nuevoNumero = (ultimaVenta?.numero ?? 0) + 1

      // 5. Crear la venta
      const venta = await tx.venta.create({
        data: {
          numero: nuevoNumero,
          sucursalId: 1, // Sucursal por defecto
          empleadoId: adminEmpleado.id,
          clienteId,
          metodoPago,
          subtotal,
          descuento: descuento + puntosDescontados,
          iva: 0,
          costoEnvio: costoEnvioFinal,
          total,
          estado: metodoPago === 'EFECTIVO' ? 'PENDIENTE' : 'PENDIENTE',
          detalles: {
            create: items.map((item: any) => ({
              productoId: item.productoId,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              descuento: 0,
              subtotal: item.cantidad * item.precioUnitario,
            })),
          },
        },
        include: { detalles: true },
      })

      // 6. Descontar stock FEFO
      for (const item of items) {
        let resto = item.cantidad
        const lotes = await tx.lote.findMany({
          where: {
            productoId: item.productoId,
            cantidadActual: { gt: 0 },
            fechaVencimiento: { gte: new Date() },
          },
          orderBy: [{ fechaVencimiento: 'asc' }, { creadoEn: 'asc' }],
        })

        for (const lote of lotes) {
          if (resto <= 0) break
          const descontar = Math.min(resto, lote.cantidadActual)
          await tx.lote.update({
            where: { id: lote.id },
            data: { cantidadActual: lote.cantidadActual - descontar },
          })
          resto -= descontar
        }
      }

      // 7. Puntos de fidelidad — restar usados, sumar ganados
      // Los puntos se calculan SOLO sobre el valor de productos (excluye envío)
      const basePuntos = Math.max(0, subtotal - descuento)
      const puntosGanados = Math.floor(basePuntos / 100)

      if (puntosDescontados > 0) {
        await tx.cliente.update({
          where: { id: clienteId },
          data: { puntosAcumulados: { decrement: puntosDescontados } },
        })
      }

      if (puntosGanados > 0) {
        const expira = new Date()
        expira.setFullYear(expira.getFullYear() + 1)
        await tx.cliente.update({
          where: { id: clienteId },
          data: {
            puntosAcumulados: { increment: puntosGanados },
            puntosExpiranEn: expira,
          },
        })
      }

      // 8. Si es efectivo, registrar pago como PENDIENTE (contra entrega)
      // El pago se confirma cuando el admin registra el cobro en el POS
      if (metodoPago === 'EFECTIVO') {
        await tx.pagoTransaccion.create({
          data: {
            ventaId: venta.id,
            pasarela: 'EFECTIVO',
            monto: total,
            moneda: 'COP',
            estado: 'PENDIENTE',
            referenciaExterna: `EF-${nuevoNumero}`,
          },
        })
      }

      return {
        ventaId: venta.id,
        numero: nuevoNumero,
        total,
        subtotal,
        descuento,
        puntosUsados: puntosDescontados,
        costoEnvio: costoEnvioFinal,
        puntosGanados,
        estado: venta.estado,
      }
    })

    logger.info(`[B2C Compra] Cliente ${clienteId} — Venta #${resultado.numero} — Total: $${resultado.total}`)
    return responder.creado(res, resultado, 'Compra realizada exitosamente')

  } catch (err: any) {
    if (err.message?.includes('Stock insuficiente')) {
      return responder.error(res, err.message, 400)
    }
    logger.error(`[B2C Compra] Error: ${err.message}`)
    return responder.serverError(res, err)
  }
})

// ── GET /pedidos — Historial de pedidos del cliente autenticado
// Incluye costoEnvio, subtotal, descuento y total para desglose completo
authClienteRouter.get('/pedidos', autenticarCliente, async (req: Request, res: Response) => {
  try {
    const pedidos = await prisma.venta.findMany({
      where: { clienteId: req.cliente!.id },
      orderBy: { creadoEn: 'desc' },
      select: {
        id: true,
        numero: true,
        metodoPago: true,
        subtotal: true,
        descuento: true,
        iva: true,
        costoEnvio: true,
        total: true,
        estado: true,
        creadoEn: true,
        detalles: {
          include: {
            producto: { select: { nombre: true } },
          },
        },
        pagos: {
          select: { pasarela: true, estado: true, monto: true },
        },
      },
    })
    return responder.ok(res, pedidos)
  } catch (err) { return responder.serverError(res, err) }
})

// ── POST /pedidos/:id/devolucion-request — Cliente solicita devolución
authClienteRouter.post('/pedidos/:id/devolucion-request', autenticarCliente, limitarCreacion, async (req: Request, res: Response) => {
  const ventaId = req.params.id
  const { motivo } = req.body
  if (!motivo) return responder.error(res, 'motivo requerido', 400)
  try {
    const venta = await prisma.venta.findUnique({ where: { id: ventaId }, include: { cliente: true } })
    if (!venta) return responder.noEncontrado(res, 'Venta')
    if (venta.clienteId !== req.cliente!.id) return responder.noAutorizado(res, 'No autorizado para esta venta')

    const diasDesdeVenta = Math.floor((Date.now() - venta.creadoEn.getTime()) / (1000 * 60 * 60 * 24))
    if (diasDesdeVenta > 15) return responder.error(res, 'Han pasado más de 15 días desde la compra', 400)

    // Enviar correo al equipo de soporte con los detalles de la solicitud
    const soporteEmail = env.SOPORTE_EMAIL || 'soporte@farmacy.co'
    const html = `<p>Cliente ${venta.cliente?.nombre} ${venta.cliente?.apellido} solicita devolución para la venta #${venta.numero}</p>
      <p>Motivo: ${motivo}</p>
      <p>Venta ID: ${venta.id} · Total: ${venta.total}</p>`
    await sendEmail({ to: soporteEmail, subject: `Solicitud de devolución - Venta ${venta.numero}`, html })

    return responder.ok(res, null, 'Solicitud de devolución enviada. Nuestro equipo te contactará.')
  } catch (err) { return responder.serverError(res, err) }
})

// ── POST /favoritos — Toggle favorito para el cliente autenticado
authClienteRouter.post('/favoritos', autenticarCliente, limitarCreacion, async (req: Request, res: Response) => {
  const { productoId } = req.body
  if (!productoId) return responder.error(res, 'productoId requerido', 400)
  try {
    const existe = await prisma.favorito.findFirst({ where: { clienteId: req.cliente!.id, productoId } })
    if (existe) {
      await prisma.favorito.delete({ where: { id: existe.id } })
      return responder.ok(res, null, 'Eliminado de favoritos')
    }
    const fav = await prisma.favorito.create({ data: { clienteId: req.cliente!.id, productoId } })
    return responder.creado(res, fav, 'Agregado a favoritos')
  } catch (err) { return responder.serverError(res, err) }
})
// ── POST /logout ──────────────────────────────────────────
authClienteRouter.post('/logout', autenticarCliente, limitarCreacion, async (req: Request, res: Response) => {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  
  // Agregar el token del cliente a la lista negra por 30 días (expiración máxima de clientes)
  if (token) {
    await cache.set(`bl_cli_${token}`, 'revoked', 60 * 60 * 24 * 30)
  }
  return responder.ok(res, null, 'Sesión cerrada exitosamente')
})
