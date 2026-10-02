import { describe, it, expect } from 'vitest'
import {
  EscPosBuilder,
  ESCPOS,
  formatearPesos,
  envolverTexto,
  filaEtiquetaValor,
  filaDosColumnas,
} from '../utils/escpos.utils'

describe('formatearPesos', () => {
  it('agrupa miles con punto', () => {
    expect(formatearPesos(1234567)).toBe('$1.234.567')
    expect(formatearPesos(0)).toBe('$0')
    expect(formatearPesos(500)).toBe('$500')
  })

  it('maneja negativos y strings', () => {
    expect(formatearPesos(-50000)).toBe('-$50.000')
    expect(formatearPesos('9500')).toBe('$9.500')
    expect(formatearPesos(NaN as unknown as number)).toBe('$0')
  })
})

describe('envolverTexto', () => {
  it('parte por palabras respetando el ancho', () => {
    const lineas = envolverTexto('Acetaminofén 500 mg Genfar caja por 30 tabletas', 20)
    expect(lineas.every(l => l.length <= 20)).toBe(true)
    expect(lineas.join(' ')).toBe('Acetaminofén 500 mg Genfar caja por 30 tabletas')
  })

  it('corta palabras más largas que el ancho', () => {
    const lineas = envolverTexto('supercalifragilisticoespialidoso', 10)
    expect(lineas.every(l => l.length <= 10)).toBe(true)
    expect(lineas.join('')).toBe('supercalifragilisticoespialidoso')
  })

  it('devuelve una línea vacía para texto vacío', () => {
    expect(envolverTexto('', 20)).toEqual([''])
  })
})

describe('filas de ancho fijo', () => {
  it('filaEtiquetaValor ocupa todo el ancho', () => {
    const fila = filaEtiquetaValor('TOTAL:', '$9.500', 20)
    expect(fila).toBe('TOTAL:' + ' '.repeat(20 - 6 - 6) + '$9.500')
    expect(fila.length).toBe(20)
  })

  it('filaDosColumnas alinea a la derecha', () => {
    const fila = filaDosColumnas('2 x $5.000', '$10.000', 24)
    expect(fila.length).toBe(24)
    expect(fila.endsWith('$10.000')).toBe(true)
  })
})

describe('EscPosBuilder', () => {
  it('empieza con INIT (ESC @) y selecciona la página WPC1252', () => {
    const buf = new EscPosBuilder().init().build()
    expect([...buf.subarray(0, 2)]).toEqual(ESCPOS.INIT)
    // ESC t 16
    expect([...buf.subarray(2, 5)]).toEqual([0x1b, 0x74, 16])
  })

  it('emite el comando de corte y el pulso del cajón', () => {
    const buf = new EscPosBuilder().init().cut(true).abrirCajon(0).build()
    const bytes = [...buf]
    // El corte y el pulso están presentes en el buffer
    expect(bytes).toContain(0x1d)
    expect(bytes.join(',')).toContain(ESCPOS.CUT_PARCIAL.join(','))
    expect(bytes.join(',')).toContain(ESCPOS.ABRIR_CAJON.join(','))
  })

  it('codifica acentos en CP1252 (latin1), no en UTF-8', () => {
    const buf = new EscPosBuilder().texto('Acetaminofén').build()
    expect(buf.includes(Buffer.from('Acetaminofén', 'latin1'))).toBe(true)
    expect(buf.includes(Buffer.from([0xe9]))).toBe(true)  // é en latin1 = 0xE9
    expect(buf.includes(Buffer.from([0xc3]))).toBe(false) // no debe aparecer el prefijo UTF-8
  })

  it('cambia de tamaño con GS !', () => {
    const normal = new EscPosBuilder().size(1, 1).build()
    const doble = new EscPosBuilder().size(2, 2).build()
    expect([...normal]).toEqual([0x1d, 0x21, 0x00])
    expect([...doble]).toEqual([0x1d, 0x21, 0x11])
  })
})
