/**
 * TESTS — Outbox offline fase 1 (ADR 0004).
 *
 * El outbox es el componente más delicado del POS offline: cobra en local,
 * garantiza idempotencia y decide cuándo reintentar. Estos tests verifican
 * la lógica de cola y reintento con IndexedDB mockeado y axios mockeado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────
const { mockApiPost, mockStore } = vi.hoisted(() => {
  const registros = new Map<string, any>()
  return {
    mockApiPost: vi.fn(),
    mockStore: {
      registros,
      put: vi.fn(async (_store: string, val: any) => { registros.set(val.idempotencyKey, structuredClone(val)) }),
      getAll: vi.fn(async () => [...registros.values()].map(v => structuredClone(v))),
      get: vi.fn(async (_store: string, key: string) => {
        const v = registros.get(key)
        return v ? structuredClone(v) : undefined
      }),
      delete: vi.fn(async (_store: string, key: string) => { registros.delete(key) }),
    },
  }
})

vi.mock('idb', () => ({
  openDB: vi.fn(async () => mockStore),
}))

vi.mock('@/config/api', () => ({
  api: { post: mockApiPost },
}))

import { encolarVenta, sincronizarOutbox, pendientes, listarVentas, reintentarVenta, descartarVenta } from './outboxOffline'

describe('outboxOffline (ADR 0004 fase 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.registros.clear()
    // Congelar el tiempo para probar el backoff de forma determinista
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const payloadBase = {
    sucursalId: 1,
    metodoPago: 'EFECTIVO',
    descuento: 0,
    items: [{ productoId: 'prod-1', cantidad: 1 }],
  }

  it('encola la venta ANTES de enviarla, con UUID de idempotencia', async () => {
    const venta = await encolarVenta(payloadBase)

    // UUID v4 válido generado en el POS (la clave de toda la idempotencia)
    expect(venta.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(venta.estado).toBe('PENDIENTE')
    expect(venta.intentos).toBe(0)
    // Quedó persistida en IndexedDB ANTES de cualquier intento de red
    expect(mockStore.registros.has(venta.idempotencyKey)).toBe(true)
  })

  it('sincroniza con idempotencyKey dentro del payload del POST', async () => {
    mockApiPost.mockResolvedValue({ data: { data: { ventaId: 'v1', ventaNum: 7, total: 5000 } } })

    await encolarVenta(payloadBase)
    const n = await sincronizarOutbox()

    expect(n).toBe(1)
    expect(mockApiPost).toHaveBeenCalledWith('/ventas', expect.objectContaining({
      ...payloadBase,
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    }))
    const [venta] = await listarVentas()
    expect(venta.estado).toBe('SINCRONIZADA')
    expect(venta.ventaId).toBe('v1')
    expect(venta.ventaNum).toBe(7)
  })

  it('con red caída la venta queda PENDIENTE y reintenta con backoff', async () => {
    // Sin response = error de red (caída/timeout), NO rechazo de negocio
    mockApiPost.mockRejectedValue(new Error('Network Error'))

    await encolarVenta(payloadBase)
    expect(await sincronizarOutbox()).toBe(0)

    let [venta] = await pendientes()
    expect(venta.estado).toBe('PENDIENTE')
    expect(venta.intentos).toBe(1)
    expect(venta.ultimoError).toBeUndefined() // no es error de negocio

    // Backoff exponencial: con 1 intento espera 2s — todavía NO reintenta
    vi.setSystemTime(new Date('2026-09-24T12:00:01Z'))
    expect(await sincronizarOutbox()).toBe(0)
    expect(mockApiPost).toHaveBeenCalledTimes(1)

    // Pasados los 2s de espera, el reintento sale y ahora tiene red
    vi.setSystemTime(new Date('2026-09-24T12:00:03Z'))
    mockApiPost.mockResolvedValue({ data: { data: { ventaId: 'v2', ventaNum: 8, total: 5000 } } })
    expect(await sincronizarOutbox()).toBe(1)

    const [final] = await listarVentas()
    expect(final.estado).toBe('SINCRONIZADA')
  })

  it('rechazo del server (stock, 4xx) va a cola de excepciones: ERROR, no reintento infinito', async () => {
    const err: any = new Error('Bad Request')
    err.response = { status: 400, data: { error: 'Sin stock suficiente para el producto' } }
    mockApiPost.mockRejectedValue(err)

    await encolarVenta(payloadBase)
    expect(await sincronizarOutbox()).toBe(0)

    const [venta] = await pendientes()
    expect(venta.estado).toBe('ERROR')
    // El motivo queda guardado para la revisión humana del farmacéuta
    expect(venta.ultimoError).toBe('Sin stock suficiente para el producto')
    // Nunca reenvía automáticamente un rechazo de negocio
    expect(await sincronizarOutbox()).toBe(0)
    expect(mockApiPost).toHaveBeenCalledTimes(1)
  })

  it('agota MAX_INTENTOS ante red caída persistente y pasa a ERROR (revisión humana)', async () => {
    mockApiPost.mockRejectedValue(new Error('Network Error'))

    await encolarVenta(payloadBase)
    // Simular 8 intentos fallidos saltando el tiempo entre cada uno
    for (let i = 1; i <= 8; i++) {
      vi.setSystemTime(new Date(Date.parse('2026-09-24T12:00:00Z') + i * 61_000))
      await sincronizarOutbox()
    }

    const [venta] = await pendientes()
    expect(venta.estado).toBe('ERROR')
    expect(venta.intentos).toBe(8)
    expect(venta.ultimoError).toBe('Network Error')
  })

  // ── Cola de excepciones: revisión humana ─────────────────

  it('reintentarVenta: ERROR → PENDIENTE con intentos 0 y se sincroniza al haber negocio válido', async () => {
    // Primer intento: rechazo de negocio (p. ej. stock transitoriamente
    // sin recibir mercancía). Segundo: el server ya lo acepta.
    const err: any = new Error('Bad Request')
    err.response = { status: 400, data: { error: 'Sin stock suficiente' } }
    mockApiPost.mockRejectedValueOnce(err)
      .mockResolvedValueOnce({ data: { data: { ventaId: 'v9', ventaNum: 9, total: 4500 } } })

    await encolarVenta(payloadBase)
    await sincronizarOutbox()
    let [venta] = await pendientes()
    expect(venta.estado).toBe('ERROR')

    const ok = await reintentarVenta(venta.idempotencyKey)
    expect(ok).toBe(true)

    // Ya no está en la cola de excepciones: quedó sincronizada
    expect(await pendientes()).toHaveLength(0)
    const [final] = await listarVentas()
    expect(final.estado).toBe('SINCRONIZADA')
    expect(final.ventaNum).toBe(9)
    expect(final.intentos).toBe(0)
  })

  it('reintentarVenta lanza error si la ficha no existe', async () => {
    await expect(reintentarVenta('no-existe')).rejects.toThrow('Venta no encontrada en el outbox')
  })

  it('descartarVenta elimina la ficha del outbox (error confirmado por el farmacéuta)', async () => {
    const err: any = new Error('Bad Request')
    err.response = { status: 422, data: { error: 'Cupón vencido' } }
    mockApiPost.mockRejectedValue(err)

    await encolarVenta(payloadBase)
    await sincronizarOutbox()
    const [venta] = await pendientes()
    expect(venta.estado).toBe('ERROR')

    await descartarVenta(venta.idempotencyKey, 'Cupón vencido confirmado')
    expect(await listarVentas()).toHaveLength(0)
  })
})
