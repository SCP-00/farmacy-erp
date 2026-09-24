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
import { jwtCliente } from '../../utils/jwt.utils'
import { responder } from '../../utils/respuesta.utils'
import { autenticarCliente, validarCuerpo, limitarLogin, limitarCreacion, limitarRegistro } from '../../middlewares/index'
import { emailTemplates } from '../../config/mailer'
import { encolarEmail } from '../../jobs/queue'
import { env } from '../../config/env'
import { logger } from '../../utils/logger'
import { VentasService } from '../../services/ventas.service'

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

      // Enviar email de verificación (async, no bloquea la request)
      if (env.SMTP_HOST) {
        const url = `${env.FRONTEND_URL}/verificar-email?token=${token}`
        encolarEmail(
          email,
          'Verifica tu cuenta en Farmacy',
          emailTemplates.verificarEmail(nombre, url),
        )
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
    encolarEmail(
      email,
      'Restablece tu contraseña — Farmacy',
      emailTemplates.resetPassword(cliente.nombre, url),
    )

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

// ── POST /comprar — Cliente autenticado realiza una compra B2C
// Ruta DELGADA: toda la lógica de dinero vive en VentasService.registrarVenta().
//  - Precios SIEMPRE server-side (el cliente no envía precioUnitario).
//  - puntosUsados se recorta al saldo real (nunca se confía en el cliente).
//  - Cupones se validan server-side contra codigos_descuento (el frontend solo
//    envía el código, nunca el descuento calculado).
//  - Stock FEFO atómico dentro de la transacción.
//  - Config de envío desde config_param (editable sin deploy).
authClienteRouter.post('/comprar', autenticarCliente, limitarCreacion, async (req: Request, res: Response) => {
  const { metodoPago, items, codigoDescuento, puntosUsados = 0, ciudad } = req.body
  const clienteId = req.cliente!.id

  if (!Array.isArray(items) || !items.length) return responder.error(res, 'El carrito está vacío', 400)
  if (!metodoPago) return responder.error(res, 'Método de pago requerido', 400)

  // Los items solo pueden traer productoId y cantidad
  const itemsLimpios = items.map((i: any) => ({ productoId: String(i.productoId), cantidad: Math.max(1, Math.floor(Number(i.cantidad) || 1)) }))

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const configRows = await tx.configParam.findMany()
      const config = Object.fromEntries(configRows.map((p: any) => [p.clave, p.valor]))

      const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: clienteId } })

      // Costo de envío server-side (tarifas desde config_param, JSON)
      let tarifasEnvio: Record<string, number> = {}
      try { tarifasEnvio = JSON.parse(config.ENVIO_TARIFAS_CIUDADES ?? '{}') } catch { tarifasEnvio = {} }
      const ciudadLower = (ciudad || cliente.ciudad || '').toLowerCase().trim()
      const costoEnvioBase = tarifasEnvio[ciudadLower] ?? Number(config.ENVIO_COSTO_DEFAULT ?? '10000')

      // Empleado administrador responsable de la venta B2C (trazabilidad estable)
      const adminEmpleado = await tx.empleado.findFirst({
        where: { rol: 'ADMINISTRADOR', activo: true },
        orderBy: { email: 'asc' },
      })
      if (!adminEmpleado) throw new Error('No hay administrador configurado para ventas B2C')

      // Subtotal estimado para envío gratis (precio real lo calcula el servicio)
      const productos = await tx.producto.findMany({
        where: { id: { in: itemsLimpios.map((i: any) => i.productoId) } },
        select: { id: true, precioVenta: true },
      })
      const precios = new Map(productos.map((p: any) => [p.id, Number(p.precioVenta)]))
      const subtotalEstimado = itemsLimpios.reduce((s: number, i: any) => s + (precios.get(i.productoId) ?? 0) * i.cantidad, 0)
      const envioGratis = subtotalEstimado >= Number(config.ENVIO_GRATIS_DESDE ?? '50000')
      const costoEnvio = envioGratis ? 0 : costoEnvioBase

      const venta = await VentasService.registrarVenta({
        sucursalId: 1, // TODO: multi-sucursal B2C — selección por inventario/geografía
        empleadoId: adminEmpleado.id,
        clienteId,
        metodoPago,
        codigoDescuento,
        puntosUsados,
        costoEnvio,
        estado: 'PENDIENTE',
        registrarPagoEfectivo: metodoPago === 'EFECTIVO',
        items: itemsLimpios, // sin precioUnitario → precio server-side garantizado
      })

      return {
        ventaId: venta.id,
        numero: venta.numero,
        total: venta.total,
        subtotal: venta.subtotal,
        descuento: venta.descuento,
        puntosUsados: venta.puntosUsados,
        costoEnvio: venta.costoEnvio,
        estado: venta.estado,
      }
    })

    logger.info(`[B2C Compra] Cliente ${clienteId} — Venta #${resultado.numero} — Total: $${resultado.total}`)
    return responder.creado(res, resultado, 'Compra realizada exitosamente')
  } catch (err: any) {
    if (err.message?.includes('Stock insuficiente') || err.message?.includes('Cupón') || err.message?.includes('Cliente no encontrado')) {
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
    await encolarEmail(soporteEmail, `Solicitud de devolución - Venta ${venta.numero}`, html)

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
