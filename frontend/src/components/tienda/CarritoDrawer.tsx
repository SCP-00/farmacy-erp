import { Link } from 'react-router-dom'
import { X, ShoppingBag, Trash2, Plus, Minus, AlertTriangle } from 'lucide-react'
import { useCarrito, useFormateo, useAuthCliente } from '@/hooks'

/**
 * Props del drawer lateral del carrito de compras.
 */
interface CarritoDrawerProps {
  /** Controlar visibilidad del drawer */
  open: boolean
  /** Callback al cerrar el drawer */
  onClose: () => void
}

/**
 * Drawer lateral del carrito de compras (slide-in desde la derecha).
 * Muestra productos agregados, controles de cantidad, subtotal,
 * advertencia de receta médica, y opciones de checkout.
 *
 * - Persiste en `useCarritoStore` (Zustand + localStorage)
 * - Detecta productos que requieren receta (Rx)
 * - Muestra CTAs de login/registro si el usuario no está autenticado
 *
 * @example
 * ```tsx
 * <CarritoDrawer open={isOpen} onClose={() => setIsOpen(false)} />
 * ```
 */
export default function CarritoDrawer({ open, onClose }: CarritoDrawerProps) {
  const { items, totalItems, total, agregar: _agregar, quitar, cambiarCantidad, tieneRx } = useCarrito()
  const { estaLogueado } = useAuthCliente()
  const { cop } = useFormateo()

  return (
    <>
      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={onClose}/>
      )}

      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md z-50
                       shadow-xl flex flex-col transition-transform duration-300 ease-out
                       ${open ? 'translate-x-0' : 'translate-x-full'}
                       bg-white dark:bg-dark-surface-elevated`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8EBE4] dark:border-dark-border">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-dark-text">Tu carrito</h2>
            <p className="text-xs text-gray-400 dark:text-dark-text-muted">{totalItems} producto{totalItems !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center
                       text-gray-400 dark:text-dark-text-muted hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors">
            <X size={18}/>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
                <ShoppingBag size={32} className="text-teal-300 dark:text-teal-500"/>
              </div>
              <div>
                <p className="font-medium text-gray-700 dark:text-dark-text-secondary">Tu carrito está vacío</p>
                <p className="text-sm text-gray-400 dark:text-dark-text-muted mt-1">Agrega productos desde el catálogo</p>
              </div>
              <Link to="/productos" onClick={onClose}
                className="btn-primary text-sm">
                Ver catálogo
              </Link>
            </div>
          ) : (
            <div className="px-5 space-y-3">
              {items.map(item => (
                <div key={item.productoId}
                  className="flex gap-3 p-3 bg-[#F5F8F6] dark:bg-dark-bg rounded-2xl border border-[#D8EBE4] dark:border-dark-border">
                  {/* Imagen placeholder */}
                  <div className="w-14 h-14 bg-teal-100 dark:bg-teal-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">💊</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-dark-text truncate">{item.nombre}</p>
                    <p className="text-xs text-gray-500 dark:text-dark-text-muted">{item.concentracion} · {item.presentacion}</p>
                    {item.requiereRx && (
                      <span className="badge-rx text-[10px] mt-0.5">RX</span>
                    )}
                    <p className="font-semibold text-teal-700 text-sm mt-1">
                      {cop(item.precioUnitario * item.cantidad)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end justify-between">
                    <button onClick={() => quitar(item.productoId)}
                      className="text-gray-400 dark:text-dark-text-muted hover:text-red-500 transition-colors">
                      <Trash2 size={14}/>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cambiarCantidad(item.productoId, item.cantidad - 1)}
                        className="w-6 h-6 rounded-full border border-[#D8EBE4] dark:border-dark-border bg-white dark:bg-dark-surface
                                   flex items-center justify-center hover:border-teal-400 transition-colors">
                        <Minus size={10}/>
                      </button>
                      <span className="text-sm font-semibold w-5 text-center dark:text-dark-text">{item.cantidad}</span>
                      <button
                        onClick={() => cambiarCantidad(item.productoId, item.cantidad + 1)}
                        className="w-6 h-6 rounded-full border border-[#D8EBE4] dark:border-dark-border bg-white dark:bg-dark-surface
                                   flex items-center justify-center hover:border-teal-400 transition-colors">
                        <Plus size={10}/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-[#D8EBE4] dark:border-dark-border p-5 space-y-3">
            {tieneRx && (
              <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
                <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"/>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Tu carrito tiene medicamentos que requieren fórmula médica. Tendrás que presentarla al retirar.
                </p>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-dark-text-secondary text-sm">Subtotal</span>
              <span className="font-semibold dark:text-dark-text">{cop(total)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-400 dark:text-dark-text-muted">
              <span>IVA medicamentos</span>
              <span>$0 (0%)</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold border-t border-[#D8EBE4] dark:border-dark-border pt-2">
              <span className="dark:text-dark-text">Total</span>
              <span className="text-teal-700 dark:text-teal-400">{cop(total)}</span>
            </div>

            {estaLogueado ? (
              <Link to="/checkout" onClick={onClose}
                className="block w-full text-center py-3 bg-teal-700 dark:bg-teal-600 text-white rounded-xl
                           font-semibold hover:bg-teal-600 dark:hover:bg-teal-500 transition-colors">
                Proceder al pago
              </Link>
            ) : (
              <div className="space-y-2">
                <Link to="/login" onClick={onClose}
                  className="block w-full text-center py-3 bg-teal-700 dark:bg-teal-600 text-white rounded-xl
                             font-semibold hover:bg-teal-600 dark:hover:bg-teal-500 transition-colors">
                  Iniciar sesión para comprar
                </Link>
                <Link to="/registro" onClick={onClose}
                  className="block w-full text-center py-2.5 border border-teal-400 text-teal-700 dark:text-teal-400
                             rounded-xl text-sm font-medium hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors">
                  Crear cuenta gratis
                </Link>
              </div>
            )}

            <Link to="/productos" onClick={onClose}
              className="block text-center text-xs text-gray-400 dark:text-dark-text-muted hover:text-teal-700 dark:hover:text-teal-400 transition-colors">
              Seguir comprando
            </Link>
          </div>
        )}
      </div>
    </>
  )
}