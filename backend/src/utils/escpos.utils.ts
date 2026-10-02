// ══════════════════════════════════════════════════════════
//  ESC/POS — Generación de comandos para impresoras térmicas
//
//  Sin dependencias: construye el Buffer de bytes que entiende una
//  impresora térmica estándar (Epson TM-T20/T88, Genéricas 80mm).
//  Codificación CP1252 (latin1) para acentos del español.
//
//  Referencia de comandos:
//   - ESC @        inicializar
//   - ESC t n      seleccionar página de códigos (16 = WPC1252)
//   - ESC a n      alineación (0 izq, 1 centro, 2 der)
//   - ESC E n      negrita
//   - GS ! n       tamaño de carácter (nibble alto = ancho, bajo = alto)
//   - ESC d n      avanzar n líneas
//   - GS V 66 0    corte parcial con avance
//   - ESC p m t1 t2 pulso al cajón de dinero (m=pin)
// ══════════════════════════════════════════════════════════

const CP1252 = 'latin1' as const

/** Página de códigos WPC1252 en la mayoría de impresoras Epson-compatibles. */
export const CODEPAGE_WPC1252 = 16

// ── Utilidades de texto ───────────────────────────────────

/** Formatea pesos colombianos de forma determinista: $1.234.567 */
export function formatearPesos(valor: number | string): string {
  const n = Math.round(Number(valor) || 0)
  const signo = n < 0 ? '-' : ''
  return signo + '$' + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Parte un texto en líneas de a lo sumo `ancho` caracteres (por palabras). */
export function envolverTexto(texto: string, ancho: number): string[] {
  const palabras = String(texto ?? '').trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return ['']
  const lineas: string[] = []
  let actual = ''
  for (const palabra of palabras) {
    if (actual.length === 0) {
      actual = palabra
    } else if (actual.length + 1 + palabra.length <= ancho) {
      actual += ' ' + palabra
    } else {
      lineas.push(actual)
      actual = palabra
    }
    // Palabra más larga que el ancho: cortarla
    while (actual.length > ancho) {
      lineas.push(actual.slice(0, ancho))
      actual = actual.slice(ancho)
    }
  }
  if (actual.length > 0) lineas.push(actual)
  return lineas
}

/** Arma una fila "etiqueta ....... valor" que ocupa todo el ancho. */
export function filaEtiquetaValor(etiqueta: string, valor: string, ancho = 48): string {
  const espacio = ancho - etiqueta.length - valor.length
  if (espacio >= 1) return etiqueta + ' '.repeat(espacio) + valor
  return `${etiqueta}\n${valor.padStart(ancho)}`
}

/** Arma una fila "izquierda ..... derecha" que ocupa todo el ancho. */
export function filaDosColumnas(izquierda: string, derecha: string, ancho = 48): string {
  return filaEtiquetaValor(izquierda, derecha, ancho)
}

// ── Constructor de comandos ───────────────────────────────

export class EscPosBuilder {
  private partes: Buffer[] = []

  private bytes(...b: number[]): this {
    this.partes.push(Buffer.from(b))
    return this
  }

  /** Añade bytes crudos (por ejemplo, una imagen ya rasterizada). */
  raw(datos: Buffer | Uint8Array): this {
    this.partes.push(Buffer.from(datos))
    return this
  }

  /** Texto codificado en CP1252. */
  texto(t: string): this {
    this.partes.push(Buffer.from(String(t ?? ''), CP1252))
    return this
  }

  /** Texto + salto de línea. */
  linea(t = ''): this {
    return this.texto(t + '\n')
  }

  /** Inicializa e imprime en WPC1252 (acentos correctos). */
  init(): this {
    return this.bytes(0x1b, 0x40).codepage(CODEPAGE_WPC1252)
  }

  codepage(n: number = CODEPAGE_WPC1252): this {
    return this.bytes(0x1b, 0x74, n & 0xff)
  }

  align(a: 'izq' | 'centro' | 'der'): this {
    const n = a === 'centro' ? 1 : a === 'der' ? 2 : 0
    return this.bytes(0x1b, 0x61, n)
  }

  bold(on: boolean): this {
    return this.bytes(0x1b, 0x45, on ? 1 : 0)
  }

  /** Tamaño de carácter: 1 = normal, 2 = doble. */
  size(ancho: 1 | 2 = 1, alto: 1 | 2 = 1): this {
    const n = (((ancho - 1) & 0x07) << 4) | ((alto - 1) & 0x07)
    return this.bytes(0x1d, 0x21, n)
  }

  /** Avanza n líneas de papel. */
  feed(n = 1): this {
    return this.bytes(0x1b, 0x64, Math.max(0, Math.min(255, n)) & 0xff)
  }

  /** Corte de papel. parcial = true corta dejando un trozo unido. */
  cut(parcial = true): this {
    return parcial ? this.bytes(0x1d, 0x56, 0x42, 0x00) : this.bytes(0x1d, 0x56, 0x00)
  }

  /** Pulso para abrir el cajón de dinero (pin 0 = conector 2). */
  abrirCajon(pin: 0 | 1 = 0): this {
    // t1 = 0x19 (50 ms), t2 = 0xFA (500 ms)
    return this.bytes(0x1b, 0x70, pin, 0x19, 0xfa)
  }

  /** Comando de corte sin alimentar (para pruebas). */
  build(): Buffer {
    return Buffer.concat(this.partes)
  }
}

// ── Firmas de bytes reutilizables (para tests) ────────────
export const ESCPOS = {
  INIT: [0x1b, 0x40],
  CUT_PARCIAL: [0x1d, 0x56, 0x42, 0x00],
  ABRIR_CAJON: [0x1b, 0x70, 0x00, 0x19, 0xfa],
  NEGRITA_ON: [0x1b, 0x45, 0x01],
} as const
