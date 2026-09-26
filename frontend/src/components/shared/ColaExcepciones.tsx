import { useState } from 'react'
import { AlertTriangle, RefreshCw, Trash2, X, CloudOff, CheckCircle2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { reintentarVenta, descartarVenta, type VentaOutbox } from '@/services/outboxOffline'
import { useFormateo } from '@/hooks'

interface ColaExcepcionesProps {
  /** Ventas en estado ERROR (cola de excepciones del outbox) */
  ventas: VentaOutbox[]
  onClose: () => void
  /** Notifica que la cola cambió (venta reintentada/descartada) */
  onCambio: () => void
}

const MOTIVO_DESCARTE = 'Descartada por el farmacéuta tras revisión'

/**
 * Cola de excepciones del outbox (ADR 0004 fase 1): ventas que el server
 * rechazó por negocio (stock, cupón vencido...) o que agotaron sus 8
 * reintentos de red. El farmacéuta decide: REINTENTAR (vuelve a la cola
 * normal con intentos en cero) o DESCARTAR (audita y elimina la ficha —
 * el cobro ya se registró en caja y se cuadra en el cierre).
 */
export default function ColaExcepciones({ ventas, onClose, onCambio }: ColaExcepcionesProps) {
  const { cop, fechaHora } = useFormateo()
  const [procesando, setProcesando] = useState<string | null>(null)

  const total = ventas.reduce((s, v) => {
    const items = (v.payload?.items ?? []) as Array<{ precioUnitario?: number; cantidad?: number }>
    return s + items.reduce((si, i) => si + (i.precioUnitario ?? 0) * (i.cantidad ?? 0), 0)
  }, 0)

  const handleReintentar = async (v: VentaOutbox) => {
    setProcesando(v.idempotencyKey)
    try {
      const ok = await reintentarVenta(v.idempotencyKey)
      if (ok) toast.success(`Venta ${v.ventaNum ? `#${v.ventaNum}` : 'offline'} sincronizada`)
      else toast('Reintento en cola: se enviará solo cuando haya conexión', { icon: '📡' })
      onCambio()
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo reintentar')
    } finally {
      setProcesando(null)
    }
  }

  const handleDescartar = async (v: VentaOutbox) => {
    // Confirmación explícita: descartar es irreversible y toca el cierre de caja
    if (!window.confirm(`¿Descartar la venta offline ${v.ventaNum ? `#${v.ventaNum}` : v.idempotencyKey.slice(0, 8)}? El cobro ya se registró en caja — cuadralo en el cierre.`)) return
    setProcesando(v.idempotencyKey)
    try {
      await descartarVenta(v.idempotencyKey, MOTIVO_DESCARTE)
      toast.success('Venta descartada (auditada en consola)')
      onCambio()
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Cola de excepciones de ventas">
      <div className="surface w-full max-w-lg max-h-[85vh] flex flex-col animate-zoom-in-95">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30">
              <CloudOff size={18} className="text-red-600 dark:text-red-400" />
            </span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-dark-text text-sm">Cola de excepciones</h3>
              <p className="text-xs text-gray-400 dark:text-dark-text-muted">
                {ventas.length} venta{ventas.length !== 1 ? 's' : ''} rechazada{ventas.length !== 1 ? 's' : ''} · {cop(total)}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-2.5">
          {ventas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 size={36} className="text-teal-600 dark:text-teal-400 mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-dark-text-secondary">Sin excepciones pendientes</p>
              <p className="text-xs text-gray-400 dark:text-dark-text-muted mt-1">Las ventas rechazadas por el server aparecerán aquí para revisión</p>
            </div>
          ) : ventas.map(v => {
            const numOff = `OFF-${v.idempotencyKey.slice(0, 8).toUpperCase()}`
            const items = (v.payload?.items ?? []) as Array<{ productoId: string; cantidad?: number; precioUnitario?: number }>
            return (
              <div key={v.idempotencyKey} className="rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 p-3.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-dark-text">{v.ventaNum ? `Venta #${v.ventaNum}` : numOff}</p>
                    <p className="text-[10px] text-gray-400 dark:text-dark-text-muted mt-0.5">
                      {fechaHora(new Date(v.creadoEn))} · {v.intentos} intento{v.intentos !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="badge-rx">{v.ventaNum ? 'AGOTÓ REINTENTOS' : 'RECHAZADA'}</span>
                </div>

                {/* Motivo del rechazo — lo que el server dijo (o red agotada) */}
                <div className="flex items-start gap-1.5 mb-2.5">
                  <AlertTriangle size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">{v.ultimoError ?? 'Sin detalle del server'}</p>
                </div>

                {/* Contenido para identificar la venta */}
                <ul className="mb-3 space-y-0.5">
                  {items.map((i, idx) => (
                    <li key={`${i.productoId}-${idx}`} className="flex justify-between text-[11px] text-gray-500 dark:text-dark-text-muted">
                      <span className="truncate pr-2">{i.cantidad ?? 1}× {i.productoId}</span>
                      <span>{cop((i.precioUnitario ?? 0) * (i.cantidad ?? 1))}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleReintentar(v)}
                    disabled={procesando === v.idempotencyKey}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-600 disabled:opacity-50 transition-colors"
                  >
                    {procesando === v.idempotencyKey ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Reintentar
                  </button>
                  <button
                    onClick={() => handleDescartar(v)}
                    disabled={procesando === v.idempotencyKey}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 size={12} />
                    Descartar
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <p className="px-5 pb-4 pt-1 text-[10px] text-gray-400 dark:text-dark-text-muted leading-relaxed">
          Las excepciones no se reintentan solas: el stock y los cupones los valida el server al volver la conexión.
          El dinero ya está registrado en caja — este panel solo decide qué fichas se envían o se anulan.
        </p>
      </div>
    </div>
  )
}
