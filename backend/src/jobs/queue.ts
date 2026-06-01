// ══════════════════════════════════════════════════════════
//  queue.ts — BullMQ Queue + Worker para jobs asíncronos
//  Usa Redis ya existente.
// ══════════════════════════════════════════════════════════
import { Queue, Worker, type Job } from 'bullmq'
import { redis } from '../config/redis'
import { logger } from '../utils/logger'
import { eventBus, Eventos } from '../services/eventbus.service'

// ── Conexión compartida para BullMQ ───────────────────────
// BullMQ necesita un IORedis instance. Reusamos la conexión existente.
// Nota: BullMQ usa createClient función para obtener conexiones dedicadas
// para blocking operations. Usamos lazy client creation.
function crearConexion() {
  // Parsear REDIS_URL (formato: redis[s]://[[usuario][:password]@][host][:port])
  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL)
      return {
        host: url.hostname || 'localhost',
        port: Number(url.port) || 6379,
        password: url.password || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      }
    } catch {
      // fallback a defaults
    }
  }
  return {
    host: 'localhost',
    port: 6379,
    password: undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }
}

// ── Definición de tipos de jobs ───────────────────────────
export interface CSVExportPayload {
  tipo: 'ventas' | 'compras' | 'inventario'
  desde?: string
  hasta?: string
  usuarioId: string
  jobId: string
}

export interface EmailPayload {
  to: string
  subject: string
  html: string
}

export type JobPayload = CSVExportPayload | EmailPayload

// ── Colas ─────────────────────────────────────────────────
export const colas = {
  csvExport: new Queue<CSVExportPayload>('csv-export', {
    connection: crearConexion(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600 * 24 * 7 },    // 7 días
      removeOnFail: { age: 3600 * 24 * 30 },        // 30 días
    },
  }),

  emails: new Queue<EmailPayload>('emails', {
    connection: crearConexion(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 3600 * 24 },
      removeOnFail: { age: 3600 * 24 * 7 },
    },
  }),
}

/** Añadir un email a la cola de emails (fire & forget).
 *  No espera a que se envíe — retorna inmediatamente.
 *  Útil para enviar correos sin bloquear la request HTTP. */
export async function encolarEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await colas.emails.add('enviar-email', { to, subject, html })
    logger.info(`[Queue] Email encolado para ${to} — asunto: "${subject.slice(0, 60)}"`)
  } catch (err) {
    logger.error(`[Queue] Error al encolar email para ${to}: ${(err as Error).message}`)
  }
}

// ── Workers ───────────────────────────────────────────────
function iniciarWorkerCSV(): Worker<CSVExportPayload> {
  const worker = new Worker<CSVExportPayload>(
    'csv-export',
    async (job: Job<CSVExportPayload>) => {
      const { tipo, desde, hasta, jobId } = job.data
      logger.info(`[Queue] CSV Export iniciado — tipo: ${tipo}, job: ${jobId}`)

      try {
        // La exportación real se ejecuta vía el worker; el resultado
        // se persiste en Redis para que el frontend lo descargue luego.
        const { exportarCSV } = await import('./csv-export.job')
        const csv = await exportarCSV(tipo as any, desde, hasta)

        // Guardar resultado en Redis (expira en 1 hora)
        const redisKey = `csv:${jobId}`
        await redis.setex(redisKey, 3600, csv)

        // Emitir evento de completado
        eventBus.emit(Eventos.JOB_COMPLETADO, {
          tipo: 'csv-export',
          jobId,
          key: redisKey,
        })

        logger.info(`[Queue] CSV Export completado — job: ${jobId} (${csv.length} chars)`)
        return { jobId, key: redisKey, size: csv.length }
      } catch (err) {
        logger.error(`[Queue] CSV Export falló — job: ${jobId}`, err)
        eventBus.emit(Eventos.JOB_ERROR, {
          tipo: 'csv-export',
          jobId,
          error: (err as Error).message,
        })
        throw err
      }
    },
    {
      connection: crearConexion(),
      concurrency: 2,  // Máximo 2 exports simultáneos
      limiter: {
        max: 5,
        duration: 60_000,  // Máximo 5 jobs por minuto
      },
    }
  )

  worker.on('completed', (job) => {
    logger.info(`[Queue] ✅ Job completado — ${job.id} (${job.name})`)
  })

  worker.on('failed', (job, err) => {
    if (job) {
      logger.error(`[Queue] ❌ Job falló — ${job.id} (${job.name}): ${err.message}`)
    }
  })

  worker.on('error', (err) => {
    logger.error(`[Queue] Worker error: ${err.message}`)
  })

  return worker
}

// ── Inicialización ────────────────────────────────────────
let workers: Worker[] = []

export function iniciarWorkers(): void {
  if (workers.length > 0) return  // Ya iniciados

  workers = [
    iniciarWorkerCSV(),
    iniciarWorkerEmails(),
  ]

  logger.info(`[Queue] ${workers.length} worker(s) iniciados`)
}

// ── Email Worker ──────────────────────────────────────────
export function iniciarWorkerEmails(): Worker<EmailPayload> {
  const worker = new Worker<EmailPayload>(
    'emails',
    async (job: Job<EmailPayload>) => {
      const { to, subject, html } = job.data
      const { procesarEmail } = await import('./email.job')
      await procesarEmail({ to, subject, html })
    },
    {
      connection: crearConexion(),
      concurrency: 3,
    }
  )

  worker.on('completed', (job) => {
    logger.info(`[Queue] ✅ Email enviado — job ${job.id}`)
  })

  worker.on('failed', (job, err) => {
    if (job) {
      logger.error(`[Queue] ❌ Email falló — job ${job.id}: ${err.message}`)
    }
  })

  worker.on('error', (err) => {
    logger.error(`[Queue] Email worker error: ${err.message}`)
  })

  return worker
}

export async function detenerWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()))
  workers = []
  logger.info('[Queue] Workers detenidos')
}
