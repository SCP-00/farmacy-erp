import { Link } from 'react-router-dom'
import { Heart, ShoppingCart, Pill, Truck } from 'lucide-react'
import { useCarritoStore } from '@/store/carritoStore'
import toast from 'react-hot-toast'
import { useAuthCliente } from '@/hooks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clientesService } from '@/services'

/**
 * Tarjeta de producto para el catálogo B2C.
 * Soporta dos variantes: `grid` (card) y `list` (fila horizontal).
 * Incluye botón de agregar al carrito, badge de descuento simulado,
 * indicador de stock, y botón de favoritos (solo para clientes logueados).
 *
 * @example
 * ```tsx
 * <ProductCard producto={producto} variant="grid" />
 * <ProductCard producto={producto} variant="list" />
 * ```
 */
export function ProductCard({ producto, variant = 'grid' }: any) {
  const agregarCarrito = useCarritoStore((state) => state.agregar)
  const { estaLogueado } = useAuthCliente()
  const queryClient = useQueryClient()

  const favoritoMutation = useMutation({
    mutationFn: () => clientesService.toggleFavorito(producto.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoritos-cliente'] })
      toast.success('Lista de favoritos actualizada')
    },
    onError: () => {
      toast.error('Error al actualizar favoritos')
    }
  })

  const handleAgregarCarrito = () => {
    agregarCarrito({
      productoId: producto.id,
      nombre: producto.nombre,
      marca: producto.laboratorio || producto.marca || 'Genérico',
      presentacion: producto.presentacion || '',
      concentracion: producto.concentracion || '',
      precioUnitario: Number(producto.precioVenta),
      cantidad: 1,
      stockMaximo: producto.stockTotal || 0,
      requiereRx: producto.requiereRx,
      disponibleEnvio: true,
      disponibleTienda: true,
      imagenUrl: producto.imagenUrl,
    })
  }

  const descuentoPorcentaje = 15 // Simulado visual
  const precioActual = Number(producto.precioVenta)
  const precioAnterior = Math.round(precioActual * 1.18)

  const productLink = producto.id ? `/productos/${producto.id}` : '#'

  if (variant === 'list') {
    return (
      <div className="flex gap-4 p-4 surface transition hover:-translate-y-0.5">
        <Link to={productLink} className="flex-shrink-0">
          <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center">
            <Pill className="w-10 h-10 text-teal-300" />
          </div>
        </Link>
        <div className="flex-1">
          <Link to={productLink} className="font-semibold text-slate-900 dark:text-dark-text hover:text-teal-700 dark:hover:text-teal-400">
            {producto.nombre}
          </Link>
          <p className="text-sm text-slate-600 dark:text-dark-text-secondary">{producto.laboratorio} • {producto.presentacion}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-bold text-teal-700 dark:text-teal-400">${precioActual.toLocaleString()}</span>
            <span className="text-sm text-slate-500 dark:text-dark-text-muted line-through">${precioAnterior.toLocaleString()}</span>
            <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold px-2 py-1 rounded-full">-{descuentoPorcentaje}%</span>
          </div>
          {producto.requiereRx && <p className="text-xs text-orange-600 mt-1">⚕️ Requiere receta médica</p>}
        </div>
        <button onClick={handleAgregarCarrito} disabled={producto.stockTotal === 0}
          className="self-center p-2 bg-teal-700 text-white rounded-xl hover:bg-teal-600">
          <ShoppingCart className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="surface overflow-hidden transition group hover:-translate-y-0.5">
      <Link to={productLink} className="relative block overflow-hidden bg-slate-100 dark:bg-dark-surface aspect-square">
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-teal-50 dark:from-teal-900/30 to-sky-50 dark:to-sky-900/20">
          <Pill className="w-16 h-16 text-teal-300" />
        </div>
        {producto.requiereRx && <div className="absolute top-2 left-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-semibold">Rx</div>}
        <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">-{descuentoPorcentaje}%</div>
        <div className="absolute bottom-2 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1"><Truck className="w-3 h-3" /> Envío</div>
        {estaLogueado && (
          <button onClick={(e) => { e.preventDefault(); favoritoMutation.mutate() }}
            className="absolute bottom-2 right-2 bg-white dark:bg-dark-surface rounded-full p-2 opacity-0 group-hover:opacity-100 transition shadow-md hover:scale-110 active:scale-95 z-10">
            <Heart className="w-5 h-5 text-slate-400 dark:text-dark-text-muted hover:text-red-500 hover:fill-red-500" />
          </button>
        )}
      </Link>

      <div className="p-4">          <Link to={productLink}>
          <h3 className="font-semibold text-slate-900 dark:text-dark-text text-sm line-clamp-2 hover:text-teal-700 dark:hover:text-teal-400 mb-1 min-h-[40px]">
            {producto.nombre} {producto.concentracion}
          </h3>
        </Link>
        <p className="text-xs text-slate-600 dark:text-dark-text-secondary mb-2">{producto.laboratorio || 'Genérico'}</p>
        <p className="text-xs text-slate-500 dark:text-dark-text-muted mb-3">{producto.presentacion}</p>
        <div className="mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-teal-700 dark:text-teal-400">${precioActual.toLocaleString()}</span>
            <span className="text-sm text-slate-500 dark:text-dark-text-muted line-through">${precioAnterior.toLocaleString()}</span>
          </div>
        </div>          {producto.stockTotal === 0 ? (
          <button className="w-full py-2 bg-gray-300 dark:bg-dark-surface text-gray-600 dark:text-dark-text-muted rounded-lg font-medium cursor-not-allowed">Agotado</button>
        ) : (
          <button onClick={handleAgregarCarrito} className="w-full py-2 bg-teal-700 dark:bg-teal-600 text-white rounded-full font-medium hover:bg-teal-600 dark:hover:bg-teal-500 transition flex items-center justify-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Agregar
          </button>
        )}

        <p className="text-xs text-slate-600 dark:text-dark-text-secondary mt-2">
          {producto.stockTotal > 10 ? <span className="text-green-600 dark:text-green-400">✓ En stock</span> : producto.stockTotal > 0 ? <span className="text-orange-600 dark:text-orange-400">⚠ Últimas {producto.stockTotal} unidades</span> : <span className="text-red-600 dark:text-red-400">✗ Agotado</span>}
        </p>
      </div>
    </div>
  )
}