import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, DollarSign, Truck, TrendingUp, Filter } from 'lucide-react'
import { reportesService } from '@/services'
import { useFormateo } from '@/hooks'

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}

export default function ReporteCompras() {
  const { fechaCorta } = useFormateo()
  const hoy = new Date().toISOString().split('T')[0]
  const hace90dias = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [desde, setDesde] = useState(hace90dias)
  const [hasta, setHasta] = useState(hoy)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reportes', 'compras', { desde, hasta }],
    queryFn: () => reportesService.compras({ desde, hasta }),
  })

  if (isLoading) return (
    <div className="p-10 flex justify-center">
      <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  if (isError) return (
    <div className="p-10 text-center">
      <div className="inline-flex items-center gap-3 px-6 py-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
        <span>⚠️ Error al cargar el reporte de compras</span>
      </div>
    </div>
  )

  const totalOrdenes = data?.totalOrdenes ?? 0
  const montoTotal = data?.montoTotal ?? 0
  const ordenesPendientes = (data?.ordenes ?? []).filter((o: any) => o.estado === 'PENDIENTE' || o.estado === 'ENVIADA').length

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reporte de Compras</h1>
        <p className="text-sm text-gray-500 mt-1">Órdenes de compra a proveedores</p>
      </div>

      <div className="surface p-4 flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 text-gray-500"><Filter size={16} /> Filtros:</div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="input-base text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="input-base text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface p-5">
          <div className="flex items-center gap-3 text-teal-700 mb-3"><Package size={18} /><span className="text-sm font-semibold">Órdenes</span></div>
          <p className="text-2xl font-bold text-slate-900">{totalOrdenes}</p>
          <p className="text-xs text-gray-500 mt-1">Total del período</p>
        </div>
        <div className="surface p-5">
          <div className="flex items-center gap-3 text-blue-700 mb-3"><DollarSign size={18} /><span className="text-sm font-semibold">Inversión</span></div>
          <p className="text-2xl font-bold text-slate-900">{formatCOP(montoTotal)}</p>
          <p className="text-xs text-gray-500 mt-1">Valor total comprado</p>
        </div>
        <div className="surface p-5 bg-amber-50 border-amber-100">
          <div className="flex items-center gap-3 text-amber-700 mb-3"><Truck size={18} /><span className="text-sm font-semibold">Pendientes</span></div>
          <p className="text-2xl font-bold text-amber-600">{ordenesPendientes}</p>
          <p className="text-xs text-amber-700/70 mt-1">Por recibir</p>
        </div>
        <div className="surface p-5">
          <div className="flex items-center gap-3 text-indigo-700 mb-3"><TrendingUp size={18} /><span className="text-sm font-semibold">Promedio</span></div>
          <p className="text-2xl font-bold text-slate-900">{totalOrdenes > 0 ? formatCOP(montoTotal / totalOrdenes) : '$0'}</p>
          <p className="text-xs text-gray-500 mt-1">Por orden</p>
        </div>
      </div>

      <div className="surface overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Órdenes de compra</h2>
          <span className="text-xs text-gray-400">{totalOrdenes} registros</span>
        </div>

        {!data?.ordenes?.length ? (
          <div className="p-8 text-center text-gray-400">
            <Package size={40} className="mx-auto mb-3 text-gray-200" />
            <p>No hay órdenes de compra en el período seleccionado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-white text-slate-500 uppercase text-[11px] tracking-[0.18em]">
                <tr>
                  <th className="px-5 py-3 text-left">Orden</th>
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-5 py-3 text-left">Proveedor</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(data?.ordenes ?? []).map((orden: any) => (
                  <tr key={orden.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-mono font-medium text-gray-700">{orden.codigo}</td>
                    <td className="px-5 py-4 text-gray-600">{fechaCorta(orden.fechaOrden ?? orden.createdAt)}</td>
                    <td className="px-5 py-4 font-medium text-gray-900">{orden.proveedor?.nombre}</td>
                    <td className="px-5 py-4 text-right font-semibold">{formatCOP(Number(orden.total) || 0)}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold
                        ${orden.estado === 'RECIBIDA' ? 'bg-green-50 text-green-700 border border-green-200'
                        : orden.estado === 'ENVIADA' ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {orden.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
