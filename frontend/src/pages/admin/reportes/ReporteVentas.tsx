import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Calendar, Download, Filter, Clock } from 'lucide-react'
import { reportesService } from '@/services'
import { useFormateo } from '@/hooks'
import { ESTADO_VENTA_LABEL, METODO_PAGO_LABEL } from '@/config/constants'
import toast from 'react-hot-toast'

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}

export default function ReporteVentas() {
  const { fechaCorta } = useFormateo()
  const hoy = new Date().toISOString().split('T')[0]
  const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [desde, setDesde] = useState(hace30dias)
  const [hasta, setHasta] = useState(hoy)
  const [sucursalId, setSucursalId] = useState<number | undefined>(undefined)
  const [pestana, setPestana] = useState<'todas' | 'pendientes' | 'pagadas'>('todas')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reportes', 'ventas', { desde, hasta, sucursalId }],
    queryFn: () => reportesService.ventas({ desde, hasta, sucursalId }),
  })

  if (isLoading) return (
    <div className="p-10 flex justify-center">
      <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  if (isError) return (
    <div className="p-10 text-center">
      <div className="inline-flex items-center gap-3 px-6 py-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
        <span>⚠️ Error al cargar el reporte de ventas</span>
      </div>
    </div>
  )

  const todasVentas = data?.ventas ?? []
  const ventasFiltradas = pestana === 'todas' ? todasVentas
    : todasVentas.filter((v: any) => v.estado === (pestana === 'pendientes' ? 'PENDIENTE' : 'PAGADO'))

  const totalVentas = data?.totalVentas ?? 0
  const montoTotal = data?.montoTotal ?? 0
  const ticketPromedio = totalVentas > 0 ? montoTotal / totalVentas : 0
  const clientesUnicos = data?.clientesUnicos ?? 0
  const pendientes = todasVentas.filter((v: any) => v.estado === 'PENDIENTE')
  const montoPendiente = pendientes.reduce((sum: number, v: any) => sum + Number(v.total), 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte de Ventas</h1>
          <p className="text-sm text-gray-500 mt-1">Análisis de facturación por periodo</p>
        </div>
        <button
          onClick={async () => {
            try {
              const blob = await reportesService.exportarCSV('ventas', { desde, hasta, sucursalId })
              const url = URL.createObjectURL(blob as Blob)
              const a = document.createElement('a')
              a.href = url; a.download = `reporte-ventas-${desde}-a-${hasta}.csv`
              document.body.appendChild(a); a.click()
              document.body.removeChild(a); URL.revokeObjectURL(url)
            } catch { toast.error('Error al exportar CSV') }
          }}
          className="btn-secondary text-sm flex items-center gap-2 self-start"
        >
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="surface p-4 flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 text-gray-500"><Filter size={16} /> Filtros:</div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="input-base text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="input-base text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sucursal</label>
          <select value={sucursalId ?? ''} onChange={e => setSucursalId(e.target.value ? Number(e.target.value) : undefined)}
            className="input-base text-sm">
            <option value="">Todas</option>
            {data?.sucursales?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {[{ key: 'todas' as const, label: 'Todas', count: todasVentas.length },
          { key: 'pendientes' as const, label: 'Pendientes', count: pendientes.length },
          { key: 'pagadas' as const, label: 'Pagadas', count: todasVentas.filter((v: any) => v.estado === 'PAGADO').length }].map(tab => (
          <button key={tab.key} onClick={() => setPestana(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              pestana === tab.key
                ? 'bg-white shadow-sm text-teal-700'
                : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="surface p-5">
          <div className="flex items-center gap-3 text-teal-700 mb-3"><DollarSign size={18} /><span className="text-sm font-semibold">Facturación</span></div>
          <p className="text-2xl font-bold text-slate-900">{formatCOP(montoTotal)}</p>
          <p className="text-xs text-gray-500 mt-1">Período seleccionado</p>
        </div>
        <div className="surface p-5">
          <div className="flex items-center gap-3 text-blue-700 mb-3"><ShoppingCart size={18} /><span className="text-sm font-semibold">Ventas</span></div>
          <p className="text-2xl font-bold text-slate-900">{totalVentas}</p>
          <p className="text-xs text-gray-500 mt-1">Transacciones realizadas</p>
        </div>
        <div className="surface p-5">
          <div className="flex items-center gap-3 text-amber-700 mb-3"><TrendingUp size={18} /><span className="text-sm font-semibold">Ticket Promedio</span></div>
          <p className="text-2xl font-bold text-slate-900">{formatCOP(ticketPromedio)}</p>
          <p className="text-xs text-gray-500 mt-1">Por transacción</p>
        </div>
        <div className="surface p-5">
          <div className="flex items-center gap-3 text-purple-700 mb-3"><Users size={18} /><span className="text-sm font-semibold">Clientes</span></div>
          <p className="text-2xl font-bold text-slate-900">{clientesUnicos}</p>
          <p className="text-xs text-gray-500 mt-1">Clientes atendidos</p>
        </div>
        <div className="surface p-5 border-2 border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-3 text-amber-700 mb-3"><Clock size={18} /><span className="text-sm font-semibold">Por cobrar</span></div>
          <p className="text-2xl font-bold text-amber-900">{formatCOP(montoPendiente)}</p>
          <p className="text-xs text-amber-600 mt-1">{pendientes.length} venta{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Tabla de Ventas Recientes */}
      <div className="surface overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">
            {pestana === 'todas' ? 'Todas las ventas' : pestana === 'pendientes' ? 'Ventas pendientes de cobro' : 'Ventas pagadas'}
          </h2>
          <span className="text-xs text-gray-400">{ventasFiltradas.length} registros</span>
        </div>

        {!data?.ventas?.length ? (
          <div className="p-8 text-center text-gray-400">
            <ShoppingCart size={40} className="mx-auto mb-3 text-gray-200" />
            <p>{pestana === 'pendientes' ? 'No hay ventas pendientes en el período seleccionado.' : 'No hay ventas en el período seleccionado.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-white text-slate-500 uppercase text-[11px] tracking-[0.18em]">
                <tr>
                  <th className="px-5 py-3 text-left">Factura</th>
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-5 py-3 text-left">Cliente</th>
                  <th className="px-5 py-3 text-center">Método</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {ventasFiltradas.map((venta: any) => (
                  <tr key={venta.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-mono font-medium text-gray-700">{venta.factura}</td>
                    <td className="px-5 py-4 text-gray-600">{fechaCorta(venta.fecha)}</td>
                    <td className="px-5 py-4 font-medium text-gray-900">{venta.cliente?.nombre ?? 'Mostrador'}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-xs text-gray-500">{METODO_PAGO_LABEL[venta.metodoPago] ?? venta.metodoPago}</span>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">{formatCOP(venta.total)}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold
                        ${venta.estado === 'PAGADO' || venta.estado === 'COMPLETADO' ? 'bg-green-50 text-green-700 border border-green-200'
                        : venta.estado === 'PENDIENTE' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : venta.estado === 'DEVUELTO' ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                        {ESTADO_VENTA_LABEL[venta.estado] ?? venta.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumen por método de pago */}
      {data?.porMetodoPago?.length > 0 && (
        <div className="surface p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Distribución por método de pago</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {data.porMetodoPago.map((item: any) => (
              <div key={item.metodoPago} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700">{METODO_PAGO_LABEL[item.metodoPago] ?? item.metodoPago}</span>
                <span className="text-sm font-bold text-gray-900">{formatCOP(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
