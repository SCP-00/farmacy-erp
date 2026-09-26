import { describe, it, expect } from 'vitest'
import { escaparLike, qLike, unacentuar, exprNormalizada } from '../utils/texto.utils'

describe('texto.utils — normalización para búsqueda (migración 0005)', () => {
  it('unacentuar elimina diacríticos preservando mayúsculas/minúsculas', () => {
    expect(unacentuar('Acetaminofén')).toBe('Acetaminofen')
    expect(unacentuar('Ibuprofeno Único')).toBe('Ibuprofeno Unico')
    expect(unacentuar('ácido fólico ñoño')).toBe('acido folico nono')
    expect(unacentuar('CAFÉ CON MUÇHÒ')).toBe('CAFE CON MUCHO')
    expect(unacentuar('sin acentos')).toBe('sin acentos')
  })

  it('escaparLike neutraliza comodines de ILIKE/LIKE', () => {
    expect(escaparLike('50%')).toBe('50\\%')
    expect(escaparLike('a_b')).toBe('a\\_b')
    expect(escaparLike('a\\b')).toBe('a\\\\b')
    expect(escaparLike('normal')).toBe('normal')
  })

  it('qLike normaliza el término y lo envuelve en %...%', () => {
    expect(qLike('Acetaminofén')).toBe('%acetaminofen%')
    expect(qLike('  IBUPROFENO  ')).toBe('%ibuprofeno%')
    expect(qLike('100% natural')).toBe('%100\\% natural%')
  })

  it('exprNormalizada genera SQL unaccent(lower(col)) seguro', () => {
    expect(exprNormalizada('p.principio_activo')).toBe('unaccent(lower(p.principio_activo))')
    // Rechaza identificadores con comillas (evita inyección por nombre de columna)
    expect(() => exprNormalizada('nombre") LIKE %x% --')).toThrow()
  })
})
