// ══════════════════════════════════════════════════════════
//  sse.service.ts — Server-Sent Events para dashboard en vivo
//  Mantiene conexiones abiertas y distribuye eventos del
//  EventBus a los clientes conectados.
// ══════════════════════════════════════════════════════════
import type { Response } from 'express'
import { eventBus, EventoDominio, Eventos, type PayloadEvento } from './eventbus.service'
import { logger } from '../utils/logger'

const SSE_HEARTBEAT_MS = 15_000   // cada 15s
const SSE_RECONNECT_MS = 3_000    // cliente reconecta en 3s

interface ClienteSSE {
  id: string
  res: Response
  filtros?: Set<EventoDominio>
}

class SSEManager {
  private clientes: Map<string, ClienteSSE> = new Map()
  private heartbeatTimer: NodeJS.Timeout | null = null
  private unsubscribes: Array<() => void> = []

  /** Iniciar el manager (subscribe a EventBus + heartbeat) */
  init(): void {
    // Escuchar TODOS los eventos del dominio y distribuirlos a SSE
    const eventos = Object.values(Eventos)
    for (const evento of eventos) {
      const unsub = eventBus.on(evento, (payload) => this.distribuir(payload))
      this.unsubscribes.push(unsub)
    }

    // Heartbeat para mantener conexiones vivas
    this.heartbeatTimer = setInterval(() => {
      for (const [, cliente] of this.clientes) {
        try {
          cliente.res.write(`:heartbeat\n\n`)
        } catch {
          this.remover(cliente.id)
        }
      }
    }, SSE_HEARTBEAT_MS)

    logger.info(`[SSE] Manager iniciado — ${eventos.length} eventos escuchados`)
  }

  /** Agregar un nuevo cliente SSE */
  agregar(id: string, res: Response, filtros?: EventoDominio[]): void {
    // Headers SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',     // Nginx
      'X-Content-Type-Options': 'nosniff',
    })

    // Tiempo de reconexión sugerido
    res.write(`retry: ${SSE_RECONNECT_MS}\n\n`)

    // Enviar evento inicial de conexión
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id, timestamp: new Date().toISOString() })}\n\n`)

    const cliente: ClienteSSE = {
      id,
      res,
      filtros: filtros ? new Set(filtros) : undefined,
    }

    this.clientes.set(id, cliente)

    // Limpiar al desconectar
    res.on('close', () => {
      this.remover(id)
    })

    logger.debug(`[SSE] Cliente conectado — ${id} (total: ${this.clientes.size})`)
  }

  /** Distribuir un payload a todos los clientes que correspondan */
  private distribuir(payload: PayloadEvento): void {
    const data = JSON.stringify(payload)
    for (const [, cliente] of this.clientes) {
      // Si el cliente tiene filtros, solo enviar si coincide
      if (cliente.filtros && !cliente.filtros.has(payload.tipo)) continue

      try {
        cliente.res.write(`event: ${payload.tipo}\ndata: ${data}\n\n`)
      } catch {
        this.remover(cliente.id)
      }
    }
  }

  /** Remover un cliente */
  private remover(id: string): void {
    const cliente = this.clientes.get(id)
    if (cliente) {
      try { cliente.res.end() } catch { /* ya cerrado */ }
      this.clientes.delete(id)
      logger.debug(`[SSE] Cliente desconectado — ${id} (total: ${this.clientes.size})`)
    }
  }

  /** Estadísticas */
  stats(): { clientesConectados: number; clientesIds: string[] } {
    return {
      clientesConectados: this.clientes.size,
      clientesIds: Array.from(this.clientes.keys()),
    }
  }

  /** Detener el manager y limpiar */
  destroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    for (const unsub of this.unsubscribes) unsub()
    for (const [, cliente] of this.clientes) {
      try { cliente.res.end() } catch { /* ya cerrado */ }
    }
    this.clientes.clear()
    logger.info('[SSE] Manager detenido')
  }

  /** Enviar evento a un cliente específico */
  enviar(clienteId: string, evento: string, data: unknown): void {
    const cliente = this.clientes.get(clienteId)
    if (!cliente) return
    try {
      cliente.res.write(`event: ${evento}\ndata: ${JSON.stringify(data)}\n\n`)
    } catch {
      this.remover(clienteId)
    }
  }
}

export const sseManager = new SSEManager()
