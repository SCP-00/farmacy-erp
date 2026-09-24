import { prisma } from '../../config/database'

/**
 * Limpia SOLO los datos transaccionales creados por los tests (ventas,
 * clientes de prueba y sus lotes), dejando intacto el catálogo del seed
 * (productos, categorías, proveedores, lotes del seed y config_param).
 */
export async function limpiarTransaccional(): Promise<void> {
  await prisma.pagoTransaccion.deleteMany({})
  await prisma.devolucion.deleteMany({})
  await prisma.detalleVenta.deleteMany({})
  await prisma.venta.deleteMany({})
  await prisma.movimientoInventario.deleteMany({})
  await prisma.alertaInventario.deleteMany({})
  // Lotes y productos creados POR LOS TESTS (email/nombre marcados) —
  // el catálogo del seed permanece intacto entre tests.
  await prisma.lote.deleteMany({ where: { producto: { nombre: { startsWith: 'TEST-INT' } } } })
  await prisma.favorito.deleteMany({})
  await prisma.cliente.deleteMany({ where: { email: { contains: '@test.co' } } })
  await prisma.codigoDescuento.deleteMany({ where: { codigo: { startsWith: 'INT' } } })
  await prisma.logActividad.deleteMany({})
}

/** Crea un producto de prueba con un lote vigente de stock controlado. */
export async function crearProductoConStock(stock: number, precioVenta = 5000, costo = 2500): Promise<{ productoId: string; loteId: string }> {
  let categoria = await prisma.categoria.findFirst({ where: { nombre: 'Test Integración' } })
  if (!categoria) {
    categoria = await prisma.categoria.create({ data: { nombre: 'Test Integración', slug: 'test-integracion' } })
  }
  const cum = `TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const producto = await prisma.producto.create({
    data: {
      cum,
      registroInvima: 'TEST-INVIMA',
      nombre: `TEST-INT Producto ${cum}`,
      categoriaId: categoria.id,
      precioVenta,
      activo: true,
    },
  })
  const lote = await prisma.lote.create({
    data: {
      productoId: producto.id,
      sucursalId: 1,
      codigoLote: `LOTE-${cum}`,
      fechaVencimiento: new Date(Date.now() + 365 * 86400000),
      cantidadInicial: stock,
      cantidadActual: stock,
      precioCompra: costo,
    },
  })
  return { productoId: producto.id, loteId: lote.id }
}

/** El admin del seed — responsable de las ventas B2C de prueba */
export async function obtenerAdmin(): Promise<{ id: string; email: string; rol: string }> {
  const admin = await prisma.empleado.findFirst({
    where: { rol: 'ADMINISTRADOR', activo: true },
    orderBy: { email: 'asc' },
  })
  if (!admin) throw new Error('Se requieren seeds: no hay ADMINISTRADOR activo')
  return { id: admin.id, email: admin.email, rol: admin.rol }
}

/** Un producto activo del catálogo con lotes vigentes en sucursal 1 */
export async function obtenerProductoConStock(): Promise<{ id: string; nombre: string; precioVenta: number }> {
  const producto = await prisma.producto.findFirst({
    where: {
      activo: true,
      lotes: { some: { cantidadActual: { gt: 0 }, fechaVencimiento: { gt: new Date() }, sucursalId: 1 } },
    },
    select: { id: true, nombre: true, precioVenta: true },
  })
  if (!producto) throw new Error('Se requieren seeds: no hay producto con stock en sucursal 1')
  return { id: producto.id, nombre: producto.nombre, precioVenta: Number(producto.precioVenta) }
}

export { prisma }
