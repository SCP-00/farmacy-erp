// ══════════════════════════════════════════════════════════
//  SERVICIO: serving del frontend compilado (SPA)
//
//  En producción con Nginx el static lo sirve el proxy, pero en el
//  escenario real —una farmacia con un servidor Windows en LAN—
//  no hay Nginx delante: el mismo proceso de Node debe atender la
//  API y la SPA, o el cliente de escritorio (Electron, que apunta a
//  http://localhost:3000) abre un JSON 404 en vez de la aplicación.
//
//  Se activa solo con FRONTEND_DIST_PATH apuntando a frontend/dist.
//  Con la variable vacía el comportamiento no cambia: la API sigue
//  respondiendo JSON y el 404 final se queda igual.
// ══════════════════════════════════════════════════════════
import { Request, Response, NextFunction } from 'express'
import express from 'express'
import { existsSync } from 'fs'
import path from 'path'

export function staticFrontendMiddleware(distPathConfigurado: string) {
  const distPath = path.resolve(distPathConfigurado)
  const indexHtml = path.join(distPath, 'index.html')

  // Los assets de /assets llevan hash en el nombre (index-abc123.js):
  // si cambian, cambia el nombre, así que son inmutables. El resto
  // (index.html, sw.js, manifest) debe revalidarse en cada carga para
  // que una actualización se vea sin reinstalar nada.
  const servirArchivos = express.static(distPath, {
    index: false,
    setHeaders(res, filePath) {
      const esAssetVersionado = filePath.includes(`${path.sep}assets${path.sep}`)
      res.setHeader(
        'Cache-Control',
        esAssetVersionado ? 'public, max-age=31536000, immutable' : 'no-cache'
      )
    },
  })

  return function servirFrontend(req: Request, res: Response, next: NextFunction) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (!existsSync(indexHtml)) return next()

    // La API siempre responde JSON. Un index.html aquí convertiría un
    // 404 de API en un "200 con HTML" y escondería errores reales.
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next()

    const esNavegacion = (req.headers.accept || '').includes('text/html')

    // Rutas del router del cliente (p. ej. /admin/ventas, /carrito):
    // sin extensión → devolver index.html para que el router resuelva.
    if (esNavegacion && !path.extname(req.path)) {
      return res.sendFile(indexHtml)
    }

    return servirArchivos(req, res, next)
  }
}
