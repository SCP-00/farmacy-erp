// ══════════════════════════════════════════════════════════
//  outboxOffline.ts — Fase 1 del POS offline-first (ADR 0004)
//
//  El cobro en caja NUNCA depende de la red: la venta se guarda
//  primero en el outbox (IndexedDB) y luego se intenta enviar.
//  Cada venta lleva un idempotencyKey (UUID local): si el POST
//  se pierde y el POS reintenta, el server devuelve la venta
//  original sin duplicar stock (tabla ventas_sync).
// ══════════════════════════════════════════════════════════

import { openDB, type IDBPDatabase } from 'idb'
import { api } from '@/config/api'

export type EstadoOutbox = 'PENDIENTE' | 'SINCRONIZADA' | 'ERROR'

export interface VentaOutbox {
  idempotencyKey: string   // UUID v4 generado en el POS
  payload: Record<string, unknown> // body exacto de POST /ventas
  estado: EstadoOutbox
  creadoEn: number         // epoch ms
  intentos: number
  ultimoError?: string     // motivo del último fallo (para cola de excepciones)
  ventaId?: string         // respuesta del server al sincronizar
  ventaNum?: number
}

const DB_NAME = 'farmacy-outbox'
const STORE = 'ventas'
const MAX_INTENTOS = 8

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'idempotencyKey' })
          store.createIndex('estado', 'estado')
        }
      },
    })
  }
  return dbPromise
}

/** UUID v4 sin dependencias (crypto está disponible en todo navegador moderno). */
function generarUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback RFC 4122 v4
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  )
}

// ── Cola ──────────────────────────────────────────────────

/** Guarda la venta ANTES de intentar enviarla (el cobro ya ocurrió en caja). */
export async function encolarVenta(payload: Record<string, unknown>): Promise<VentaOutbox> {
  const venta: VentaOutbox = {
    idempotencyKey: generarUUID(),
    payload,
    estado: 'PENDIENTE',
    creadoEn: Date.now(),
    intentos: 0,
  }
  const db = await getDB()
  await db.put(STORE, venta)
  return venta
}

export async function listarVentas(): Promise<VentaOutbox[]> {
  const db = await getDB()
  return (await db.getAll(STORE) as VentaOutbox[]).sort((a, b) => a.creadoEn - b.creadoEn)
}

export async function pendientes(): Promise<VentaOutbox[]> {
  return (await listarVentas()).filter(v => v.estado === 'PENDIENTE' || v.estado === 'ERROR')
}

async function actualizar(venta: VentaOutbox): Promise<void> {
  const db = await getDB()
  await db.put(STORE, venta)
}

// ── Cola de excepciones (revisión humana) ─────────────────

/**
 * Reintenta manualmente una venta en cola de excepciones (estado ERROR).
 * La ficha vuelve a PENDIENTE con contador de intentos en cero, de modo
 * que el ciclo normal de sincronización la procese con backoff limpio.
 * Devuelve true si salió sincronizada en este intento.
 */
export async function reintentarVenta(idempotencyKey: string): Promise<boolean> {
  const db = await getDB()
  const venta = await db.get(STORE, idempotencyKey) as VentaOutbox | undefined
  if (!venta) throw new Error('Venta no encontrada en el outbox')
  venta.estado = 'PENDIENTE'
  venta.intentos = 0
  venta.creadoEn = Date.now() // reinicia la ventana de backoff
  await db.put(STORE, venta)
  return (await sincronizarOutbox()) > 0
}

/**
 * Descarta definitivamente una venta rechazada (error de negocio
 * confirmado por el farmacéuta). El cobro ya se registró en caja: el
 * descarte queda auditado en consola para cuadrar el cierre de caja.
 */
export async function descartarVenta(idempotencyKey: string, motivo: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE, idempotencyKey)
  // Auditoría local del descarte (queda en consola del POS hasta fase 2,
  // que persistirá el log de descartes en IndexedDB aparte).
  console.info(`[outbox] Venta ${idempotencyKey} descartada: ${motivo}`)
}

// ── Envío con reintento exponencial ───────────────────────

function esErrorDeRed(err: unknown): boolean {
  const e = err as { code?: string; response?: unknown }
  // Sin respuesta del server = red caída / timeout → reintentar.
  // Una 4xx/5xx con respuesta es un rechazo real del payload o del negocio.
  return !!e && !e.response
}

async function enviarUna(venta: VentaOutbox): Promise<boolean> {
  try {
    const data = await api.post('/ventas', { ...venta.payload, idempotencyKey: venta.idempotencyKey })
      .then(r => r.data.data)
    venta.estado = 'SINCRONIZADA'
    venta.ventaId = data.ventaId
    venta.ventaNum = data.ventaNum
    venta.ultimoError = undefined
    await actualizar(venta)
    return true
  } catch (err: unknown) {
    venta.intentos += 1
    if (esErrorDeRed(err) && venta.intentos < MAX_INTENTOS) {
      venta.estado = 'PENDIENTE' // se reintenta cuando haya red
    } else {
      // Demasiados reintentos o rechazo real del server (stock, cupón, 422):
      // queda en cola de excepciones para revisión humana — NUNCA se borra
      // ni se reintenta en bucle contra negocio.
      venta.estado = 'ERROR'
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      venta.ultimoError = e?.response?.data?.error ?? e?.message ?? 'Error desconocido'
    }
    await actualizar(venta)
    return false
  }
}

let sincronizando = false

/**
 * Intenta sincronizar toda la cola. Llamar: al arrancar la app,
 * al volver la conexión (evento online) y tras cada cobro.
 * Devuelve cuántas ventas se sincronizaron.
 */
export async function sincronizarOutbox(): Promise<number> {
  if (sincronizando) return 0
  sincronizando = true
  try {
    const cola = await pendientes()
    let sincronizadas = 0
    for (const venta of cola) {
      // Backoff exponencial: 2^n segundos entre intentos
      const espera = Math.min(2 ** venta.intentos, 60) * 1000
      const transcurrido = Date.now() - venta.creadoEn
      if (venta.intentos > 0 && transcurrido < espera) continue
      const ok = await enviarUna(venta)
      if (ok) sincronizadas += 1
    }
    return sincronizadas
  } finally {
    sincronizando = false
  }
}
