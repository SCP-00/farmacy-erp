// ══════════════════════════════════════════════════════════
//  websocket.service.ts — WebSocket manager para POS
//  Eventos en vivo: caja apertura/cierre, stock crítico,
//  ventas en otras sesiones.
// ══════════════════════════════════════════════════════════
import { WebSocketServer, WebSocket as WS, type RawData } from 'ws'
import type { Server as HTTPServer } from 'http'
import { eventBus, Eventos } from './eventbus.service'
import { logger } from '../utils/logger'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { procesarMensaje } from '../modules/chatbot/chatbot.routes'

// ── Tipos de mensajes WS ──────────────────────────────────
interface MensajeWS {
  type: 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'PING' | 'PONG' | 'CHATBOT'
  channel?: string
  /** Para CHATBOT: texto del mensaje */
  mensaje?: string
  /** Para CHATBOT: token de sesión */
  sessionToken?: string
}

interface ClienteWS {
  ws: WS
  id: string
  empleadoId?: string
  rol?: string
  channels: Set<string>
}

const CANALES = {
  POS_CAJA:      'pos:caja',
  POS_VENTAS:    'pos:ventas',
  POS_STOCK:     'pos:stock',
  ADMIN_ALERTAS: 'admin:alertas',
  CHATBOT:       'chatbot',
} as const

class WSManager {
  private wss: WebSocketServer | null = null
  private clientes: Map<string, ClienteWS> = new Map()
  private unsubscribes: Array<() => void> = []

  /** Iniciar WebSocket server sobre HTTP existente */
  init(server: HTTPServer): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      maxPayload: 1024 * 100, // 100KB max
    })

    this.wss.on('connection', (ws, req) => {
      // Verificar token JWT desde query param (?token=...)
      const url = new URL(req.url || '/', `http://${req.headers.host}`)
      const token = url.searchParams.get('token')
      let empleadoId: string | undefined
      let rol: string | undefined

      if (token) {
        try {
          const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; rol: string }
          empleadoId = decoded.id
          rol = decoded.rol
        } catch {
          // Token inválido — conexión anónima (solo canales públicos)
        }
      }

      const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const cliente: ClienteWS = {
        ws,
        id,
        empleadoId,
        rol,
        channels: new Set(),
      }
      this.clientes.set(id, cliente)

      // Suscribir a canales por defecto según rol
      if (rol) {
        cliente.channels.add(CANALES.POS_CAJA)
        cliente.channels.add(CANALES.POS_VENTAS)
        if (rol === 'ADMINISTRADOR') {
          cliente.channels.add(CANALES.ADMIN_ALERTAS)
        }
      } else {
        // Anónimos solo ven stock
        cliente.channels.add(CANALES.POS_STOCK)
      }

      // Enviar confirmación de conexión
      this.enviar(cliente, 'connected', {
        clientId: id,
        channels: Array.from(cliente.channels),
        empleadoId: cliente.empleadoId,
      })

      logger.debug(`[WS] Cliente conectado — ${id} (rol: ${rol ?? 'anónimo'})`)

      // Manejar mensajes del cliente
      ws.on('message', (raw: RawData) => {
        try {
          const msg: MensajeWS = JSON.parse(raw.toString())
          this.procesarMensaje(cliente, msg)
        } catch {
          // Ignorar mensajes malformados
        }
      })

      // Pong automático a pings
      ws.on('pong', () => { /* mantener conexión viva */ })

      // Limpiar al desconectar
      ws.on('close', () => {
        this.clientes.delete(id)
        logger.debug(`[WS] Cliente desconectado — ${id} (total: ${this.clientes.size})`)
      })

      ws.on('error', () => {
        this.clientes.delete(id)
      })
    })

    // Escuchar eventos del EventBus y distribuirlos a WS
    this.unsubscribes.push(
      eventBus.on(Eventos.CAJA_ABIERTA, (p) => this.broadcast(CANALES.POS_CAJA, 'caja:abierta', p.data)),
      eventBus.on(Eventos.CAJA_CERRADA, (p) => this.broadcast(CANALES.POS_CAJA, 'caja:cerrada', p.data)),
      eventBus.on(Eventos.VENTA_REGISTRADA, (p) => this.broadcast(CANALES.POS_VENTAS, 'venta:registrada', p.data)),
      eventBus.on(Eventos.STOCK_CRITICO, (p) => this.broadcast(CANALES.POS_STOCK, 'stock:critico', p.data)),
      eventBus.on(Eventos.INVENTARIO_ALERTA, (p) => this.broadcast(CANALES.ADMIN_ALERTAS, 'inventario:alerta', p.data)),
    )

    // Heartbeat ping cada 30s
    const heartbeat = setInterval(() => {
      for (const [, c] of this.clientes) {
        if (c.ws.readyState === WS.OPEN) {
          c.ws.ping()
        }
      }
    }, 30_000)

    this.wss.on('close', () => clearInterval(heartbeat))

    logger.info(`[WS] WebSocket server iniciado en /ws`)
  }

  /** Procesar mensaje del cliente */
  private procesarMensaje(cliente: ClienteWS, msg: MensajeWS): void {
    switch (msg.type) {
      case 'SUBSCRIBE':
        if (msg.channel && msg.channel in CANALES) {
          cliente.channels.add(msg.channel)
          this.enviar(cliente, 'subscribed', { channel: msg.channel })
        }
        break
      case 'UNSUBSCRIBE':
        if (msg.channel) {
          cliente.channels.delete(msg.channel)
          this.enviar(cliente, 'unsubscribed', { channel: msg.channel })
        }
        break
      case 'PING':
        this.enviar(cliente, 'pong', {})
        break
      case 'CHATBOT':
        if (msg.mensaje) {
          this.procesarChatbot(cliente, msg)
        }
        break
      default:
        // Ignorar
        break
    }
  }

  /** Procesar mensaje de chatbot via WS */
  private async procesarChatbot(cliente: ClienteWS, msg: MensajeWS): Promise<void> {
    const sessionToken = msg.sessionToken || `ws_chat_${cliente.id}`
    try {
      const resultado = await procesarMensaje(msg.mensaje!, sessionToken)
      this.enviar(cliente, 'chatbot:respuesta', {
        respuesta: resultado.respuesta,
        productos: resultado.productos,
        alertas: resultado.alertas,
        menuActivo: resultado.nuevoEstado,
        sessionToken,
      })
    } catch (err) {
      logger.error(`[WS] Error procesando chatbot para ${cliente.id}:`, err)
      this.enviar(cliente, 'chatbot:error', {
        mensaje: 'Error al procesar el mensaje. Intenta de nuevo.',
      })
    }
  }

  /** Broadcast a todos los clientes suscritos a un canal */
  private broadcast(canal: string, evento: string, data: Record<string, unknown>): void {
    const payload = JSON.stringify({ event: evento, data, timestamp: new Date().toISOString() })
    for (const [, cliente] of this.clientes) {
      if (!cliente.channels.has(canal)) continue
      if (cliente.ws.readyState === WS.OPEN) {
        try {
          cliente.ws.send(payload)
        } catch {
          /* ignorar */
        }
      }
    }
  }

  /** Enviar mensaje a un cliente específico */
  private enviar(cliente: ClienteWS, evento: string, data: unknown): void {
    if (cliente.ws.readyState === WS.OPEN) {
      cliente.ws.send(JSON.stringify({ event: evento, data, timestamp: new Date().toISOString() }))
    }
  }

  /** Estadísticas */
  stats(): { clientesConectados: number; canales: Record<string, number> } {
    const canales: Record<string, number> = {}
    for (const [, c] of this.clientes) {
      for (const ch of c.channels) {
        canales[ch] = (canales[ch] || 0) + 1
      }
    }
    return { clientesConectados: this.clientes.size, canales }
  }

  /** Detener el manager */
  destroy(): void {
    for (const unsub of this.unsubscribes) unsub()
    if (this.wss) {
      this.wss.clients.forEach((client) => client.close())
      this.wss.close()
    }
    this.clientes.clear()
    logger.info('[WS] Manager detenido')
  }
}

export const wsManager = new WSManager()
export { CANALES }
