import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, CheckCircle, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useCarritoStore } from '@/store/carritoStore'
import SEOHead from '@/components/shared/SEOHead'

const COSTOS_ENVIO_POR_CIUDAD: Record<string, number> = {
  'Pereira': 7000,
  'Dosquebradas': 8000,
  'La Virginia': 10000,
  'Marsella': 12000,
  'Santa Rosa de Cabal': 12000,
}

function calcularCostoEnvio(ciudad: string): number {
  return COSTOS_ENVIO_POR_CIUDAD[ciudad] ?? 10000
}

export function Carrito() {
  const navigate = useNavigate()
  const [ciudadEnvio, setCiudadEnvio] = useState('')
  const { items, quitar, cambiarCantidad, subtotal, total, tieneRx, limpiar } = useCarritoStore()

  if (items.length === 0) {
    return (
      <>
        <SEOHead title="Carrito vacío" description="Tu carrito de compras en Farmacy está vacío. Explora nuestro catálogo de productos." path="/carrito" />
        <div className="section-shell py-12">
          <div className="surface min-h-[60vh] flex items-center justify-center px-6 text-center">
            <div className="max-w-md">
              <ShoppingCart className="w-16 h-16 mx-auto text-teal-200 mb-4" />
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Tu carrito está vacío</h1>
              <p className="text-slate-600 mb-6">Explora el catálogo y agrega productos para continuar.</p>
              <button
                onClick={() => navigate('/productos')}
                className="btn-primary"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al catálogo
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <SEOHead
        title="Carrito de compras"
        description="Revisa tu carrito de compras en Farmacy antes de proceder al checkout. Compra segura con envío gratis."
        path="/carrito"
      />
      <div className="section-shell py-8 md:py-10">
        <div className="mb-8">
          <span className="section-kicker">Carrito</span>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900">Tu carrito</h1>
          <p className="text-slate-600 mt-2">Revisa los productos antes de continuar al checkout.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div key={item.productoId} className="surface p-4 flex gap-4">
                <div className="w-20 h-20 rounded-2xl bg-teal-50 flex items-center justify-center text-3xl flex-shrink-0">💊</div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-slate-900 truncate">{item.nombre}</h2>
                  <p className="text-sm text-slate-600">{item.marca} · {item.presentacion}</p>
                  <p className="text-sm text-teal-700 font-semibold mt-2">${item.precioUnitario.toLocaleString()} c/u</p>
                  {item.requiereRx && <p className="text-xs text-orange-600 mt-1">⚕️ Requiere receta médica</p>}
                </div>
                <div className="flex flex-col items-end gap-3">
                  <div className="flex items-center gap-2 border border-slate-200 rounded-full bg-white p-1">
                    <button onClick={() => cambiarCantidad(item.productoId, item.cantidad - 1)} className="p-2 hover:bg-slate-100 rounded-full" disabled={item.cantidad <= 1}><Minus className="w-4 h-4" /></button>
                    <span className="w-8 text-center font-semibold">{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(item.productoId, item.cantidad + 1)} className="p-2 hover:bg-slate-100 rounded-full" disabled={item.cantidad >= item.stockMaximo}><Plus className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => quitar(item.productoId)} className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium">
                    <Trash2 className="w-4 h-4" />
                    Quitar
                  </button>
                </div>
              </div>
            ))}

            <Link to="/productos" className="inline-flex items-center gap-2 text-teal-700 font-semibold hover:text-teal-900">
              <ArrowLeft className="w-4 h-4" />
              Seguir comprando
            </Link>
          </div>

          <aside className="lg:col-span-1">
            <div className="surface p-6 sticky top-24">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Resumen</h2>
              {/* Costo de envío por ciudad */}
              <div className="pb-4 border-b border-slate-200">
                <label className="block text-xs font-medium text-slate-600 mb-1">Ciudad de entrega</label>
                <select
                  value={ciudadEnvio}
                  onChange={(e) => setCiudadEnvio(e.target.value)}
                  className="input-base text-sm"
                >
                  <option value="">Selecciona ciudad</option>
                  {Object.keys(COSTOS_ENVIO_POR_CIUDAD).map(c => (
                    <option key={c} value={c}>{c} — ${COSTOS_ENVIO_POR_CIUDAD[c].toLocaleString()}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3 text-sm pb-4 border-b border-slate-200">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>${subtotal().toLocaleString()}</span></div>
                <div className="flex justify-between text-slate-600"><span>IVA (19%)</span><span>${Math.round(subtotal() * 0.19).toLocaleString()}</span></div>
                <div className="flex justify-between text-slate-600">
                  <span>Envío</span>
                  {ciudadEnvio ? (
                    <span className="font-semibold">${calcularCostoEnvio(ciudadEnvio).toLocaleString()}</span>
                  ) : (
                    <span className="text-green-600 font-semibold">Gratis</span>
                  )}
                </div>
                {ciudadEnvio && subtotal() >= 50000 && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>🚚 Envío gratis</span>
                    <span>-${calcularCostoEnvio(ciudadEnvio).toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-end py-4">
                <span className="text-base font-semibold text-slate-900">Total</span>
                <span className="text-2xl font-bold text-teal-700">
                  ${(Math.round(total() * 1.19) + (ciudadEnvio && subtotal() < 50000 ? calcularCostoEnvio(ciudadEnvio) : 0)).toLocaleString()}
                </span>
              </div>
              {tieneRx() && <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">⚠️ El carrito contiene medicamentos que requieren receta.</div>}
              <button onClick={() => navigate('/checkout')} className="btn-primary w-full justify-center">Proceder al pago</button>
              <button onClick={() => limpiar()} className="btn-secondary w-full justify-center mt-3">Vaciar carrito</button>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>Compra segura, rápida y sin registro para la fase MVP.</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}

export default Carrito
