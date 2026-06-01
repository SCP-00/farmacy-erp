import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageCircle, X, Send, Bot, User as UserIcon,
  AlertTriangle, AlertCircle, Info, Pill, ShoppingCart,
  Activity, ChevronDown, ChevronUp, Sparkles, HeartHandshake,
  ArrowLeft,
} from 'lucide-react'
import { useChatbot, type ProductoChatbot, type AlertaChatbot } from '@/hooks'
import { useUiStore } from '@/store/uiStore'
import { useFormateo } from '@/hooks'

const DELAY_CLASSES = ['[animation-delay:0ms]', '[animation-delay:150ms]', '[animation-delay:300ms]']

// Acciones rápidas
const ACCIONES_RAPIDAS = [
  { label: '🔍 Buscar', cmd: 'Buscar medicamentos' },
  { label: '⚠️ Interacciones', cmd: 'Verificar interacciones' },
  { label: '🏪 Sedes', cmd: 'Sedes y ubicaciones' },
  { label: '🚚 Domicilios', cmd: 'Servicio a domicilio' },
  { label: '💊 Alternativas', cmd: 'Alternativas y genéricos' },
  { label: '❓ FAQ', cmd: 'Preguntas frecuentes' },
]

// ── ProductCard ───────────────────────────────────────────
function ProductCard({ p }: { p: ProductoChatbot }) {
  const { cop } = useFormateo()
  const navigate = useNavigate()
  return (
    <div className="flex items-start gap-2.5 p-2.5 bg-gradient-to-r from-teal-50/80 to-white border border-teal-100/60 rounded-xl shadow-xs hover:shadow-sm transition-all duration-200 hover:-translate-y-0.5 dark:from-teal-900/20 dark:to-dark-surface dark:border-teal-800/30">
      <div className="w-8 h-8 bg-gradient-to-br from-teal-100 to-teal-200 rounded-lg flex items-center justify-center flex-shrink-0 dark:from-teal-800/40 dark:to-teal-700/30">
        <Pill size={14} className="text-teal-600 dark:text-teal-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-slate-900 truncate dark:text-dark-text">
          {p.nombre} {p.concentracion ?? ''}
        </p>
        <p className="text-[10px] text-slate-400 truncate dark:text-dark-text-muted">
          {p.laboratorio ?? ''} · {p.presentacion ?? ''}
        </p>
        {p.stockTotal > 0 && (
          <p className="text-[10px] text-teal-600 font-semibold mt-0.5 dark:text-teal-400">
            {cop(p.precioVenta)} · {p.stockTotal} uds.
            {p.requiereRx && <span className="text-amber-600 dark:text-amber-400 ml-1">RX</span>}
          </p>
        )}
      </div>
      <button
        onClick={() => navigate(`/productos/${p.id}`)}
        className="flex-shrink-0 px-2 py-1 bg-gradient-to-r from-teal-600 to-teal-700 text-white text-[9px] font-semibold rounded-lg hover:from-teal-500 hover:to-teal-600 transition-all duration-200 active:scale-90"
        title="Ver producto"
      >
        <ShoppingCart size={10} className="inline mr-0.5" />
        Ver
      </button>
    </div>
  )
}

// ── AlertaBadge ───────────────────────────────────────────
function AlertaBadge({ a }: { a: AlertaChatbot }) {
  const [expandida, setExpandida] = useState(false)

  const config = a.severidad === 'ALTA'
    ? { bg: 'bg-red-50 dark:bg-red-900/15', border: 'border-red-200 dark:border-red-800/30', icon: AlertCircle, iconColor: 'text-red-600 dark:text-red-400', badge: 'bg-red-500', label: 'Alta' }
    : a.severidad === 'MEDIA'
    ? { bg: 'bg-amber-50 dark:bg-amber-900/15', border: 'border-amber-200 dark:border-amber-800/30', icon: AlertTriangle, iconColor: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500', label: 'Media' }
    : { bg: 'bg-blue-50 dark:bg-blue-900/15', border: 'border-blue-200 dark:border-blue-800/30', icon: Info, iconColor: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-500', label: 'Info' }

  const Icon = config.icon

  return (
    <div className={`${config.bg} ${config.border} border rounded-lg p-2 text-[10px]`}>
      <button
        onClick={() => setExpandida(!expandida)}
        className="flex items-center gap-1.5 w-full text-left"
        aria-expanded={expandida}
      >
        <Icon size={12} className={`${config.iconColor} flex-shrink-0`} />
        <span className={`px-1.5 py-0.5 rounded text-white text-[8px] font-bold ${config.badge} flex-shrink-0`}>
          {config.label}
        </span>
        <span className="text-slate-700 dark:text-dark-text font-medium truncate flex-1">{a.descripcion}</span>
        {expandida ? <ChevronUp size={10} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={10} className="text-slate-400 flex-shrink-0" />}
      </button>
      {expandida && (
        <div className="mt-1.5 pl-5 space-y-0.5 text-[10px] text-slate-500 dark:text-dark-text-muted animate-fade-in">
          {a.productoA && <p>Producto: {a.productoA}</p>}
          {a.productoB && <p>Interactúa con: {a.productoB}</p>}
          <p>Tipo: {a.tipo}</p>
        </div>
      )}
    </div>
  )
}

// ── AlertaBanner ──────────────────────────────────────────
function AlertaBanner({ count }: { count: number }) {
  return (
    <div className="mx-2 my-1 px-2.5 py-2 bg-red-50/80 dark:bg-red-900/15 border border-red-200/60 dark:border-red-800/30 rounded-xl animate-fade-in">
      <div className="flex items-center gap-2">
        <AlertCircle size={14} className="text-red-500 flex-shrink-0 animate-pulse-soft" />
        <p className="text-[10px] text-red-700 dark:text-red-400 font-semibold">
          {count} alerta{count !== 1 ? 's' : ''} de seguridad detectada{count !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

// ── ChatbotWidget ─────────────────────────────────────────
/**
 * Widget de chatbot flotante (FarmaBot).
 * - FAB (Floating Action Button) en la esquina inferior derecha
 * - Panel deslizable con historial de mensajes
 * - Soporta acciones rápidas (buscar, interacciones, sedes, etc.)
 * - Muestra tarjetas de producto y alertas de seguridad integradas
 * - Persiste sesión por `sessionToken` generado aleatoriamente
 * - Cierre con tecla Escape
 *
 * @example
 * ```tsx
 * // Se usa automáticamente en PublicLayout
 * <ChatbotWidget />
 * ```
 */
export default function ChatbotWidget() {
  const { chatbotAbierto, toggleChatbot, darkMode } = useUiStore()
  const { mensajes, escribiendo, enviar } = useChatbot()
  const [input, setInput] = useState('')
  const [showQuickActions, setShowQuickActions] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, escribiendo])

  // Focus input when panel opens
  useEffect(() => {
    if (chatbotAbierto) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [chatbotAbierto])

  // Cerrar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && chatbotAbierto) toggleChatbot()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [chatbotAbierto, toggleChatbot])

  // Cerrar con clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          !(e.target as HTMLElement).closest('[data-chatbot-fab]')) {
        // No cerrar automáticamente para mejor UX
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const alertasRecientes = mensajes[mensajes.length - 1]?.alertas?.length ?? 0
  const totalAlertas = mensajes.reduce((acc, m) => acc + (m.alertas?.length ?? 0), 0)
  const tieneMensajes = mensajes.length > 0

  const handleEnviar = () => {
    const txt = input.trim()
    if (!txt) return
    setInput('')
    setHasInteracted(true)
    setShowQuickActions(false)
    enviar(txt)
  }

  const handleQuickAction = (cmd: string) => {
    setHasInteracted(true)
    setShowQuickActions(false)
    enviar(cmd)
  }

  const handleResetMenu = () => {
    enviar('hola')
    setShowQuickActions(true)
  }

  // Animación de entrada del panel
  const panelAnimation = chatbotAbierto
    ? 'opacity-100 translate-y-0 scale-100'
    : 'opacity-0 translate-y-4 scale-95 pointer-events-none'

  return (
    <>
      {/* ── FAB ──────────────────────────────────────── */}
      <button
        onClick={toggleChatbot}
        data-chatbot-fab
        className={`fixed z-[9999] w-14 h-14 rounded-full shadow-lg
                    flex items-center justify-center transition-all duration-300
                    active:scale-90 focus-visible:outline-2 focus-visible:outline-teal-500 focus-visible:outline-offset-2
                    bottom-6 right-6
                    sm:bottom-6 sm:right-6
                    ${chatbotAbierto
            ? 'bg-gray-600 dark:bg-gray-700 scale-90 rotate-90'
            : 'bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 hover:scale-110 hover:shadow-xl shadow-teal-700/25'}`}
        title={chatbotAbierto ? 'Cerrar asistente' : 'Abrir asistente virtual'}
        aria-label={chatbotAbierto ? 'Cerrar asistente virtual' : 'Abrir asistente virtual'}
        aria-expanded={chatbotAbierto}
        aria-controls="chatbot-panel"
      >
        {chatbotAbierto
          ? <X size={22} className="text-white transition-transform duration-300" />
          : <MessageCircle size={22} className="text-white" />}
        {!chatbotAbierto && (totalAlertas > 0) && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full border-2 border-white
                          bg-red-500 flex items-center justify-center text-[9px] text-white font-bold px-1 animate-fade-in">
            {totalAlertas}
          </span>
        )}
        {!chatbotAbierto && mensajes.length === 0 && totalAlertas === 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white
                          bg-amber-400 animate-pulse-soft" />
        )}
      </button>

      {/* ── Panel ─────────────────────────────────────── */}
      <div
        id="chatbot-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Asistente virtual Farmabot"
        className={`fixed z-[9999] bottom-24 right-6
                    w-[calc(100vw-2rem)] sm:w-80 md:w-96
                    max-h-[75vh] sm:max-h-[70vh]
                    rounded-3xl
                    flex flex-col overflow-hidden
                    transition-all duration-300 ease-out
                    ${panelAnimation}
                    ${darkMode
                      ? 'bg-dark-surface border border-dark-border shadow-2xl shadow-black/30'
                      : 'bg-white border border-[#D8EBE4] shadow-xl shadow-teal-900/10'
                    }`}
      >
        {/* Header */}
        <div className={`px-4 py-3 flex items-center justify-between flex-shrink-0
          ${darkMode ? 'bg-gradient-to-r from-teal-800 to-teal-900' : 'bg-gradient-to-r from-teal-700 to-teal-600'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">FarmaBot</p>
              <p className="text-teal-200 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse-soft" />
                En línea
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {tieneMensajes && (
              <button
                onClick={handleResetMenu}
                className="text-[10px] bg-white/10 text-teal-100 px-2.5 py-1.5 rounded-full hover:bg-white/20 active:scale-95 transition-all"
                title="Volver al inicio"
                aria-label="Volver al menú principal"
              >
                <ArrowLeft size={12} className="inline mr-1" />
                Inicio
              </button>
            )}
          </div>
        </div>

        {/* Alertas banner */}
        {alertasRecientes > 0 && <AlertaBanner count={alertasRecientes} />}

        {/* Mensajes */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-3 min-h-0 scroll-smooth
          ${darkMode ? 'bg-dark-bg' : 'bg-[#F5F8F6]'}`}
          role="log"
          aria-live="polite"
          aria-label="Mensajes del chat"
        >
          {/* Bienvenida */}
          {mensajes.length === 0 && (
            <div className="flex gap-2 items-start animate-message-in">
              <div className="w-7 h-7 bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-800/40 dark:to-teal-700/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={14} className="text-teal-600 dark:text-teal-400" />
              </div>
              <div className={`rounded-2xl rounded-tl-sm px-3 py-2.5 max-w-[85%] shadow-sm
                ${darkMode
                  ? 'bg-dark-surface border border-dark-border text-dark-text'
                  : 'bg-white border border-[#D8EBE4]'}`}>
                <p className={`text-xs leading-relaxed ${darkMode ? 'text-dark-text' : 'text-gray-700'}`}>
                  <span className="inline-flex items-center gap-1 flex-wrap">
                    <HeartHandshake size={14} className="text-teal-500" />
                    ¡Hola! Soy <strong>FarmaBot</strong>, tu asistente de <strong>Farmacy</strong> 🏪
                  </span>
                </p>
                <p className={`text-[11px] mt-2 ${darkMode ? 'text-dark-text-secondary' : 'text-gray-600'}`}>
                  Puedo ayudarte a buscar medicamentos, verificar interacciones, consultar horarios y más.
                  Elige una opción para empezar 👇
                </p>
              </div>
            </div>
          )}

          {/* Mensajes del chat */}
          {mensajes.map((m, i) => (
            <div key={i} className="space-y-2 animate-message-in">
              <div className={`flex gap-2 items-start ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center
                                 flex-shrink-0 mt-0.5 shadow-sm
                                 ${m.role === 'user'
                                   ? 'bg-gradient-to-br from-teal-600 to-teal-700'
                                   : 'bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-800/40 dark:to-teal-700/30'}`}>
                  {m.role === 'user'
                    ? <UserIcon size={13} className="text-white" />
                    : <Bot size={13} className="text-teal-600 dark:text-teal-400" />}
                </div>
                <div className={`rounded-2xl px-3 py-2 max-w-[80%] text-xs leading-relaxed
                                 whitespace-pre-wrap shadow-sm space-y-2
                                 ${m.role === 'user'
                                   ? 'bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-tr-sm'
                                   : darkMode
                                     ? 'bg-dark-surface border border-dark-border text-dark-text rounded-tl-sm'
                                     : 'bg-white text-gray-700 border border-[#D8EBE4] rounded-tl-sm'}`}>
                  <p>{m.texto}</p>

                  {/* Product cards */}
                  {m.productos && m.productos.length > 0 && (
                    <div className="space-y-1.5 pt-1.5 border-t border-gray-100 dark:border-dark-border">
                      <p className="text-[9px] text-slate-400 dark:text-dark-text-muted font-semibold uppercase tracking-wider">
                        Productos encontrados ({m.productos.length})
                      </p>
                      {m.productos.map(p => (
                        <ProductCard key={p.id} p={p} />
                      ))}
                      <p className="text-[9px] text-slate-400 dark:text-dark-text-muted italic">
                        Haz clic en "Ver" para más detalles e información INVIMA.
                      </p>
                    </div>
                  )}

                  {/* Alertas */}
                  {m.alertas && m.alertas.length > 0 && (
                    <div className="space-y-1.5 pt-1.5 border-t border-gray-100 dark:border-dark-border">
                      <p className="flex items-center gap-1 text-[9px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">
                        <Activity size={10} />
                        Alertas de seguridad ({m.alertas.length})
                      </p>
                      {m.alertas.map((a, idx) => (
                        <AlertaBadge key={idx} a={a} />
                      ))}
                      <p className="text-[9px] text-slate-400 dark:text-dark-text-muted italic">
                        ⚕️ Consulta siempre con un profesional de la salud.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Escribiendo */}
          {escribiendo && (
            <div className="flex gap-2 items-start animate-fade-in">
              <div className="w-7 h-7 bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-800/40 dark:to-teal-700/30 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot size={13} className="text-teal-600 dark:text-teal-400" />
              </div>
              <div className={`rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm
                ${darkMode ? 'bg-dark-surface border border-dark-border' : 'bg-white border border-[#D8EBE4]'}`}>
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map(i => (
                    <div key={i}
                      className={`w-1.5 h-1.5 rounded-full animate-bounce ${DELAY_CLASSES[i]}
                        ${darkMode ? 'bg-teal-500' : 'bg-teal-400'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Acciones rápidas */}
        {tieneMensajes && !hasInteracted && (
          <div className={`px-3 py-2 border-t flex-shrink-0
            ${darkMode ? 'bg-dark-surface border-dark-border' : 'bg-[#F5F8F6] border-[#D8EBE4]'}`}>
            <div className="flex flex-wrap gap-1">
              {ACCIONES_RAPIDAS.slice(0, 6).map(a => (
                <button
                  key={a.cmd}
                  onClick={() => handleQuickAction(a.cmd)}
                  className={`text-[10px] px-2 py-1 rounded-full transition-all duration-150 hover:scale-105 active:scale-95
                    ${darkMode
                      ? 'bg-dark-surface border border-dark-border text-teal-400 hover:bg-dark-hover'
                      : 'bg-white border border-teal-200 text-teal-700 hover:bg-teal-50'}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ) || !tieneMensajes && (
          <div className={`px-3 pb-2 flex-shrink-0
            ${darkMode ? 'bg-dark-bg' : 'bg-[#F5F8F6]'}`}>
            <div className="flex flex-wrap gap-1.5">
              {ACCIONES_RAPIDAS.map(a => (
                <button key={a.cmd} onClick={() => handleQuickAction(a.cmd)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-full font-medium transition-all duration-150 hover:scale-105 active:scale-95
                    ${darkMode
                      ? 'bg-dark-surface border border-dark-border text-teal-400 hover:bg-dark-hover'
                      : 'bg-white border border-teal-200 text-teal-700 hover:bg-teal-50'}`}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className={`px-4 py-1.5 border-t flex-shrink-0
          ${darkMode
            ? 'bg-amber-900/10 border-dark-border'
            : 'bg-amber-50 border-amber-100'}`}>
          <p className={`text-[10px] ${darkMode ? 'text-amber-300' : 'text-amber-700'}`}>
            ⚕️ Este chatbot no reemplaza asesoría médica profesional.
          </p>
        </div>

        {/* Input */}
        <div className={`flex gap-2 p-3 border-t flex-shrink-0
          ${darkMode ? 'border-dark-border bg-dark-surface' : 'border-[#D8EBE4] bg-white'}`}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }}
            placeholder="Ej: ¿tienen ibuprofeno?"
            className={`flex-1 text-sm px-3 py-2 rounded-xl outline-none transition-all duration-200
              ${darkMode
                ? 'bg-dark-bg border border-dark-border text-dark-text placeholder-dark-text-muted focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'
                : 'bg-[#F5F8F6] border border-[#D8EBE4] focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20'
              }`}
            aria-label="Escribe tu mensaje"
          />
          <button
            onClick={handleEnviar}
            disabled={!input.trim() || escribiendo}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200
              disabled:opacity-40 flex-shrink-0 active:scale-90
              ${input.trim() && !escribiendo
                ? darkMode
                  ? 'bg-teal-600 text-white hover:bg-teal-500'
                  : 'bg-teal-700 text-white hover:bg-teal-600'
                : darkMode
                  ? 'bg-dark-surface text-dark-text-muted'
                  : 'bg-gray-200 text-gray-400'
              }`}
            title="Enviar mensaje"
            aria-label="Enviar mensaje"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  )
}
