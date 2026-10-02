// ══════════════════════════════════════════════════════════
//  SERVICIO DE IMPRESIÓN — Tirilla térmica ESC/POS
//
//  Escenario: una farmacia con varias cajas en LAN. El backend
//  (en la red local) imprime a la impresora térmica de cada caja
//  por TCP puerto 9100 (JetDirect/RAW), la vía estándar de las
//  impresoras POS (Epson TM, Genéricas 80mm).
//
//  La configuración vive en `config_param` (editable sin deploy):
//   - IMPRESORA_SUCURSAL_<id>  JSON { host, port, ancho, abrirCajon }
//   - IMPRESORA_DEFAULT        respaldo si la sede no tiene la suya
// ══════════════════════════════════════════════════════════
import net from 'net'
import {
  EscPosBuilder,
  envolverTexto,
  formatearPesos,
  filaDosColumnas,
  filaEtiquetaValor,
} from '../utils/escpos.utils'

export interface ConfigImpresora {
  host: string
  port: number
  ancho: number
  abrirCajon: boolean
}

export interface DatosNegocio {
  nombre: string
  nit?: string
  direccion?: string
  telefono?: string
}

export interface OpcionesTirilla {
  ancho?: number
  abrirCajon?: boolean
  pie?: string
}

const ANCHO_DEFECTO = 48
const TIMEOUT_RED_MS = 5000

// ── Configuración ─────────────────────────────────────────

/** Lee la config de impresora de la sucursal (o la de respaldo). */
export async function obtenerConfigImpresora(db: any, sucursalId?: number): Promise<ConfigImpresora | null> {
  const claves = [
    ...(sucursalId != null ? [`IMPRESORA_SUCURSAL_${sucursalId}`] : []),
    'IMPRESORA_DEFAULT',
  ]
  const params: any[] = await db.configParam.findMany({ where: { clave: { in: claves } } })
  const porClave: Record<string, string> = Object.fromEntries(params.map(p => [p.clave, p.valor]))

  const crudo = (sucursalId != null ? porClave[`IMPRESORA_SUCURSAL_${sucursalId}`] : undefined)
    ?? porClave['IMPRESORA_DEFAULT']
  if (!crudo) return null

  try {
    const json = JSON.parse(crudo)
    if (!json?.host || !json?.port) return null
    return {
      host: String(json.host),
      port: Number(json.port),
      ancho: Number(json.ancho ?? ANCHO_DEFECTO),
      abrirCajon: json.abrirCajon !== false,
    }
  } catch {
    return null
  }
}

/** Datos de encabezado del negocio desde config_param. */
export async function obtenerDatosNegocio(db: any): Promise<DatosNegocio> {
  const claves = ['FARMACIA_NOMBRE', 'FARMACIA_NIT', 'FARMACIA_DIRECCION', 'FARMACIA_TELEFONO']
  const params: any[] = await db.configParam.findMany({ where: { clave: { in: claves } } })
  const cfg: Record<string, string> = Object.fromEntries(params.map(p => [p.clave, p.valor]))
  return {
    nombre: cfg.FARMACIA_NOMBRE ?? 'FARMACY',
    nit: cfg.FARMACIA_NIT,
    direccion: cfg.FARMACIA_DIRECCION,
    telefono: cfg.FARMACIA_TELEFONO,
  }
}

// ── Transporte TCP (RAW 9100) ─────────────────────────────

/**
 * Envía bytes crudos a una impresora de red. Resuelve cuando el
 * buffer se entregó al sistema operativo; rechaza en error/timeout.
 */
export function enviarPorRed(host: string, port: number, datos: Buffer, timeoutMs = TIMEOUT_RED_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port })
    let terminado = false
    const fallar = (err: Error) => {
      if (terminado) return
      terminado = true
      socket.destroy()
      reject(err)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => {
      socket.write(datos, (err) => {
        if (err) return fallar(err)
        terminado = true
        socket.end()
        resolve()
      })
    })
    socket.once('timeout', () => fallar(new Error('La impresora no respondió a tiempo')))
    socket.once('error', (err) => fallar(err))
  })
}

// ── Armado de la tirilla ──────────────────────────────────

function separador(ancho: number): string {
  return '-'.repeat(ancho)
}

function fechaCorta(fecha: Date): string {
  const d = fecha.getDate().toString().padStart(2, '0')
  const m = (fecha.getMonth() + 1).toString().padStart(2, '0')
  const hh = fecha.getHours().toString().padStart(2, '0')
  const mm = fecha.getMinutes().toString().padStart(2, '0')
  return `${d}/${m}/${fecha.getFullYear()} ${hh}:${mm}`
}

/**
 * Construye los bytes ESC/POS de una tirilla de venta.
 * `venta` ya debe traer detalles + producto, cliente, empleado y caja.sucursal.
 */
export function construirTirillaEscPos(
  venta: any,
  negocio: DatosNegocio,
  opciones: OpcionesTirilla = {},
): Buffer {
  const ancho = opciones.ancho ?? ANCHO_DEFECTO
  const e = new EscPosBuilder()
  e.init()

  // ── Encabezado ──
  e.align('centro').bold(true).size(2, 2).linea(negocio.nombre.toUpperCase()).size(1, 1).bold(false)
  if (negocio.nit) e.linea(`NIT: ${negocio.nit}`)
  if (negocio.direccion) e.linea(negocio.direccion)
  if (negocio.telefono) e.linea(`Tel: ${negocio.telefono}`)
  const sucursal = venta?.caja?.sucursal
  if (sucursal?.nombre) {
    e.linea(`${sucursal.nombre}${sucursal.ciudad ? ' - ' + sucursal.ciudad : ''}`)
  }
  e.align('izq').linea(separador(ancho))

  // ── Datos del comprobante ──
  const fecha = venta?.creadoEn ? new Date(venta.creadoEn) : new Date()
  e.linea(`FECHA: ${fechaCorta(fecha)}`)
  e.linea(`TICKET: #F-${String(venta?.numero ?? 0).padStart(5, '0')}`)
  const cajero = venta?.empleado ? `${venta.empleado.nombre} ${venta.empleado.apellido}` : 'Sistema'
  e.linea(`CAJERO: ${cajero}`)
  if (venta?.cliente) {
    e.linea(`CLIENTE: ${venta.cliente.nombre} ${venta.cliente.apellido}`)
    if (venta.cliente.documento) e.linea(`${venta.cliente.tipoDoc ?? 'CC'}: ${venta.cliente.documento}`)
  } else {
    e.linea('CLIENTE: Consumidor Final')
  }
  e.linea(separador(ancho))

  // ── Ítems ──
  e.bold(true).linea(filaDosColumnas('CANT/DETALLE', 'TOTAL', ancho)).bold(false)
  const detalles: any[] = venta?.detalles ?? []
  for (const d of detalles) {
    const nombre = [d?.producto?.nombre, d?.producto?.concentracion].filter(Boolean).join(' ')
    for (const ln of envolverTexto(nombre, ancho)) e.linea(ln)
    const izquierda = `${d.cantidad} x ${formatearPesos(d.precioUnitario)}`
    const derecha = formatearPesos(d.subtotal ?? Number(d.precioUnitario) * Number(d.cantidad))
    e.linea(filaDosColumnas(izquierda, derecha, ancho))
    if (Number(d.descuento) > 0) {
      e.linea(filaDosColumnas('  (descuento)', `-${formatearPesos(d.descuento)}`, ancho))
    }
  }

  // ── Totales ──
  e.linea(separador(ancho))
  e.linea(filaEtiquetaValor('SUBTOTAL:', formatearPesos(venta?.subtotal ?? 0), ancho))
  if (Number(venta?.descuento) > 0) e.linea(filaEtiquetaValor('DESCUENTO:', `-${formatearPesos(venta.descuento)}`, ancho))
  if (Number(venta?.costoEnvio) > 0) e.linea(filaEtiquetaValor('ENVIO:', formatearPesos(venta.costoEnvio), ancho))
  e.bold(true).size(1, 2).linea(filaEtiquetaValor('TOTAL:', formatearPesos(venta?.total ?? 0), ancho)).size(1, 1).bold(false)
  e.linea(`PAGO: ${venta?.metodoPago ?? 'EFECTIVO'}`)

  // ── Pie ──
  e.align('centro').linea(separador(ancho))
  e.bold(true).linea('GRACIAS POR SU COMPRA').bold(false)
  e.linea(opciones.pie ?? 'Conserve este recibo para cualquier reclamo.')
  e.feed(3)
  e.cut(true)
  if (opciones.abrirCajon) e.abrirCajon(0)

  return e.build()
}

// ── Orquestación ──────────────────────────────────────────

/** Carga la venta con todo lo necesario para el ticket. */
export async function cargarVentaParaTicket(db: any, ventaId: string): Promise<any | null> {
  return db.venta.findUnique({
    where: { id: ventaId },
    include: {
      detalles: { include: { producto: { select: { nombre: true, concentracion: true, formaFarmaceutica: true } } } },
      cliente: { select: { nombre: true, apellido: true, tipoDoc: true, documento: true } },
      empleado: { select: { nombre: true, apellido: true } },
      caja: { include: { sucursal: { select: { nombre: true, ciudad: true, direccion: true, telefono: true } } } },
    },
  })
}

/**
 * Genera SOLO los bytes ESC/POS de la tirilla (sin imprimir).
 * Lo usa el endpoint de descarga/WebUSB del cliente.
 */
export async function generarTirillaEscPos(
  db: any,
  ventaId: string,
  opciones: { sucursalId?: number; ancho?: number; abrirCajon?: boolean } = {},
): Promise<{ buffer: Buffer; venta: any } | null> {
  const venta = await cargarVentaParaTicket(db, ventaId)
  if (!venta) return null
  const negocio = await obtenerDatosNegocio(db)
  const sucursalId = opciones.sucursalId ?? venta.caja?.sucursalId ?? venta.sucursalId
  const config = await obtenerConfigImpresora(db, sucursalId)
  const buffer = construirTirillaEscPos(venta, negocio, {
    ancho: opciones.ancho ?? config?.ancho ?? ANCHO_DEFECTO,
    abrirCajon: opciones.abrirCajon ?? false,
  })
  return { buffer, venta }
}

/**
 * Imprime una venta en la impresora configurada. Devuelve false si no hay
 * impresora configurada (el cliente puede caer a la impresión del navegador).
 */
export async function imprimirTirilla(
  db: any,
  ventaId: string,
  opciones: { sucursalId?: number; abrirCajon?: boolean } = {},
): Promise<{ impreso: boolean; motivo?: string; bytes?: number; host?: string }> {
  const venta = await cargarVentaParaTicket(db, ventaId)
  if (!venta) return { impreso: false, motivo: 'Venta no encontrada' }

  const sucursalId = opciones.sucursalId ?? venta.caja?.sucursalId ?? venta.sucursalId
  const config = await obtenerConfigImpresora(db, sucursalId)
  if (!config) return { impreso: false, motivo: 'Sin impresora configurada para la sucursal' }

  const negocio = await obtenerDatosNegocio(db)
  const quiereAbrirCajon = opciones.abrirCajon ?? config.abrirCajon
  const buffer = construirTirillaEscPos(venta, negocio, {
    ancho: config.ancho,
    abrirCajon: quiereAbrirCajon,
  })

  await enviarPorRed(config.host, config.port, buffer)
  return { impreso: true, bytes: buffer.length, host: config.host }
}
