import { useQuery, useMutation } from '@tanstack/react-query'
import { Package, Calendar, Truck, Tag, Coins } from 'lucide-react'
import { clientesService } from '@/services'
import { useFormateo } from '@/hooks'
import toast from 'react-hot-toast'
import SEOHead from '@/components/shared/SEOHead'

export default function MisPedidos() {
  const { cop, fechaCorta } = useFormateo()
  const { data: pedidos = [], isLoading } = useQuery({ 
    queryKey: ['cliente','pedidos'], 
    queryFn: clientesService.misPedidos 
  })

  const mutation = useMutation({
    mutationFn: ({ id, motivo }: any) => clientesService.solicitarDevolucion(id, motivo),
    onSuccess: () => {
      toast.success('Solicitud de devolución enviada a nuestro equipo de soporte')
    },
    onError: () => toast.error('Error al solicitar devolución'),
  })

  if (isLoading) {
    return (
      <>
        <SEOHead title="Mis pedidos" description="Historial de tus compras en Farmacy. Consulta el estado de tus pedidos y solicita devoluciones." path="/cuenta/pedidos" />
        <div className="section-shell py-12 flex justify-center">
          <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    )
  }

  return (
    <>
      <SEOHead title="Mis pedidos" description="Historial de tus compras en Farmacy. Consulta el estado de tus pedidos y solicita devoluciones." path="/cuenta/pedidos" />
      <div className="section-shell py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Mis pedidos</h1>
      <p className="text-slate-500 mb-8">Historial de todas tus compras en Farmacy.</p>
      
      <div className="space-y-6">
        {pedidos.length === 0 ? (
          <div className="surface p-12 text-center">
            <Package className="w-16 h-16 mx-auto text-slate-200 mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Aún no has hecho pedidos</h2>
            <p className="text-slate-500">Cuando realices una compra, aparecerá aquí su estado.</p>
          </div>
        ) : (
          pedidos.map((p: any) => {
            const estadoPago = p.pagos?.[0]?.estado || p.estado
            const metodoPago = p.pagos?.[0]?.pasarela || p.metodoPago
            return (
            <div key={p.id} className="surface overflow-hidden">
              {/* ── Header: pedido, fecha, total, estado ──────────── */}
              <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-6 flex-wrap">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Pedido</p>
                    <p className="font-mono text-sm font-bold text-slate-900">#F-{String(p.numero).padStart(5, '0')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Fecha</p>
                    <p className="text-sm font-medium text-slate-900">{fechaCorta(p.creadoEn)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Total</p>
                    <p className="text-sm font-bold text-teal-700">{cop(Number(p.total))}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                    p.estado === 'PAGADO' || estadoPago === 'APROBADO' ? 'bg-green-100 text-green-700' :
                    p.estado === 'DEVUELTO' ? 'bg-red-100 text-red-700' :
                    estadoPago === 'RECHAZADO' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {p.estado === 'PENDIENTE' ? 'PENDIENTE' : p.estado}
                  </span>
                  
                  {(p.estado === 'PAGADO' || estadoPago === 'APROBADO') && (
                    <button 
                      onClick={() => {
                        const motivo = prompt('¿Cuál es el motivo de la devolución? (Ejem: Producto dañado, Vencido)')
                        if (motivo) mutation.mutate({ id: p.id, motivo })
                      }}
                      className="text-xs font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-red-200"
                    >
                      Devolver
                    </button>
                  )}
                </div>
              </div>

              {/* ── Productos ──────────────────────────────────── */}
              <div className="p-4 sm:p-5 border-b border-slate-100">
                <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Productos</p>
                <div className="divide-y divide-slate-100">
                  {p.detalles?.map((d: any) => (
                    <div key={d.id} className="py-2.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center text-lg flex-shrink-0">💊</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{d.producto?.nombre}</p>
                          <p className="text-xs text-slate-500">Cant: {d.cantidad} × {cop(Number(d.precioUnitario))}</p>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-900 whitespace-nowrap">{cop(Number(d.subtotal))}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Desglose de costos ─────────────────────────── */}
              <div className="p-4 sm:p-5 bg-white">
                <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Desglose</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal productos</span>
                    <span className="font-medium">{cop(Number(p.subtotal))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 items-center">
                    <span className="flex items-center gap-1"><Truck size={12} /> Envío</span>
                    {Number(p.costoEnvio) > 0 ? (
                      <span className="font-medium">{cop(Number(p.costoEnvio))}</span>
                    ) : (
                      <span className="text-green-600 font-semibold text-xs bg-green-50 px-2 py-0.5 rounded-full">Gratis</span>
                    )}
                  </div>
                  {Number(p.descuento) > 0 && (
                    <div className="flex justify-between text-teal-600 font-medium">
                      <span className="flex items-center gap-1"><Tag size={12} /> Descuento</span>
                      <span>-{cop(Number(p.descuento))}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-200">
                  <span className="font-bold text-slate-900">Total pagado</span>
                  <span className="text-lg font-bold text-teal-700">{cop(Number(p.total))}</span>
                </div>

                {/* ── Estado del pago ──────────────────────────── */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Coins size={12} /> Pago: <strong className="text-slate-700">{metodoPago}</strong>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    estadoPago === 'APROBADO' || p.estado === 'PAGADO' ? 'bg-green-100 text-green-700' :
                    estadoPago === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {estadoPago}
                  </span>
                </div>
              </div>
            </div>
            )
          })
        )}
      </div>
    </div>
    </>
  )
}
