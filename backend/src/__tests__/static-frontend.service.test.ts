// ══════════════════════════════════════════════════════════
//  Tests del middleware que sirve la SPA compilada
// ══════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { staticFrontendMiddleware } from '../services/staticFrontend.service'

let distDir: string
let app: express.Express

beforeAll(() => {
  distDir = mkdtempSync(path.join(tmpdir(), 'farmacy-dist-'))
  mkdirSync(path.join(distDir, 'assets'), { recursive: true })
  writeFileSync(
    path.join(distDir, 'index.html'),
    '<!doctype html><html><body><div id="root">FARMACY</div></body></html>'
  )
  writeFileSync(path.join(distDir, 'assets', 'index-abc123.js'), 'console.log(1)')
  writeFileSync(path.join(distDir, 'sw.js'), '/* service worker */')

  app = express()
  app.use(staticFrontendMiddleware(distDir))
  // Rutas de API después, como en app.ts
  app.get('/api/v1/productos', (_req, res) => res.json({ ok: true, data: [] }))
  app.use((_req, res) => res.status(404).json({ ok: false, error: 'Ruta no encontrada' }))
})

afterAll(() => {
  rmSync(distDir, { recursive: true, force: true })
})

describe('staticFrontendMiddleware', () => {
  it('sirve index.html en la raíz para el navegador', async () => {
    const res = await request(app).get('/').set('Accept', 'text/html')
    expect(res.status).toBe(200)
    expect(res.text).toContain('FARMACY')
    expect(res.headers['content-type']).toContain('text/html')
  })

  it('devuelve index.html en rutas del router (p. ej. /admin/ventas)', async () => {
    const res = await request(app).get('/admin/caja').set('Accept', 'text/html')
    expect(res.status).toBe(200)
    expect(res.text).toContain('FARMACY')
  })

  it('sirve los assets versionados con caché inmutable', async () => {
    const res = await request(app).get('/assets/index-abc123.js')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toContain('immutable')
  })

  it('sirve el service worker sin caché para permitir actualizaciones', async () => {
    const res = await request(app).get('/sw.js')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toContain('no-cache')
  })

  it('NUNCA devuelve HTML en rutas de API: la API responde JSON', async () => {
    const res = await request(app).get('/api/v1/productos').set('Accept', 'text/html')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.text).not.toContain('FARMACY')
  })

  it('una ruta de API inexistente sigue dando 404 JSON, no el index', async () => {
    const res = await request(app).get('/api/v1/no-existe').set('Accept', 'text/html')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.text).not.toContain('FARMACY')
  })

  it('noCachea assets inexistentes con extensión (404 real, no HTML)', async () => {
    const res = await request(app).get('/assets/no-existe.js')
    expect(res.status).toBe(404)
    expect(res.text).not.toContain('FARMACY')
  })

  it('deja pasar los métodos de escritura sin servirlos', async () => {
    const res = await request(app).post('/').set('Accept', 'text/html').send({})
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toContain('application/json')
  })

  it('si el dist no existe, no rompe y deja pasar la petición', async () => {
    const appSinDist = express()
    appSinDist.use(staticFrontendMiddleware(path.join(distDir, 'no-existe')))
    appSinDist.get('/api/v1/x', (_req, res) => res.json({ ok: true }))

    const resApi = await request(appSinDist).get('/api/v1/x')
    expect(resApi.status).toBe(200)
    expect(resApi.body.ok).toBe(true)

    const resRaiz = await request(appSinDist).get('/').set('Accept', 'text/html')
    expect(resRaiz.status).toBe(404)
  })
})
