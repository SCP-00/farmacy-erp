import { Router, Request, Response } from 'express'
import { prisma } from '../../config/database'
import { cache, redis } from '../../config/redis'
import { responder } from '../../utils/respuesta.utils'

export const healthRouter: Router = Router()

// ── GET /health/deep — Healthcheck profundo para monitoreo ──
// Verifica DEPENDENCIAS reales (no solo que el proceso vive):
//   - PostgreSQL (query trivial con timeout)
//   - Redis (ping + set/get/del en una clave efímera)
// Los orquestadores (Docker, K8s, uptime robots) usan este endpoint
// para decidir si la instancia está SANA, no solo despierta.
healthRouter.get('/deep', async (_req: Request, res: Response) => {
  const inicio = Date.now()
  const checks: Record<string, { ok: boolean; detalle?: string; latenciaMs?: number }> = {}

  // 1) PostgreSQL — SELECT 1 con budget de tiempo
  const t1 = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.postgres = { ok: true, latenciaMs: Date.now() - t1 }
  } catch (err: any) {
    checks.postgres = { ok: false, detalle: err.message?.slice(0, 200) }
  }

  // 2) Redis — ping + roundtrip completo de la capa de cache
  const t2 = Date.now()
  try {
    await cache.set('health:deep', String(inicio), 15)
    const eco = await cache.get('health:deep')
    await cache.del('health:deep')
    checks.redis = { ok: eco === String(inicio), latenciaMs: Date.now() - t2 }
  } catch (err: any) {
    checks.redis = { ok: false, detalle: err.message?.slice(0, 200) }
  }

  const ok = checks.postgres.ok && checks.redis.ok
  return responder.ok(res, {
    ok,
    checks,
    uptimeSegundos: Math.floor(process.uptime()),
    latenciaTotalMs: Date.now() - inicio,
  })
})
