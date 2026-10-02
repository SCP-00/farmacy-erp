import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks para vi.mock ─────────────────────────────
const { mockLoteFindMany, mockAlertaDeleteMany, mockAlertaCreate, mockEmpleadoFindMany, mockProductoFindMany, mockConfigFindUnique } =
  vi.hoisted(() => ({
    mockLoteFindMany: vi.fn(),
    mockAlertaDeleteMany: vi.fn(),
    mockAlertaCreate: vi.fn(),
    mockEmpleadoFindMany: vi.fn(),
    mockProductoFindMany: vi.fn(),
    mockConfigFindUnique: vi.fn(),
  }))

vi.mock('../config/database', () => ({
  prisma: {
    lote: { findMany: mockLoteFindMany },
    producto: { findMany: mockProductoFindMany },
    alertaInventario: {
      deleteMany: mockAlertaDeleteMany,
      create: mockAlertaCreate,
    },
    empleado: { findMany: mockEmpleadoFindMany },
    configParam: { findUnique: mockConfigFindUnique },
  },
}))

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../config/mailer', () => ({
  sendEmail: vi.fn(),
  emailTemplates: {},
}))

vi.mock('../jobs/queue', () => ({
  encolarEmail: vi.fn(),
}))

vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
  schedule: vi.fn(),
}))

import { obtenerUmbral, UMBRALES_DIAS, iniciarJobAlertas, verificarRespaldo } from '../jobs/alertas'
import { logger } from '../utils/logger'
import { encolarEmail } from '../jobs/queue'
import cron from 'node-cron'

describe('verificarRespaldo()', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('no alerta cuando el respaldo está vigente', async () => {
    const fecha = new Date(Date.now() - 3_600_000).toISOString()
    mockConfigFindUnique.mockImplementation(({ where }: any) => Promise.resolve(
      where.clave === 'BACKUP_ULTIMO_OK' ? { valor: JSON.stringify({ ok: true, fecha }) } : null))
    mockEmpleadoFindMany.mockResolvedValue([{ email: 'admin@test.co' }])

    await verificarRespaldo()

    expect(logger.info).toHaveBeenCalled()
    expect(encolarEmail).not.toHaveBeenCalled()
  })

  it('alerta a todos los administradores cuando el respaldo FALLÓ', async () => {
    mockConfigFindUnique.mockImplementation(({ where }: any) => Promise.resolve(
      where.clave === 'BACKUP_ULTIMO_OK' ? { valor: JSON.stringify({ ok: false, fecha: new Date().toISOString() }) } : null))
    mockEmpleadoFindMany.mockResolvedValue([{ email: 'a@test.co' }, { email: 'b@test.co' }])

    await verificarRespaldo()

    expect(logger.error).toHaveBeenCalled()
    expect(encolarEmail).toHaveBeenCalledTimes(2)
  })

  it('alerta cuando no hay registro de respaldo', async () => {
    mockConfigFindUnique.mockResolvedValue(null)
    mockEmpleadoFindMany.mockResolvedValue([{ email: 'a@test.co' }])

    await verificarRespaldo()

    expect(encolarEmail).toHaveBeenCalledTimes(1)
  })
})

// ── Tests de la función pura obtenerUmbral ─────────────────
describe('obtenerUmbral()', () => {
  it('retorna VENCIDO cuando díasRestantes <= 0', () => {
    expect(obtenerUmbral(0)).toEqual({ tipo: 'VENCIDO', mensaje: '⚠️ VENCIDO' })
  })

  it('retorna VENCIDO para días negativos', () => {
    expect(obtenerUmbral(-5)).toEqual({ tipo: 'VENCIDO', mensaje: '⚠️ VENCIDO' })
    expect(obtenerUmbral(-999)).toEqual({ tipo: 'VENCIDO', mensaje: '⚠️ VENCIDO' })
  })

  it('retorna CRITICO cuando díasRestantes está entre 1 y 15', () => {
    expect(obtenerUmbral(1)).toEqual({ tipo: 'CRITICO', mensaje: '🔴 Vence en 1 días' })
    expect(obtenerUmbral(15)).toEqual({ tipo: 'CRITICO', mensaje: '🔴 Vence en 15 días' })
  })

  it('retorna PROXIMO_VENCER cuando díasRestantes está entre 16 y 30', () => {
    expect(obtenerUmbral(16)).toEqual({ tipo: 'PROXIMO_VENCER', mensaje: '🟡 Vence en 16 días' })
    expect(obtenerUmbral(30)).toEqual({ tipo: 'PROXIMO_VENCER', mensaje: '🟡 Vence en 30 días' })
  })

  it('retorna null cuando díasRestantes > 30', () => {
    expect(obtenerUmbral(31)).toBeNull()
    expect(obtenerUmbral(365)).toBeNull()
  })

  it('tiene los umbrales ordenados como [30, 15, 0]', () => {
    expect(UMBRALES_DIAS).toEqual([30, 15, 0])
  })
})

// ── Tests de iniciarJobAlertas ─────────────────────────────
describe('iniciarJobAlertas()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('programa el CRON con la expresión y timezone correctos', () => {
    iniciarJobAlertas()

    expect(cron.schedule).toHaveBeenCalledTimes(1)
    const [expresion, _cb, options] = (cron.schedule as any).mock.calls[0]
    expect(expresion).toBe('0 7 * * *')
    expect(options).toEqual({ timezone: 'America/Bogota' })
    expect(logger.info).toHaveBeenCalledWith(
      '[Job Alertas] Programado — todos los días a las 7:00 AM'
    )
  })
})

// ── Tests de verificarVencimientos (vía callback CRON) ─────
describe('verificarVencimientos (a través del CRON)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function ejecutarCron() {
    const spy = vi.mocked(cron.schedule)
    iniciarJobAlertas()
    const callback = spy.mock.calls[0][1] as () => Promise<void>
    return callback()
  }

  it('no crea alertas si no hay lotes próximos a vencer', async () => {
    mockLoteFindMany.mockResolvedValue([])

    await ejecutarCron()

    expect(mockAlertaCreate).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      '[Job Alertas] Sin lotes próximos a vencer'
    )
  })

  it('crea alertas para lotes en diferentes umbrales', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))

    mockLoteFindMany.mockResolvedValue([
      {
        id: 'lote-vencido', codigoLote: 'L001',
        fechaVencimiento: new Date('2026-05-28'),
        cantidadActual: 10,
        producto: { nombre: 'Ibuprofeno', concentracion: '400mg' },
        sucursal: { nombre: 'Sede Central' },
      },
      {
        id: 'lote-critico', codigoLote: 'L002',
        fechaVencimiento: new Date('2026-06-10'),
        cantidadActual: 20,
        producto: { nombre: 'Acetaminofén', concentracion: '500mg' },
        sucursal: { nombre: 'Sede Norte' },
      },
      {
        id: 'lote-proximo', codigoLote: 'L003',
        fechaVencimiento: new Date('2026-06-25'),
        cantidadActual: 15,
        producto: { nombre: 'Loratadina', concentracion: '10mg' },
        sucursal: { nombre: 'Sede Central' },
      },
    ] as any)

    mockAlertaDeleteMany.mockResolvedValue({ count: 0 })
    mockAlertaCreate.mockResolvedValue({})
    mockEmpleadoFindMany.mockResolvedValue([])

    await ejecutarCron()

    // Verificar deleteMany
    expect(mockAlertaDeleteMany).toHaveBeenCalledWith({
      where: {
        loteId: { in: ['lote-vencido', 'lote-critico', 'lote-proximo'] },
        leida: false,
      },
    })

    // Verificar 3 creates con tipos correctos
    expect(mockAlertaCreate).toHaveBeenCalledTimes(3)

    const args = mockAlertaCreate.mock.calls
    // Cada call recibe { data: { loteId, tipo, mensaje } }
    const tipos = args.map((a: any[]) => a[0].data.tipo)
    expect(tipos).toContain('VENCIDO')
    expect(tipos).toContain('CRITICO')
    expect(tipos).toContain('PROXIMO_VENCER')

    const vencido = args.find((a: any[]) => a[0].data.tipo === 'VENCIDO')
    expect(vencido).toBeDefined()
    if (!vencido) return
    expect(vencido[0].data.loteId).toBe('lote-vencido')
    expect(vencido[0].data.mensaje).toContain('Ibuprofeno')

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Vencidos: 1 | Críticos: 1 | Próximos: 1')
    )

    vi.useRealTimers()
  })

  it('envía email cuando hay lotes vencidos o críticos', async () => {
    const { encolarEmail } = await import('../jobs/queue')

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))

    mockLoteFindMany.mockResolvedValue([
      {
        id: 'lote-critico', codigoLote: 'L002',
        fechaVencimiento: new Date('2026-06-05'),
        cantidadActual: 20,
        producto: { nombre: 'Acetaminofén', concentracion: '500mg' },
        sucursal: { nombre: 'Sede Norte' },
      },
    ] as any)
    mockAlertaDeleteMany.mockResolvedValue({ count: 0 })
    mockAlertaCreate.mockResolvedValue({})
    mockEmpleadoFindMany.mockResolvedValue([
      { email: 'admin@farmacy.co', nombre: 'Admin' },
    ])

    await ejecutarCron()

    expect(encolarEmail).toHaveBeenCalledWith(
      'admin@farmacy.co',
      expect.stringContaining('crítico'),
      expect.any(String),
    )

    vi.useRealTimers()
  })

  it('no envía email si solo hay lotes próximos a vencer', async () => {
    const { encolarEmail } = await import('../jobs/queue')

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))

    mockLoteFindMany.mockResolvedValue([
      {
        id: 'lote-proximo', codigoLote: 'L003',
        fechaVencimiento: new Date('2026-06-25'),
        cantidadActual: 15,
        producto: { nombre: 'Loratadina', concentracion: '10mg' },
        sucursal: { nombre: 'Sede Central' },
      },
    ] as any)
    mockAlertaDeleteMany.mockResolvedValue({ count: 0 })
    mockAlertaCreate.mockResolvedValue({})
    mockEmpleadoFindMany.mockResolvedValue([])

    await ejecutarCron()

    expect(encolarEmail).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})

// ── Tests de verificarStockMinimo (vía callback CRON) ─────
describe('verificarStockMinimo (a través del CRON)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Evitar que verificarVencimientos (ejecutado antes en el CRON) dispare alertas
    mockLoteFindMany.mockResolvedValue([])
  })

  function ejecutarCron() {
    const spy = vi.mocked(cron.schedule)
    iniciarJobAlertas()
    const callback = spy.mock.calls[0][1] as () => Promise<void>
    return callback()
  }

  it('no crea alertas si ningún producto está en stock crítico', async () => {
    mockProductoFindMany.mockResolvedValue([
      {
        id: 'prod-1', nombre: 'Ibuprofeno', concentracion: '400mg',
        stockMinimo: 10,
        lotes: [{ cantidadActual: 15, sucursalId: 1, sucursal: { nombre: 'Central' } }],
      },
    ] as any)

    await ejecutarCron()

    expect(mockAlertaCreate).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      '[Job Alertas] Sin productos en stock crítico'
    )
  })

  it('crea alerta cuando un producto tiene stock por debajo del mínimo', async () => {
    mockProductoFindMany.mockResolvedValue([
      {
        id: 'prod-1', nombre: 'Amoxicilina', concentracion: '500mg',
        stockMinimo: 50,
        lotes: [{ cantidadActual: 10, sucursalId: 1, sucursal: { nombre: 'Central' } }],
      },
    ] as any)
    mockAlertaCreate.mockResolvedValue({})

    await ejecutarCron()

    expect(mockAlertaCreate).toHaveBeenCalledTimes(1)
    const args = mockAlertaCreate.mock.calls[0]
    expect(args[0].data.tipo).toBe('STOCK_MINIMO')
    expect(args[0].data.mensaje).toContain('Amoxicilina')
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('1 productos en stock crítico')
    )
  })

  it('crea alertas para múltiples productos en stock crítico', async () => {
    mockProductoFindMany.mockResolvedValue([
      {
        id: 'prod-1', nombre: 'Amoxicilina', concentracion: '500mg',
        stockMinimo: 50,
        lotes: [{ cantidadActual: 10, sucursalId: 1, sucursal: { nombre: 'Central' } }],
      },
      {
        id: 'prod-2', nombre: 'Metformina', concentracion: '850mg',
        stockMinimo: 30,
        lotes: [{ cantidadActual: 5, sucursalId: 1, sucursal: { nombre: 'Central' } }],
      },
    ] as any)
    mockAlertaCreate.mockResolvedValue({})

    await ejecutarCron()

    expect(mockAlertaCreate).toHaveBeenCalledTimes(2)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('2 productos en stock crítico')
    )
  })
})
