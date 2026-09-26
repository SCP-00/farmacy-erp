import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Calendar, Coins, ShoppingBag, CreditCard, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { clientesService } from '@/services'
import { useFormateo } from '@/hooks'

export default function DetalleCliente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cop, fechaCorta } = useFormateo()

  const { data: cliente, isLoading, isError } = useQuery({
    queryKey: ['admin-cliente-detalle', id],
    queryFn: () => clientesService.obtener(id!),
    enabled: !!id,
  })

  if (isLoading) return <div className="p-10 text-center text-gray-500">Cargando perfil...</div>
  if (isError || !cliente) return <div className="p-10 text-center text-red-500">Error al cargar cliente</div>

  const ventas = cliente.ventas ?? []

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
      <button onClick={() => navigate('/admin/clientes')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-700 transition-colors">
        <ArrowLeft size={14} /> Volver a clientes
      </button>

      <div className="grid md:grid-cols-[1fr_2fr] gap-6">
        
        {/* Panel Izquierdo: Info */}
        <div className="space-y-6">
          <div className="surface overflow-hidden">
            <div className="bg-teal-900 p-6 flex flex-col items-center text-center text-white">
              <div className="w-20 h-20 bg-teal-700 rounded-full flex items-center justify-center mb-3 text-3xl font-bold shadow-inner">
                {cliente.nombre[0]}{cliente.apellido?.[0] ?? ''}
              </div>
              <h2 className="text-xl font-bold">{cliente.nombre} {cliente.apellido}</h2>
              <p className="text-teal-200 text-sm">{cliente.email}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <User size={16} className="text-gray-400"/>
                <span>Documento: <strong>{cliente.documento || 'No registrado'}</strong></span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <Calendar size={16} className="text-gray-400"/>
                <span>Registrado el: <strong>{fechaCorta(cliente.creadoEn)}</strong></span>
              </div>
            </div>
          </div>

          <div className="surface p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
            <div className="flex items-center gap-2 mb-2 text-amber-800">
              <Coins size={20} />
              <h3 className="font-bold">Puntos Cashback</h3>
            </div>
            <p className="text-4xl font-black text-amber-600 mb-1">{cliente.puntosAcumulados}</p>
            <p className="text-xs text-amber-700/70">Equivalentes a ${cliente.puntosAcumulados} COP</p>
          </div>
        </div>

        {/* Panel Derecho: Ventas recientes */}
        <div className="surface p-6">
          <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2"><ShoppingBag size={20} className="text-teal-600"/> Últimas Compras</h3>
            <span className="text-xs font-semibold bg-gray-100 px-2 py-1 rounded-md">{ventas.length} registros</span>
          </div>

          {ventas.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              Este cliente aún no tiene historial de compras.
            </div>
          ) : (
            <div className="space-y-4">
              {ventas.map((v: any) => (
                <VentaCard key={v.numero} venta={v} cop={cop} fechaCorta={fechaCorta} />
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  )
}

function VentaCard({ venta: v, cop, fechaCorta }: { venta: any; cop: (n: number) => string; fechaCorta: (d: string) => string }) {
  const [expandida, setExpandida] = useState(false)
  const detalles = v.detalles ?? []

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden transition-colors">
      <button
        onClick={() => setExpandida(!expandida)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors"
        aria-expanded={expandida}
      >
        <div className="flex gap-4 items-center">
          <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center text-teal-700">
            <CreditCard size={18} />
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-800 text-sm">Factura #F-{String(v.numero).padStart(5, '0')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{fechaCorta(v.creadoEn)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-bold text-teal-700">{cop(Number(v.total))}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${v.estado === 'PAGADO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{v.estado}</span>
          </div>
          {detalles.length > 0 && (
            expandida ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Productos de la factura */}
      {expandida && detalles.length > 0 && (
        <div className="px-4 pb-4 animate-fade-in">
          <div className="border-t border-gray-200 pt-3 mt-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Package size={12} /> Productos ({detalles.length})
            </p>
            <div className="space-y-1.5">
              {detalles.map((d: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <div>
                    <p className="font-medium text-gray-800">{d.producto?.nombre ?? 'Producto'}{d.producto?.concentracion ? ` ${d.producto.concentracion}` : ''}</p>
                    <p className="text-[10px] text-gray-400">{d.producto?.presentacion ?? ''} · {d.cantidad} ud(s)</p>
                  </div>
                  <p className="font-semibold text-teal-700">{cop(Number(d.precioUnitario) * d.cantidad)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
