import { describe, it, expect } from 'vitest'
import { evaluarRespaldo } from '../utils/respaldo.utils'

const AHORA = new Date('2026-10-02T12:00:00Z')

function haceHoras(h: number): string {
  return new Date(AHORA.getTime() - h * 3_600_000).toISOString()
}

describe('evaluarRespaldo', () => {
  it('marca vencido cuando no hay registro', () => {
    const e = evaluarRespaldo(null, 26, AHORA)
    expect(e.ok).toBe(false)
    expect(e.vencido).toBe(true)
    expect(e.motivo).toContain('Sin registro')
  })

  it('considera vigente un respaldo reciente y correcto', () => {
    const e = evaluarRespaldo(JSON.stringify({ ok: true, fecha: haceHoras(2) }), 26, AHORA)
    expect(e.ok).toBe(true)
    expect(e.vencido).toBe(false)
    expect(e.horasDesde).toBe(2)
    expect(e.motivo).toBeUndefined()
  })

  it('marca vencido un respaldo más viejo que el límite', () => {
    const e = evaluarRespaldo(JSON.stringify({ ok: true, fecha: haceHoras(30) }), 26, AHORA)
    expect(e.vencido).toBe(true)
    expect(e.motivo).toContain('30 h')
  })

  it('marca vencido si la última verificación FALLÓ', () => {
    const e = evaluarRespaldo(JSON.stringify({ ok: false, fecha: haceHoras(1) }), 26, AHORA)
    expect(e.ok).toBe(false)
    expect(e.vencido).toBe(true)
    expect(e.motivo).toContain('FALLÓ')
  })

  it('marca vencido ante JSON ilegible o fecha inválida', () => {
    expect(evaluarRespaldo('no-json', 26, AHORA).vencido).toBe(true)
    expect(evaluarRespaldo(JSON.stringify({ ok: true, fecha: 'ayer' }), 26, AHORA).motivo).toContain('fecha válida')
  })

  it('respeta un límite personalizado', () => {
    const json = JSON.stringify({ ok: true, fecha: haceHoras(5) })
    expect(evaluarRespaldo(json, 4, AHORA).vencido).toBe(true)
    expect(evaluarRespaldo(json, 6, AHORA).vencido).toBe(false)
  })

  it('usa 26 h por defecto si el límite es inválido', () => {
    const json = JSON.stringify({ ok: true, fecha: haceHoras(10) })
    expect(evaluarRespaldo(json, NaN, AHORA).vencido).toBe(false)
    expect(evaluarRespaldo(json, -5, AHORA).vencido).toBe(false)
  })
})
