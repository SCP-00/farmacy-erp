import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks para usar en vi.mock ────────────────────
const { mockDescontarStockFEFO, mockVentaCreate, mockClienteUpdate, mockTransaction } =
  vi.hoisted(() => ({
    mockDescontarStockFEFO: vi.fn(),
    mockVentaCreate: vi.fn(),
    mockClienteUpdate: vi.fn(),
    mockTransaction: vi.fn(),
  }))

vi.mock('../services/inventario.service', () => ({
  InventarioService: {
    descontarStockFEFO: mockDescontarStockFEFO,
  },
}))

vi.mock('../config/database', () => ({
  prisma: {
    $transaction: mockTransaction,
    cliente: { update: mockClienteUpdate },
  },
}))

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { VentasService } from '../services/ventas.service'

// Config por defecto que devuelve el mock de config_param
const CONFIG_DEFAULT = [
  { clave: 'PUNTOS_POR_PESO', valor: '0.01' },
  { clave: 'PUNTOS_VIGENCIA_DIAS', valor: '365' },
]

function crearTxMock(opts: { cliente?: any; cupon?: any } = {}) {
  return {
    configParam: { findMany: vi.fn().mockResolvedValue(CONFIG_DEFAULT) },
    cliente: {
      findUnique: vi.fn().mockResolvedValue(opts.cliente ?? null),
      update: mockClienteUpdate,
    },
    producto: { findUnique: vi.fn() },
    codigoDescuento: {
      findUnique: vi.fn().mockResolvedValue(opts.cupon ?? null),
      update: vi.fn().mockResolvedValue({}),
    },
    venta: { create: mockVentaCreate },
    pagoTransaccion: { create: vi.fn().mockResolvedValue({}) },
    lote: { findMany: vi.fn(), updateMany: vi.fn() },
  }
}

describe('VentasService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('registrarVenta()', () => {
    const ventaBase = {
      sucursalId: 1,
      cajaId: 'caja-uuid',
      empleadoId: 'emp-uuid',
      metodoPago: 'EFECTIVO' as const,
      descuento: 0,
      items: [
        { productoId: 'prod-1', cantidad: 3, precioUnitario: 5000, descuento: 0 },
        { productoId: 'prod-2', cantidad: 2, precioUnitario: 8000, descuento: 500 },
      ],
    }

    it('registra una venta exitosa con FEFO', async () => {
      const tx = crearTxMock()
      mockTransaction.mockImplementation(async (cb: any) => cb(tx))

      mockDescontarStockFEFO
        .mockResolvedValueOnce([{ loteId: 'lote-1', cantidad: 3, precioCompra: 2000 }])
        .mockResolvedValueOnce([{ loteId: 'lote-2', cantidad: 2, precioCompra: 4000 }])

      mockVentaCreate.mockResolvedValue({
        id: 'venta-nueva', numero: 1, total: 30500, detalles: [],
      })

      const resultado = await VentasService.registrarVenta(ventaBase)

      expect(resultado).toBeDefined()
      expect(mockDescontarStockFEFO).toHaveBeenCalledTimes(2)
      expect(mockDescontarStockFEFO).toHaveBeenNthCalledWith(1, tx, 'prod-1', 1, 3)
      expect(mockDescontarStockFEFO).toHaveBeenNthCalledWith(2, tx, 'prod-2', 1, 2)

      // costoUnitario capturado en el detalle (margen real)
      expect(mockVentaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            detalles: {
              createMany: {
                data: expect.arrayContaining([
                  expect.objectContaining({ loteId: 'lote-1', costoUnitario: 2000 }),
                ]),
              },
            },
          }),
        })
      )
    })

    it('suma puntos de fidelidad cuando hay cliente (regla única: floor(total*0.01))', async () => {
      const tx = crearTxMock({ cliente: { id: 'cliente-uuid', activo: true, puntosAcumulados: 0 } })
      mockTransaction.mockImplementation(async (cb: any) => cb(tx))
      mockDescontarStockFEFO.mockResolvedValue([{ loteId: 'lote-1', cantidad: 1, precioCompra: 1000 }])
      mockVentaCreate.mockResolvedValue({
        id: 'venta-123', numero: 2, total: 5000, detalles: [],
      })

      const ventaConCliente = {
        ...ventaBase,
        clienteId: 'cliente-uuid',
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 5000, descuento: 0 }],
      }

      await VentasService.registrarVenta(ventaConCliente)

      // 1 punto por cada $100 COP (total = 5000 → 50 puntos)
      expect(mockClienteUpdate).toHaveBeenCalledWith({
        where: { id: 'cliente-uuid' },
        data: {
          puntosAcumulados: { increment: 50 },
          puntosExpiranEn: expect.any(Date),
        },
      })
    })

    it('no suma puntos si total < 100 (1 punto cada $100)', async () => {
      const tx = crearTxMock({ cliente: { id: 'cliente-uuid', activo: true, puntosAcumulados: 0 } })
      mockTransaction.mockImplementation(async (cb: any) => cb(tx))
      mockDescontarStockFEFO.mockResolvedValue([{ loteId: 'lote-1', cantidad: 1, precioCompra: 20 }])
      mockVentaCreate.mockResolvedValue({
        id: 'venta-456', numero: 3, total: 50, detalles: [],
      })

      const ventaSinPuntos = {
        ...ventaBase,
        clienteId: 'cliente-uuid',
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 50, descuento: 0 }],
      }

      await VentasService.registrarVenta(ventaSinPuntos)

      expect(mockClienteUpdate).not.toHaveBeenCalled()
    })

    it('recorta puntosUsados al saldo REAL del cliente (anti-fraude)', async () => {
      const tx = crearTxMock({ cliente: { id: 'cli-1', activo: true, puntosAcumulados: 30 } })
      mockTransaction.mockImplementation(async (cb: any) => cb(tx))
      mockDescontarStockFEFO.mockResolvedValue([{ loteId: 'lote-1', cantidad: 1, precioCompra: 100 }])
      mockVentaCreate.mockResolvedValue({ id: 'v', numero: 4, total: 4970, detalles: [] })

      // El cliente intenta usar 100.000 puntos pero solo tiene 30
      await VentasService.registrarVenta({
        ...ventaBase,
        clienteId: 'cli-1',
        puntosUsados: 100_000,
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 5000, descuento: 0 }],
      })

      expect(mockVentaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ puntosUsados: 30 }),
        })
      )
      expect(mockClienteUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ puntosAcumulados: { decrement: 30 } }),
        })
      )
    })

    it('aplica cupón server-side (PORCENTAJE) e incrementa usos', async () => {
      const tx = crearTxMock({
        cupon: { id: 'cupon-1', codigo: 'FARMACY10', tipo: 'PORCENTAJE', valor: 10, activo: true, fechaInicio: null, fechaFin: null, usosMaximos: null, usosActuales: 0 },
      })
      mockTransaction.mockImplementation(async (cb: any) => cb(tx))
      mockDescontarStockFEFO.mockResolvedValue([{ loteId: 'lote-1', cantidad: 1, precioCompra: 900 }])
      mockVentaCreate.mockResolvedValue({ id: 'v', numero: 5, total: 4500, detalles: [] })

      await VentasService.registrarVenta({
        ...ventaBase,
        clienteId: undefined,
        codigoDescuento: 'FARMACY10',
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 5000, descuento: 0 }],
      })

      // subtotal 5000 - 10% = 500 de descuento
      expect(mockVentaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            descuento: 500,
            codigoDescuentoId: 'cupon-1',
          }),
        })
      )
      expect(tx.codigoDescuento.update).toHaveBeenCalledWith({
        where: { id: 'cupon-1' },
        data: { usosActuales: { increment: 1 } },
      })
    })

    it('rechaza cupón agotado (usosMaximos alcanzado)', async () => {
      const tx = crearTxMock({
        cupon: { id: 'cupon-1', codigo: 'AGOTADO', tipo: 'PORCENTAJE', valor: 10, activo: true, fechaInicio: null, fechaFin: null, usosMaximos: 5, usosActuales: 5 },
      })
      mockTransaction.mockImplementation(async (cb: any) => cb(tx))
      mockDescontarStockFEFO.mockResolvedValue([{ loteId: 'lote-1', cantidad: 1, precioCompra: 900 }])

      await expect(
        VentasService.registrarVenta({
          ...ventaBase,
          codigoDescuento: 'AGOTADO',
          items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 5000, descuento: 0 }],
        })
      ).rejects.toThrow('agotado')
    })

    it('descuenta el envío de los puntos pero NO genera puntos sobre el envío', async () => {
      const tx = crearTxMock({ cliente: { id: 'cli-1', activo: true, puntosAcumulados: 0 } })
      mockTransaction.mockImplementation(async (cb: any) => cb(tx))
      mockDescontarStockFEFO.mockResolvedValue([{ loteId: 'lote-1', cantidad: 1, precioCompra: 1000 }])
      mockVentaCreate.mockResolvedValue({ id: 'v', numero: 6, total: 15000, detalles: [] })

      // subtotal 10000 + envío 5000 = total 15000; base de puntos = 15000 - 5000 = 10000 → 100 pts
      await VentasService.registrarVenta({
        ...ventaBase,
        clienteId: 'cli-1',
        costoEnvio: 5000,
        items: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 10000, descuento: 0 }],
      })

      expect(mockVentaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ costoEnvio: 5000 }),
        })
      )
      expect(mockClienteUpdate).toHaveBeenCalledWith({
        where: { id: 'cli-1' },
        data: {
          puntosAcumulados: { increment: 100 }, // NO 150 (no genera puntos sobre envío)
          puntosExpiranEn: expect.any(Date),
        },
      })
    })

    it('propaga el error si FEFO falla (stock insuficiente)', async () => {
      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = crearTxMock()
        mockDescontarStockFEFO.mockRejectedValue(
          new Error('Sin stock suficiente para el producto prod-1. Faltan 5 unidades.')
        )
        return cb(tx)
      })

      await expect(VentasService.registrarVenta(ventaBase)).rejects.toThrow()
    })

    it('registra venta sin cajaId y sin clienteId (tienda online)', async () => {
      const tx = crearTxMock()
      mockTransaction.mockImplementation(async (cb: any) => cb(tx))
      mockDescontarStockFEFO.mockResolvedValue([{ loteId: 'lote-1', cantidad: 2, precioCompra: 3000 }])
      mockVentaCreate.mockResolvedValue({
        id: 'venta-online', numero: 7, total: 20000, detalles: [],
      })

      const ventaOnline = {
        sucursalId: 1,
        empleadoId: 'emp-uuid',
        metodoPago: 'TRANSFERENCIA' as const,
        descuento: 0,
        items: [{ productoId: 'prod-1', cantidad: 2, precioUnitario: 10000, descuento: 0 }],
      }

      const resultado = await VentasService.registrarVenta(ventaOnline)
      expect(resultado).toBeDefined()
    })

    it('toma el precio de la DB cuando el item no trae precioUnitario (B2C)', async () => {
      const tx = crearTxMock()
      tx.producto.findUnique.mockResolvedValue({ precioVenta: 7000, activo: true })
      mockTransaction.mockImplementation(async (cb: any) => cb(tx))
      mockDescontarStockFEFO.mockResolvedValue([{ loteId: 'lote-1', cantidad: 2, precioCompra: 2000 }])
      mockVentaCreate.mockResolvedValue({ id: 'v', numero: 8, total: 14000, detalles: [] })

      await VentasService.registrarVenta({
        ...ventaBase,
        items: [{ productoId: 'prod-1', cantidad: 2 } as any],
      })

      expect(tx.producto.findUnique).toHaveBeenCalled()
      // precio server-side 7000 × 2 = 14000, NO el precio del cliente
      expect(mockVentaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subtotal: 14000 }),
        })
      )
    })
  })
})
