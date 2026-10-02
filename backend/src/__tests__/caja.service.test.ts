import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calcularResumenCaja, calcularDiferencia, clasificarMetodoPago } from '../services/caja.service'

function crearDbMock() {
  return {
    caja: { findUnique: vi.fn() },
    venta: { groupBy: vi.fn().mockResolvedValue([]) },
    cajaMovimiento: { groupBy: vi.fn().mockResolvedValue([]), findMany: vi.fn().mockResolvedValue([]) },
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('clasificarMetodoPago', () => {
  it('clasifica EFECTIVO como efectivo', () => {
    expect(clasificarMetodoPago('EFECTIVO')).toBe('efectivo')
  })

  it('clasifica STRIPE como tarjeta', () => {
    expect(clasificarMetodoPago('STRIPE')).toBe('tarjeta')
  })

  it('clasifica pasarelas y transferencias como online', () => {
    expect(clasificarMetodoPago('WOMPI')).toBe('online')
    expect(clasificarMetodoPago('MERCADOPAGO')).toBe('online')
    expect(clasificarMetodoPago('TRANSFERENCIA')).toBe('online')
  })

  it('trata un método desconocido como online (nunca como efectivo)', () => {
    expect(clasificarMetodoPago('BITCOIN')).toBe('online')
  })
})

describe('calcularDiferencia', () => {
  it('es 0 cuando el arqueo cuadra', () => {
    expect(calcularDiferencia(1000000, 1000000)).toBe(0)
  })

  it('es negativo cuando falta efectivo', () => {
    expect(calcularDiferencia(550000, 600000)).toBe(-50000)
  })

  it('es positivo cuando sobra efectivo', () => {
    expect(calcularDiferencia(610000, 600000)).toBe(10000)
  })
})

describe('calcularResumenCaja', () => {
  it('retorna null si la caja no existe', async () => {
    const db = crearDbMock()
    db.caja.findUnique.mockResolvedValue(null)
    expect(await calcularResumenCaja(db, 'caja-x')).toBeNull()
  })

  it('suma por método y calcula el efectivo esperado', async () => {
    const db = crearDbMock()
    db.caja.findUnique.mockResolvedValue({ id: 'caja-1', montoApertura: 100000 })
    db.venta.groupBy.mockResolvedValue([
      { metodoPago: 'EFECTIVO', _sum: { total: 500000 }, _count: { _all: 3 } },
      { metodoPago: 'STRIPE', _sum: { total: 200000 }, _count: { _all: 1 } },
      { metodoPago: 'WOMPI', _sum: { total: 300000 }, _count: { _all: 2 } },
    ])

    const resumen = await calcularResumenCaja(db, 'caja-1')
    expect(resumen).not.toBeNull()
    expect(resumen!.totalEfectivo).toBe(500000)
    expect(resumen!.totalTarjeta).toBe(200000)
    expect(resumen!.totalOnline).toBe(300000)
    expect(resumen!.totalVentas).toBe(1000000)
    expect(resumen!.cantidadVentas).toBe(6)
    // esperado = apertura 100000 + ventas efectivo 500000
    expect(resumen!.efectivoEsperado).toBe(600000)
  })

  it('ajusta el efectivo esperado con ingresos y sangrías', async () => {
    const db = crearDbMock()
    db.caja.findUnique.mockResolvedValue({ id: 'caja-1', montoApertura: 100000 })
    db.venta.groupBy.mockResolvedValue([
      { metodoPago: 'EFECTIVO', _sum: { total: 400000 }, _count: { _all: 2 } },
    ])
    db.cajaMovimiento.groupBy.mockResolvedValue([
      { tipo: 'INGRESO', _sum: { monto: 50000 } },
      { tipo: 'SANGRIA', _sum: { monto: 120000 } },
    ])

    const resumen = await calcularResumenCaja(db, 'caja-1')
    expect(resumen!.totalIngresos).toBe(50000)
    expect(resumen!.totalSangrias).toBe(120000)
    // 100000 apertura + 400000 efectivo + 50000 ingreso − 120000 sangría = 430000
    expect(resumen!.efectivoEsperado).toBe(430000)
  })

  it('no cuenta pagos digitales en el efectivo esperado', async () => {
    const db = crearDbMock()
    db.caja.findUnique.mockResolvedValue({ id: 'caja-1', montoApertura: 100000 })
    db.venta.groupBy.mockResolvedValue([
      { metodoPago: 'WOMPI', _sum: { total: 900000 }, _count: { _all: 4 } },
    ])

    const resumen = await calcularResumenCaja(db, 'caja-1')
    expect(resumen!.efectivoEsperado).toBe(100000)
  })
})
