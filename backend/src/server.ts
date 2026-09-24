// ══════════════════════════════════════════════════════════
//  server.ts — Punto de entrada del backend
//  Conecta BD ANTES de aceptar peticiones HTTP
// ══════════════════════════════════════════════════════════
import { createApp } from './app'
import { env } from './config/env'
import { connectDB, disconnectDB } from './config/database'
import { connectRedis } from './config/redis'
import { iniciarJobAlertas } from './jobs/alertas'
import { iniciarJobsFidelidad } from './jobs/fidelidad'
import { sseManager } from './services/sse.service'
import { wsManager } from './services/websocket.service'
import { iniciarWorkers, detenerWorkers } from './jobs/queue'
import { initVapid, enviarAlertaInventario } from './services/push.service'
import { eventBus, Eventos } from './services/eventbus.service'
import { logger } from './utils/logger'
import { initSentry } from './config/sentry'

async function main() {
  // 0. Inicializar Sentry (error tracking)
  initSentry()

  // 1. Verificar conexión a PostgreSQL
  await connectDB()

  // 2. Conectar Redis (fallo no bloqueante)
  await connectRedis()

  // 2b. Inicializar VAPID push notifications
  initVapid()

  // 3. Crear Express con todos los middlewares y rutas
  const app = createApp()

  // 4. Inicializar SSE (distribuye eventos del EventBus a clientes SSE)
  sseManager.init()

  // 5. Programar job de alertas de inventario (FEFO) + jobs de fidelidad
  iniciarJobAlertas()
  iniciarJobsFidelidad()

  // 6. Levantar servidor HTTP (primero, para pasar el server a WS)
  const server = app.listen(Number(env.PORT), () => {
    console.log(`\n🚀 FARMACY backend → http://localhost:${env.PORT}${env.API_PREFIX}`)
    console.log(`   Entorno  : ${env.NODE_ENV}`)
    console.log(`   Farmacia : ${env.FARMACIA_NOMBRE}\n`)

    // 7. Inicializar WebSocket sobre el mismo server HTTP
    wsManager.init(server)

    // 8. Iniciar workers BullMQ
    iniciarWorkers()

    console.log(`   🌐 SSE : /reportes/stream`)
    console.log(`   🔌 WS  : /ws`)
    console.log(`   📨 Queue: csv-export, emails`)
    console.log(`   🔔 Push: ${env.VAPID_PUBLIC_KEY ? 'activado' : 'no configurado'}\n`)
  })

  // 9. Wire EventBus → Push notifications (alertas de inventario)
  eventBus.on(Eventos.STOCK_CRITICO, async (payload) => {
    if (!payload?.data?.mensaje) return
    logger.warn(`[Push] Stock crítico detectado: ${JSON.stringify(payload.data)}`)
    await enviarAlertaInventario(
      'STOCK_CRITICO',
      String(payload.data.mensaje),
      payload.data.producto ? String(payload.data.producto) : undefined,
    )
  })

  eventBus.on(Eventos.INVENTARIO_ALERTA, async (payload) => {
    if (!payload?.data?.mensaje) return
    await enviarAlertaInventario(
      'INVENTARIO',
      String(payload.data.mensaje),
      payload.data.producto ? String(payload.data.producto) : undefined,
    )
  })

  // 10. Cierre limpio (Ctrl+C, Docker stop)
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Cerrando servidor...`)
    wsManager.destroy()
    sseManager.destroy()
    await detenerWorkers()
    server.close(async () => {
      await disconnectDB()
      console.log('Servidor cerrado correctamente.')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
}

main().catch(err => {
  console.error('❌ Error fatal al iniciar:', err)
  process.exit(1)
})
