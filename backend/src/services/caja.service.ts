// ══════════════════════════════════════════════════════════
//  SERVICIO DE CAJA — Arqueo y resumen de turno
//
//  Regla de oro del arqueo:
//   - Los totales por método se calculan AQUÍ desde las ventas
//     (nunca se confían del cliente).
//   - El cajero SOLO reporta el efectivo físico contado.
//   - `efectivoEsperado` = apertura + ventas en efectivo + ingresos − sangrías.
//   - `diferencia` = contado − esperado. Positivo = sobra, negativo = falta.
// ══════════════════════════════════════════════════════════

/** Métodos que entran físicamente a la gaveta. */
export const METODOS_EFECTIVO = ['EFECTIVO'] as const
/** Métodos que se liquidan por datáfono (tarjeta). */
export const METODOS_TARJETA = ['STRIPE'] as const
// El resto (WOMPI, MERCADOPAGO, TRANSFERENCIA, ...) se agrupa como "online".

export interface ResumenCaja {
  caja: any
  totalEfectivo: number
  totalTarjeta: number
  totalOnline: number
  totalVentas: number
  cantidadVentas: number
  totalIngresos: number
  totalSangrias: number
  efectivoEsperado: number
  movimientos: any[]
}

/** Clasifica un método de pago en efectivo | tarjeta | online. */
export function clasificarMetodoPago(metodo: string): 'efectivo' | 'tarjeta' | 'online' {
  if ((METODOS_EFECTIVO as readonly string[]).includes(metodo)) return 'efectivo'
  if ((METODOS_TARJETA as readonly string[]).includes(metodo)) return 'tarjeta'
  return 'online'
}

/**
 * Calcula el resumen completo de una caja a partir de las ventas PAGADAS
 * y de los movimientos manuales de efectivo. `db` puede ser `prisma` o un `tx`.
 */
export async function calcularResumenCaja(db: any, cajaId: string): Promise<ResumenCaja | null> {
  const caja = await db.caja.findUnique({ where: { id: cajaId } })
  if (!caja) return null

  const porMetodo: any[] = await db.venta.groupBy({
    by: ['metodoPago'],
    where: { cajaId, estado: 'PAGADO' },
    _sum: { total: true },
    _count: { _all: true },
  })

  let totalEfectivo = 0
  let totalTarjeta = 0
  let totalOnline = 0
  let cantidadVentas = 0

  for (const grupo of porMetodo) {
    const monto = Number(grupo._sum?.total ?? 0)
    cantidadVentas += Number(grupo._count?._all ?? 0)
    switch (clasificarMetodoPago(grupo.metodoPago)) {
      case 'efectivo': totalEfectivo += monto; break
      case 'tarjeta':  totalTarjeta  += monto; break
      default:         totalOnline   += monto
    }
  }

  const porTipo: any[] = await db.cajaMovimiento.groupBy({
    by: ['tipo'],
    where: { cajaId },
    _sum: { monto: true },
  })

  let totalIngresos = 0
  let totalSangrias = 0
  for (const grupo of porTipo) {
    const monto = Number(grupo._sum?.monto ?? 0)
    if (grupo.tipo === 'INGRESO') totalIngresos += monto
    else totalSangrias += monto
  }

  const movimientos = await db.cajaMovimiento.findMany({
    where: { cajaId },
    orderBy: { creadoEn: 'desc' },
    include: { empleado: { select: { nombre: true, apellido: true } } },
  })

  const montoApertura = Number(caja.montoApertura ?? 0)
  const totalVentas = totalEfectivo + totalTarjeta + totalOnline
  const efectivoEsperado = montoApertura + totalEfectivo + totalIngresos - totalSangrias

  return {
    caja,
    totalEfectivo,
    totalTarjeta,
    totalOnline,
    totalVentas,
    cantidadVentas,
    totalIngresos,
    totalSangrias,
    efectivoEsperado,
    movimientos,
  }
}

/** Diferencia de arqueo: contado − esperado (0 = cuadrado). */
export function calcularDiferencia(efectivoContado: number, efectivoEsperado: number): number {
  return Number((efectivoContado - efectivoEsperado).toFixed(2))
}
