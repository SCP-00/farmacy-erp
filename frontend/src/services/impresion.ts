// ══════════════════════════════════════════════════════════
//  impresion.ts — Tirilla térmica desde el POS
//
//  Dos transportes:
//   1. RED (preferido en LAN): el backend imprime a la impresora de
//      la sucursal (TCP 9100). No requiere nada en el navegador.
//   2. USB directo (WebUSB): si el cajero conectó una térmica USB al
//      equipo, el navegador le manda los bytes ESC/POS sin backend.
//
//  El POS usa RED por defecto y cae a USB si hay una impresora guardada.
// ══════════════════════════════════════════════════════════
import { api } from '@/config/api'

const CLAVE_USB = 'farmacy.impresoraUSB'
const CLAVE_AUTO = 'farmacy.impresionAutomatica'

export interface ImpresoraUSBGuardada {
  vendorId: number
  productId: number
  nombre: string
}

export interface ResultadoImpresion {
  impreso: boolean
  via?: 'red' | 'usb'
  motivo?: string
}

// ── WebUSB ────────────────────────────────────────────────

/** ¿El navegador soporta WebUSB? (Chrome/Edge; no Firefox/Safari). */
export function soportaWebUSB(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}

export function obtenerImpresoraUSB(): ImpresoraUSBGuardada | null {
  try {
    const crudo = localStorage.getItem(CLAVE_USB)
    return crudo ? (JSON.parse(crudo) as ImpresoraUSBGuardada) : null
  } catch {
    return null
  }
}

/** Pide al cajero elegir una impresora USB y la recuerda. */
export async function seleccionarImpresoraUSB(): Promise<ImpresoraUSBGuardada | null> {
  const usb = (navigator as any).usb
  if (!usb) throw new Error('Este navegador no soporta impresión USB directa (use Chrome/Edge o la impresión por red)')
  const device = await usb.requestDevice({ filters: [] })
  if (!device) return null
  const guardada: ImpresoraUSBGuardada = {
    vendorId: device.vendorId,
    productId: device.productId,
    nombre: device.productName ?? 'Impresora USB',
  }
  localStorage.setItem(CLAVE_USB, JSON.stringify(guardada))
  return guardada
}

export function olvidarImpresoraUSB(): void {
  localStorage.removeItem(CLAVE_USB)
}

/** Reconecta el dispositivo previamente autorizado. */
async function abrirImpresoraUSB(): Promise<any> {
  const usb = (navigator as any).usb
  if (!usb) throw new Error('WebUSB no disponible')
  const guardada = obtenerImpresoraUSB()
  if (!guardada) throw new Error('No hay impresora USB seleccionada')
  const devices: any[] = await usb.getDevices()
  const device = devices.find((d) => d.vendorId === guardada.vendorId && d.productId === guardada.productId)
  if (!device) throw new Error('La impresora USB no está conectada o no fue autorizada')
  await device.open()
  if (!device.configuration) await device.selectConfiguration(1)
  return device
}

/** Envía bytes ESC/POS a la impresora USB seleccionada. */
export async function imprimirPorWebUSB(bytes: Uint8Array): Promise<void> {
  const device = await abrirImpresoraUSB()
  try {
    // Interfaz de impresora (clase 7 = printer) o la primera disponible.
    const interfaz =
      device.configuration.interfaces.find((i: any) => i.alternate.interfaceClass === 7) ??
      device.configuration.interfaces[0]
    await device.claimInterface(interfaz.interfaceNumber)
    const endpoint = interfaz.alternate.endpoints.find((e: any) => e.direction === 'out' && e.type === 'bulk')
    if (!endpoint) throw new Error('La impresora no expone un canal de salida (endpoint bulk OUT)')
    await device.transferOut(endpoint.endpointNumber, bytes)
    await device.releaseInterface(interfaz.interfaceNumber)
  } finally {
    await device.close().catch(() => undefined)
  }
}

// ── Backend ───────────────────────────────────────────────

/** Descarga los bytes ESC/POS de la tirilla desde el servidor. */
export async function obtenerBytesTirilla(ventaId: string): Promise<Uint8Array> {
  const res = await api.get(`/impresion/tirilla/${ventaId}`, { responseType: 'arraybuffer' })
  return new Uint8Array(res.data)
}

/** Pide al backend imprimir en la impresora de red de la sucursal. */
export async function imprimirEnRed(
  ventaId: string,
  opts: { sucursalId?: number; abrirCajon?: boolean } = {},
): Promise<ResultadoImpresion> {
  const data = await api.post(`/impresion/tirilla/${ventaId}`, opts).then(r => r.data.data)
  return { ...data, via: data?.impreso ? 'red' : undefined }
}

// ── Configuración (administrador) ─────────────────────────

export interface ConfigImpresoraSede {
  host: string
  port: number
  ancho: number
  abrirCajon: boolean
}

/** Lee las impresoras configuradas en el servidor. */
export async function obtenerConfigImpresoras(): Promise<Array<Record<string, unknown>>> {
  return api.get('/impresion/config').then(r => r.data.data)
}

/** Guarda la impresora de una sede (o la de respaldo si no se pasa sucursalId). */
export async function guardarConfigImpresora(
  data: { sucursalId?: number } & ConfigImpresoraSede,
): Promise<void> {
  await api.put('/impresion/config', data)
}

// ── Orquestación ──────────────────────────────────────────

export function impresionAutomatica(): boolean {
  return localStorage.getItem(CLAVE_AUTO) === '1'
}

export function activarImpresionAutomatica(activa: boolean): void {
  localStorage.setItem(CLAVE_AUTO, activa ? '1' : '0')
}

/**
 * Imprime una tirilla usando el mejor transporte disponible:
 * USB guardada → WebUSB; si no, impresora de red configurada en el servidor.
 */
export async function imprimirTirilla(
  ventaId: string,
  opts: { sucursalId?: number; abrirCajon?: boolean } = {},
): Promise<ResultadoImpresion> {
  // 1) USB directo si hay una impresora guardada en este equipo
  if (soportaWebUSB() && obtenerImpresoraUSB()) {
    try {
      const bytes = await obtenerBytesTirilla(ventaId)
      await imprimirPorWebUSB(bytes)
      return { impreso: true, via: 'usb' }
    } catch (err: any) {
      // Si falla el USB, intentamos la impresora de red antes de rendirnos
      const red = await imprimirEnRed(ventaId, opts).catch(() => null)
      if (red?.impreso) return red
      return { impreso: false, motivo: err?.message ?? 'No se pudo imprimir por USB' }
    }
  }

  // 2) Impresora de red de la sucursal (vía backend)
  return imprimirEnRed(ventaId, opts)
}
