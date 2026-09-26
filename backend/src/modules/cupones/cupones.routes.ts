import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { responder } from '../../utils/respuesta.utils'
import { autenticarCliente, validarCuerpo } from '../../middlewares/index'

export const cuponesRouter: Router = Router()

const validarSchema = z.object({
  codigo: z.string().min(2, 'Código muy corto').max(50),
  items: z.array(z.object({
    productoId: z.string().uuid(),
    cantidad: z.number().int().positive(),
  })).min(1, 'Carrito vacío'),
})

// ── POST /validar — Preview server-side de un cupón ───────
// El frontend NUNCA calcula descuentos: envía el código y el carrito
// (productoId+cantidad), y el backend responde con el descuento real
// usando precios de la DB. La aplicación definitiva ocurre en
// VentasService.registrarVenta() al confirmar la compra.
cuponesRouter.post('/validar', autenticarCliente, validarCuerpo(validarSchema), async (req: Request, res: Response) => {
  const { codigo, items } = req.body

  try {
    const cupon = await prisma.codigoDescuento.findUnique({
      where: { codigo: codigo.toUpperCase().trim() },
    })
    const ahora = new Date()
    if (!cupon || !cupon.activo)   return responder.error(res, 'Cupón inválido', 400)
    if (cupon.fechaInicio && cupon.fechaInicio > ahora) return responder.error(res, 'Cupón aún no vigente', 400)
    if (cupon.fechaFin && cupon.fechaFin < ahora)       return responder.error(res, 'Cupón expirado', 400)
    if (cupon.usosMaximos != null && cupon.usosActuales >= cupon.usosMaximos) return responder.error(res, 'Cupón agotado', 400)

    // Subtotal con precios SIEMPRE server-side
    const productos = await prisma.producto.findMany({
      where: { id: { in: items.map((i: any) => i.productoId) }, activo: true },
      select: { id: true, precioVenta: true },
    })
    const precios = new Map(productos.map((p) => [p.id, Number(p.precioVenta)]))
    const subtotal = items.reduce(
      (s: number, i: any) => s + (precios.get(i.productoId) ?? 0) * i.cantidad, 0
    )
    if (subtotal <= 0) return responder.error(res, 'Carrito inválido', 400)

    const descuento = cupon.tipo === 'PORCENTAJE'
      ? Math.round((subtotal * Number(cupon.valor)) / 100)
      : Math.min(Number(cupon.valor), subtotal)

    return responder.ok(res, {
      codigo: cupon.codigo,
      tipo: cupon.tipo,
      subtotal,
      descuento,
    }, 'Cupón válido')
  } catch (err) { return responder.serverError(res, err) }
})
