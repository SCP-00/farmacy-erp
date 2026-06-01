// ══════════════════════════════════════════════════════════
//  fuzzySearch.test.ts — Tests de búsqueda difusa
// ══════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { fuzzyScore, fuzzyFilterProductos } from './fuzzySearch'

describe('fuzzyScore', () => {
  it('retorna 1.0 para match exacto', () => {
    expect(fuzzyScore('ibuprofeno', 'ibuprofeno')).toBe(1.0)
  })

  it('retorna 1.0 para match exacto case-insensitive', () => {
    expect(fuzzyScore('IBUPROFENO', 'ibuprofeno')).toBe(1.0)
  })

  it('retorna > 0 para substring al inicio', () => {
    const score = fuzzyScore('ibup', 'ibuprofeno')
    expect(score).toBeGreaterThan(0.5)
  })

  it('retorna > 0 para abreviatura que matchea secuencialmente', () => {
    const score = fuzzyScore('acetam', 'acetaminofén')
    expect(score).toBeGreaterThan(0.5)
  })

  it('retorna 0 para string vacío', () => {
    expect(fuzzyScore('', 'ibuprofeno')).toBe(0)
  })

  it('retorna 0 para target vacío', () => {
    expect(fuzzyScore('ibup', '')).toBe(0)
  })

  it('retorna 0 si no hay match', () => {
    expect(fuzzyScore('xyz', 'ibuprofeno')).toBe(0)
  })

  it('es case-insensitive', () => {
    const score1 = fuzzyScore('Acetam', 'acetaminofén')
    const score2 = fuzzyScore('acetam', 'acetaminofén')
    expect(score1).toBe(score2)
  })

  it('valora matches consecutivos más alto', () => {
    const consecutive = fuzzyScore('ibu', 'ibuprofeno')  // i-b-u consecutivos
    const scattered = fuzzyScore('ino', 'ibuprofeno')     // i-no dispersos
    expect(consecutive).toBeGreaterThan(scattered)
  })
})

describe('fuzzyFilterProductos', () => {
  const productos = [
    { id: '1', nombre: 'Ibuprofeno 400mg', concentracion: '400mg', presentacion: 'Tabletas', codigoBarras: '7701234567890' },
    { id: '2', nombre: 'Acetaminofén 500mg', concentracion: '500mg', presentacion: 'Cápsulas', codigoBarras: '7709876543210' },
    { id: '3', nombre: 'Paracetamol 200mg', concentracion: '200mg', presentacion: 'Suspensión oral', codigoBarras: '7705555555555' },
    { id: '4', nombre: 'Omeprazol 20mg', concentracion: '20mg', presentacion: 'Cápsulas', codigoBarras: '7706666666666' },
  ]

  it('retorna array vacío para query vacío', () => {
    expect(fuzzyFilterProductos(productos, '')).toEqual([])
  })

  it('retorna array vacío para query con solo espacios', () => {
    expect(fuzzyFilterProductos(productos, '   ')).toEqual([])
  })

  it('encuentra producto por nombre', () => {
    const results = fuzzyFilterProductos(productos, 'ibuprofeno')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].producto.nombre).toBe('Ibuprofeno 400mg')
  })

  it('encuentra producto por concentración', () => {
    const results = fuzzyFilterProductos(productos, '400')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].producto.id).toBe('1')
  })

  it('encuentra producto por código de barras', () => {
    const results = fuzzyFilterProductos(productos, '770123')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].producto.id).toBe('1')
  })

  it('ordena por relevancia (score descendente)', () => {
    const results = fuzzyFilterProductos(productos, 'paracetamol')
    expect(results.length).toBeGreaterThanOrEqual(1)
    // El primer resultado debe ser Paracetamol (match exacto)
    expect(results[0].producto.nombre).toContain('Paracetamol')
  })

  it('respeta el threshold por defecto (0.4)', () => {
    const results = fuzzyFilterProductos(productos, 'zzzzz')
    expect(results).toEqual([])
  })

  it('respeta un threshold personalizado', () => {
    // Con threshold bajo, debería encontrar más resultados
    const resultsLow = fuzzyFilterProductos(productos, 'par', 0.2)
    const resultsHigh = fuzzyFilterProductos(productos, 'par', 0.8)
    expect(resultsLow.length).toBeGreaterThanOrEqual(resultsHigh.length)
  })

  it('retorna score en cada resultado', () => {
    const results = fuzzyFilterProductos(productos, 'ibu')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toHaveProperty('score')
    expect(results[0].score).toBeGreaterThan(0)
    expect(results[0].score).toBeLessThanOrEqual(1)
  })
})
