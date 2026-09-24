import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks de dependencias externas con vi.hoisted ──────────
const { mockFindMany, mockUpdate, mockProductoUpdate } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockProductoUpdate: vi.fn(),
}))

vi.mock('../config/database', () => ({
  prisma: {
    lote: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
    producto: {
      update: mockProductoUpdate,
    },
  },
}))

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { InventarioService } from '../services/inventario.service'

describe('InventarioService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── obtenerLotesFEFO ─────────────────────────────────────
  describe('obtenerLotesFEFO()', () => {
    it('retorna lotes ordenados por fecha de vencimiento ascendente', async () => {
      const lotesOrdenados = [
        { id: 'lote-2', fechaVencimiento: new Date('2026-06-01'), cantidadActual: 5 },
        { id: 'lote-1', fechaVencimiento: new Date('2026-07-15'), cantidadActual: 10 },
        { id: 'lote-3', fechaVencimiento: new Date('2026-08-20'), cantidadActual: 8 },
      ]

      mockFindMany.mockResolvedValue(lotesOrdenados)

      const resultado = await InventarioService.obtenerLotesFEFO('prod-1', 1)

      expect(resultado).toHaveLength(3)
      expect(resultado[0].id).toBe('lote-2')  // Primero el que vence antes
      expect(resultado[1].id).toBe('lote-1')
      expect(resultado[2].id).toBe('lote-3')

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          productoId: 'prod-1',
          sucursalId: 1,
          cantidadActual: { gt: 0 },
          fechaVencimiento: { gt: expect.any(Date) },
        },
        orderBy: { fechaVencimiento: 'asc' },
      })
    })

    it('retorna array vacío si no hay lotes con stock', async () => {
      mockFindMany.mockResolvedValue([])
      const resultado = await InventarioService.obtenerLotesFEFO('prod-1', 1)
      expect(resultado).toEqual([])
    })
  })

  // ── descontarStockFEFO (contrato hardening: $queryRaw FOR UPDATE + updateMany atómico) ──
  describe('descontarStockFEFO()', () => {
    function crearTx(lotes: any[]) {
      return {
        $queryRaw: vi.fn().mockResolvedValue(lotes),
        lote: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      }
    }

    it('descuenta de un solo lote si hay suficiente stock', async () => {
      const mockTx = crearTx([{ id: 'lote-1', cantidad_actual: 20, precio_compra: 1500 }])

      const resultado = await InventarioService.descontarStockFEFO(mockTx, 'prod-1', 1, 5)

      expect(resultado).toEqual([{ loteId: 'lote-1', cantidad: 5, precioCompra: 1500 }])
      expect(mockTx.lote.updateMany).toHaveBeenCalledWith({
        where: { id: 'lote-1', cantidadActual: { gte: 5 } },
        data: { cantidadActual: { decrement: 5 } },
      })
    })

    it('descuenta de múltiples lotes siguiendo FEFO', async () => {
      const mockTx = crearTx([
        { id: 'lote-1', cantidad_actual: 5, precio_compra: 1000 },
        { id: 'lote-2', cantidad_actual: 10, precio_compra: 2000 },
      ])

      const resultado = await InventarioService.descontarStockFEFO(mockTx, 'prod-1', 1, 12)

      expect(resultado).toEqual([
        { loteId: 'lote-1', cantidad: 5, precioCompra: 1000 },
        { loteId: 'lote-2', cantidad: 7, precioCompra: 2000 },
      ])
      expect(mockTx.lote.updateMany).toHaveBeenCalledTimes(2)
      expect(mockTx.lote.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 'lote-2', cantidadActual: { gte: 7 } },
        data: { cantidadActual: { decrement: 7 } },
      })
    })

    it('lanza error si no hay stock suficiente entre todos los lotes', async () => {
      const mockTx = crearTx([{ id: 'lote-1', cantidad_actual: 3, precio_compra: 1000 }])

      await expect(
        InventarioService.descontarStockFEFO(mockTx, 'prod-1', 1, 10)
      ).rejects.toThrow('Sin stock suficiente')

      expect(mockTx.lote.updateMany).toHaveBeenCalledTimes(1)
    })

    it('lanza error si el decremento atómico no matchea (conflicto de concurrencia)', async () => {
      const mockTx = crearTx([{ id: 'lote-1', cantidad_actual: 20, precio_compra: 1000 }])
      mockTx.lote.updateMany.mockResolvedValue({ count: 0 })

      await expect(
        InventarioService.descontarStockFEFO(mockTx, 'prod-1', 1, 5)
      ).rejects.toThrow('Conflicto de stock')
    })

    it('descuenta la cantidad exacta cuando es igual al stock disponible', async () => {
      const mockTx = crearTx([{ id: 'lote-1', cantidad_actual: 10, precio_compra: 900 }])

      const resultado = await InventarioService.descontarStockFEFO(mockTx, 'prod-1', 1, 10)

      expect(resultado).toEqual([{ loteId: 'lote-1', cantidad: 10, precioCompra: 900 }])
    })

    it('respeta el orden FEFO (el mock simula el ORDER BY fecha_vencimiento ASC con FOR UPDATE)', async () => {
      const mockTx = crearTx([
        { id: 'lote-A', cantidad_actual: 5, precio_compra: 100 },
        { id: 'lote-C', cantidad_actual: 10, precio_compra: 300 },
        { id: 'lote-B', cantidad_actual: 8, precio_compra: 200 },
      ])

      const resultado = await InventarioService.descontarStockFEFO(mockTx, 'prod-1', 1, 18)

      // FEFO: lote-A (jun) → lote-C (jul) → lote-B (ago)
      // Toma: 5 del A, 10 del C, 3 del B
      expect(resultado).toEqual([
        { loteId: 'lote-A', cantidad: 5, precioCompra: 100 },
        { loteId: 'lote-C', cantidad: 10, precioCompra: 300 },
        { loteId: 'lote-B', cantidad: 3, precioCompra: 200 },
      ])
    })
  })

  // ── actualizarCostoPromedio ──────────────────────────────
  describe('actualizarCostoPromedio()', () => {
    it('calcula el promedio ponderado correctamente', async () => {
      mockFindMany.mockResolvedValue([
        { cantidadActual: 10, precioCompra: 1000 },
        { cantidadActual: 20, precioCompra: 2000 },
      ] as any)

      const promedio = await InventarioService.actualizarCostoPromedio('prod-1', 1500)

      // (10*1000 + 20*2000) / (10+20) = 50000/30 ≈ 1666.67
      expect(promedio).toBeCloseTo(1666.67, 0)
      expect(mockProductoUpdate).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { precioPromedio: expect.any(Number) },
      })
    })

    it('usa el fallback cuando no hay lotes con stock', async () => {
      mockFindMany.mockResolvedValue([] as any)

      const promedio = await InventarioService.actualizarCostoPromedio('prod-1', 2500)

      expect(promedio).toBe(2500)
      expect(mockProductoUpdate).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { precioPromedio: 2500 },
      })
    })

    it('retorna el precio de compra cuando hay un solo lote', async () => {
      mockFindMany.mockResolvedValue([
        { cantidadActual: 50, precioCompra: 3000 },
      ] as any)

      const promedio = await InventarioService.actualizarCostoPromedio('prod-1', 1000)
      expect(promedio).toBe(3000)
    })
  })
})
