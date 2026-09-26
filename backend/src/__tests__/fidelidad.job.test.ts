import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────
const { mockPrisma, mockCronSchedule } = vi.hoisted(() => ({
  mockPrisma: {
    configParam: { findUnique: vi.fn() },
    cliente: { findMany: vi.fn(), update: vi.fn() },
    venta: { findMany: vi.fn(), update: vi.fn() },
    lote: { findUnique: vi.fn(), update: vi.fn() },
    codigoDescuento: { update: vi.fn() },
    pagoTransaccion: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $transaction: vi.fn(),
  },
  mockCronSchedule: vi.fn(),
}))

vi.mock('../config/database', () => ({ prisma: mockPrisma }))

vi.mock('node-cron', () => ({
  default: { schedule: mockCronSchedule },
  schedule: mockCronSchedule,
}))

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { expirarPuntosVencidos, expirarPedidosHuerfanos, iniciarJobsFidelidad } from '../jobs/fidelidad'

describe('Jobs de fidelidad', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('expirarPuntosVencidos()', () => {
    it('zerea el saldo de clientes con puntosExpiranEn vencido', async () => {
      mockPrisma.cliente.findMany.mockResolvedValue([
        { id: 'cli-1', puntosAcumulados: 150 },
        { id: 'cli-2', puntosAcumulados: 20 },
      ])

      const n = await expirarPuntosVencidos()

      expect(n).toBe(2)
      expect(mockPrisma.cliente.update).toHaveBeenCalledTimes(2)
      expect(mockPrisma.cliente.update).toHaveBeenCalledWith({
        where: { id: 'cli-1' },
        data: { puntosAcumulados: 0, puntosExpiranEn: null },
      })
    })

    it('no actualiza a nadie si no hay clientes vencidos', async () => {
      mockPrisma.cliente.findMany.mockResolvedValue([])
      const n = await expirarPuntosVencidos()
      expect(n).toBe(0)
      expect(mockPrisma.cliente.update).not.toHaveBeenCalled()
    })
  })

  describe('expirarPedidosHuerfanos()', () => {
    it('expira venta PENDIENTE antigua: reintegra stock, revierte cupón y marca EXPIRADO', async () => {
      mockPrisma.configParam.findUnique.mockResolvedValue({ clave: 'PEDIDO_HUERFANO_HORAS', valor: '24' })
      const venta = {
        id: 'v-1',
        numero: 10,
        codigoDescuento: { id: 'cupon-1' },
        detalles: [
          { loteId: 'lote-vigente', cantidad: 2 },
          { loteId: 'lote-vencido', cantidad: 1 },
        ],
      }
      mockPrisma.venta.findMany.mockResolvedValue([venta])
      mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
      mockPrisma.lote.findUnique
        .mockResolvedValueOnce({ id: 'lote-vigente', fechaVencimiento: new Date(Date.now() + 86400000) })
        .mockResolvedValueOnce({ id: 'lote-vencido', fechaVencimiento: new Date(Date.now() - 86400000) })

      const n = await expirarPedidosHuerfanos()

      expect(n).toBe(1)
      // Lote vigente: stock reintegrado
      expect(mockPrisma.lote.update).toHaveBeenCalledWith({
        where: { id: 'lote-vigente' },
        data: { cantidadActual: { increment: 2 } },
      })
      // Lote vencido: NO se reintegra (no vendible)
      expect(mockPrisma.lote.update).not.toHaveBeenCalledWith({
        where: { id: 'lote-vencido' },
        data: expect.anything(),
      })
      // Cupón revertido
      expect(mockPrisma.codigoDescuento.update).toHaveBeenCalledWith({
        where: { id: 'cupon-1' },
        data: { usosActuales: { decrement: 1 } },
      })
      // Venta marcada EXPIRADO
      expect(mockPrisma.venta.update).toHaveBeenCalledWith({
        where: { id: 'v-1' },
        data: { estado: 'EXPIRADO' },
      })
      // Pagos pendientes → RECHAZADO
      expect(mockPrisma.pagoTransaccion.updateMany).toHaveBeenCalledWith({
        where: { ventaId: 'v-1', estado: 'PENDIENTE' },
        data: { estado: 'RECHAZADO' },
      })
    })

    it('usa 24h por defecto si no hay config', async () => {
      mockPrisma.configParam.findUnique.mockResolvedValue(null)
      mockPrisma.venta.findMany.mockResolvedValue([])

      await expirarPedidosHuerfanos()

      const corteArg = mockPrisma.venta.findMany.mock.calls[0][0].where.creadoEn.lt as Date
      const horasReales = (Date.now() - corteArg.getTime()) / 3_600_000
      expect(horasReales).toBeGreaterThan(23.9)
      expect(horasReales).toBeLessThan(24.1)
    })
  })

  describe('iniciarJobsFidelidad()', () => {
    it('programa los dos crons', () => {
      iniciarJobsFidelidad()
      expect(mockCronSchedule).toHaveBeenCalledTimes(2)
      expect(mockCronSchedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function), expect.anything())
      expect(mockCronSchedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function), expect.anything())
    })
  })
})
