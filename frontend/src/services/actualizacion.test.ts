import { describe, it, expect } from 'vitest'
import { compararVersiones, interpretarRelease } from './actualizacion'

describe('compararVersiones', () => {
  it('detecta una versión mayor', () => {
    expect(compararVersiones('1.2.0', '1.1.9')).toBeGreaterThan(0)
    expect(compararVersiones('2.0.0', '1.99.99')).toBeGreaterThan(0)
  })

  it('detecta versiones iguales y menores', () => {
    expect(compararVersiones('1.0.0', '1.0.0')).toBe(0)
    expect(compararVersiones('1.0.0', '1.0.1')).toBeLessThan(0)
  })

  it('ignora el prefijo v y el sufijo de pre-release', () => {
    expect(compararVersiones('v1.2.0', '1.1.0')).toBeGreaterThan(0)
    expect(compararVersiones('1.2.0-beta.1', '1.2.0')).toBe(0)
  })

  it('tolera números de distinta longitud', () => {
    expect(compararVersiones('1.1', '1.0.9')).toBeGreaterThan(0)
    expect(compararVersiones('1', '1.0.0')).toBe(0)
  })
})

describe('interpretarRelease', () => {
  it('lee una release de GitHub', () => {
    const info = interpretarRelease({ tag_name: 'v1.1.0', html_url: 'https://x/release', body: 'novedades' })
    expect(info).toEqual({ version: '1.1.0', url: 'https://x/release', notas: 'novedades' })
  })

  it('acepta un manifiesto con solo version', () => {
    const info = interpretarRelease({ version: '1.1.0', url: 'https://x/app.exe' })
    expect(info?.version).toBe('1.1.0')
    expect(info?.url).toBe('https://x/app.exe')
  })

  it('devuelve null si no hay versión', () => {
    expect(interpretarRelease({})).toBeNull()
    expect(interpretarRelease(null)).toBeNull()
  })

  it('recorta notas muy largas', () => {
    const info = interpretarRelease({ tag_name: 'v2.0.0', body: 'x'.repeat(2000) })
    expect(info!.notas!.length).toBeLessThanOrEqual(600)
  })
})
