import { describe, it, expect, vi, afterEach } from 'vitest'
import net from 'net'
import {
  construirTirillaEscPos,
  enviarPorRed,
  obtenerConfigImpresora,
  obtenerDatosNegocio,
} from '../services/impresion.service'
import { ESCPOS } from '../utils/escpos.utils'

const VENTA = {
  numero: 118,
  creadoEn: new Date('2026-10-01T14:30:00'),
  metodoPago: 'EFECTIVO',
  subtotal: 10000,
  descuento: 500,
  costoEnvio: 0,
  total: 9500,
  empleado: { nombre: 'Ana', apellido: 'Ruiz' },
  cliente: { nombre: 'Juan', apellido: 'Pérez', tipoDoc: 'CC', documento: '12345' },
  caja: { sucursal: { nombre: 'Sede Centro', ciudad: 'Pereira' } },
  detalles: [
    { cantidad: 2, precioUnitario: 5000, subtotal: 10000, descuento: 500, producto: { nombre: 'Acetaminofén', concentracion: '500mg' } },
  ],
}

const NEGOCIO = { nombre: 'Farmacia Central', nit: '900.123.456-7', direccion: 'Calle 1 #2-3', telefono: '606 335 0000' }

function contiene(buf: Buffer, texto: string): boolean {
  return buf.includes(Buffer.from(texto, 'latin1'))
}

describe('construirTirillaEscPos', () => {
  it('incluye encabezado, datos, ítems y total', () => {
    const buf = construirTirillaEscPos(VENTA, NEGOCIO)
    expect(contiene(buf, 'FARMACIA CENTRAL')).toBe(true)
    expect(contiene(buf, 'NIT: 900.123.456-7')).toBe(true)
    expect(contiene(buf, 'TICKET: #F-00118')).toBe(true)
    expect(contiene(buf, 'Acetaminofén')).toBe(true)
    expect(contiene(buf, 'TOTAL:')).toBe(true)
    expect(contiene(buf, '$9.500')).toBe(true)
    expect(contiene(buf, 'EFECTIVO')).toBe(true)
  })

  it('arranca con INIT y termina con corte; el cajón solo si se pide', () => {
    const sinCajon = construirTirillaEscPos(VENTA, NEGOCIO, { abrirCajon: false })
    expect([...sinCajon.subarray(0, 2)]).toEqual(ESCPOS.INIT)
    expect([...sinCajon].join(',')).toContain(ESCPOS.CUT_PARCIAL.join(','))
    expect([...sinCajon].join(',')).not.toContain(ESCPOS.ABRIR_CAJON.join(','))

    const conCajon = construirTirillaEscPos(VENTA, NEGOCIO, { abrirCajon: true })
    expect([...conCajon].join(',')).toContain(ESCPOS.ABRIR_CAJON.join(','))
  })

  it('respeta el ancho configurado sin desbordar líneas', () => {
    const buf = construirTirillaEscPos(VENTA, NEGOCIO, { ancho: 32 })
    const texto = buf.toString('latin1')
    const lineas = texto.split('\n')
    // El separador refleja el ancho pedido
    expect(lineas.some(l => l === '-'.repeat(32))).toBe(true)
    expect(lineas.some(l => l === '-'.repeat(48))).toBe(false)
  })

  it('no falla sin cliente ni detalles', () => {
    const buf = construirTirillaEscPos({ numero: 1, total: 0 }, NEGOCIO)
    expect(contiene(buf, 'Consumidor Final')).toBe(true)
    expect(contiene(buf, 'TOTAL:')).toBe(true)
  })
})

describe('obtenerConfigImpresora', () => {
  it('lee la config de la sucursal', async () => {
    const db = { configParam: { findMany: vi.fn().mockResolvedValue([
      { clave: 'IMPRESORA_SUCURSAL_1', valor: JSON.stringify({ host: '192.168.1.50', port: 9100 }) },
    ]) } }
    const cfg = await obtenerConfigImpresora(db, 1)
    expect(cfg).toEqual({ host: '192.168.1.50', port: 9100, ancho: 48, abrirCajon: true })
  })

  it('usa la config de respaldo si la sede no tiene', async () => {
    const db = { configParam: { findMany: vi.fn().mockResolvedValue([
      { clave: 'IMPRESORA_DEFAULT', valor: JSON.stringify({ host: '10.0.0.9', port: 9100, ancho: 42 }) },
    ]) } }
    const cfg = await obtenerConfigImpresora(db, 2)
    expect(cfg?.host).toBe('10.0.0.9')
    expect(cfg?.ancho).toBe(42)
  })

  it('devuelve null si no hay config o si el JSON es inválido', async () => {
    const sinConfig = { configParam: { findMany: vi.fn().mockResolvedValue([]) } }
    expect(await obtenerConfigImpresora(sinConfig, 1)).toBeNull()

    const malo = { configParam: { findMany: vi.fn().mockResolvedValue([{ clave: 'IMPRESORA_DEFAULT', valor: 'no-json' }]) } }
    expect(await obtenerConfigImpresora(malo, 1)).toBeNull()
  })
})

describe('obtenerDatosNegocio', () => {
  it('usa los parámetros de la farmacia y cae al valor por defecto', async () => {
    const db = { configParam: { findMany: vi.fn().mockResolvedValue([
      { clave: 'FARMACIA_NOMBRE', valor: 'Farmacia X' },
      { clave: 'FARMACIA_TELEFONO', valor: '606' },
    ]) } }
    const datos = await obtenerDatosNegocio(db)
    expect(datos.nombre).toBe('Farmacia X')
    expect(datos.telefono).toBe('606')
    expect(datos.nit).toBeUndefined()
  })
})

describe('enviarPorRed (TCP real)', () => {
  const servidores: net.Server[] = []

  afterEach(() => {
    for (const s of servidores) s.close()
    servidores.length = 0
  })

  /** Levanta un servidor TCP local que captura los bytes recibidos. */
  function servidorCaptura(): Promise<{ port: number; recibido: Promise<Buffer> }> {
    return new Promise((resolve) => {
      let resolverDatos: (b: Buffer) => void
      const recibido = new Promise<Buffer>((r) => { resolverDatos = r })
      const server = net.createServer((socket) => {
        const partes: Buffer[] = []
        socket.on('data', (d) => partes.push(d))
        socket.on('end', () => resolverDatos(Buffer.concat(partes)))
      })
      servidores.push(server)
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as net.AddressInfo).port
        resolve({ port, recibido })
      })
    })
  }

  it('entrega los bytes ESC/POS a la impresora', async () => {
    const { port, recibido } = await servidorCaptura()
    const datos = construirTirillaEscPos(VENTA, NEGOCIO, { abrirCajon: true })

    await enviarPorRed('127.0.0.1', port, datos)

    const capturado = await recibido
    expect(capturado.equals(datos)).toBe(true)
  })

  it('rechaza si la impresora no está disponible', async () => {
    await expect(enviarPorRed('127.0.0.1', 1, Buffer.from('x'), 500)).rejects.toThrow()
  })
})
