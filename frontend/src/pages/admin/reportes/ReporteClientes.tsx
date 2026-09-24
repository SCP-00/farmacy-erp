import { useQuery } from '@tanstack/react-query'
import { Users, TrendingUp, Award, ShoppingBag } from 'lucide-react'
import { reportesService } from '@/services'
import { useFormateo } from '@/hooks'

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n)
}

export default function ReporteClientes() {
  const { fechaCorta } = useFormateo()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reportes', 'clientes'],
    queryFn: () => reportesService.ventas({ desde: '2020-01-01', hasta: new Date().toISOString().split('T')[0] }),
  })

  if (isLoading) return (
    <div className="p-10 flex justify-center">
      <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  if (isError) return (
    <div className="p-10 text-center">
      <div className="inline-flex items-center gap-3 px-6 py-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
        <span>⚠️ Error al cargar el reporte de clientes</span>
      </div>
    </div>
  )

  const clientesUnicos = data?.clientesUnicos ?? 0
  const totalVentas = data?.totalVentas ?? 0
  const montoTotal = data?.montoTotal ?? 0

  // Agrupar ventas por cliente para top clientes
  const ventas = data?.ventas ?? []
  const clientesMap = new Map<string, { nombre: string; total: number; compras: number }>()
  ventas.forEach((v: any) => {
    if (!v.cliente?.id) return
    const id = v.cliente.id
    const existente = clientesMap.get(id) ?? { nombre: v.cliente.nombre ?? 'Mostrador', total: 0, compras: 0 }
    existente.total += Number(v.total) || 0
    existente.compras += 1
    clientesMap.set(id, existente)
  })
  const topClientes = Array.from(clientesMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reporte de Clientes</h1>
        <p className="text-sm text-gray-500 mt-1">Análisis de comportamiento de compra</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface p-5">
          <div className="flex items-center gap-3 text-teal-700 mb-3"><Users size={18} /><span className="text-sm font-semibold">Clientes</span></div>
          <p className="text-2xl font-bold text-slate-900">{clientesUnicos}</p>
          <p className="text-xs text-gray-500 mt-1">Registrados con compras</p>
        </div>
        <div className="surface p-5">
          <div className="flex items-center gap-3 text-blue-700 mb-3"><ShoppingBag size={18} /><span className="text-sm font-semibold">Compras</span></div>
          <p className="text-2xl font-bold text-slate-900">{totalVentas}</p>
          <p className="text-xs text-gray-500 mt-1">Transacciones totales</p>
        </div>
        <div className="surface p-5">
          <div className="flex items-center gap-3 text-amber-700 mb-3"><TrendingUp size={18} /><span className="text-sm font-semibold">Facturación</span></div>
          <p className="text-2xl font-bold text-slate-900">{formatCOP(montoTotal)}</p>
          <p className="text-xs text-gray-500 mt-1">Generada por clientes</p>
        </div>
        <div className="surface p-5">
          <div className="flex items-center gap-3 text-purple-700 mb-3"><Award size={18} /><span className="text-sm font-semibold">Promedio</span></div>
          <p className="text-2xl font-bold text-slate-900">{clientesUnicos > 0 ? formatCOP(montoTotal / clientesUnicos) : '$0'}</p>
          <p className="text-xs text-gray-500 mt-1">Gasto por cliente</p>
        </div>
      </div>

      {/* Top Clientes */}
      <div className="surface overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-semibold text-gray-900">Top 10 clientes por facturación</h2>
        </div>

        {topClientes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Users size={40} className="mx-auto mb-3 text-gray-200" />
            <p>No hay clientes registrados con compras.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {topClientes.map(([id, cli], i) => (
              <div key={id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center gap-4">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i <= 2 ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-500'}`}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{cli.nombre}</p>
                    <p className="text-xs text-gray-400">{cli.compras} compra{cli.compras !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span className="font-bold text-gray-900">{formatCOP(cli.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clientes recientes */}
      <div className="surface p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Últimas compras de clientes</h2>
        {ventas.length === 0 ? (
          <p className="text-sm text-gray-400">No hay ventas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-white text-slate-500 uppercase text-[11px] tracking-[0.18em]">
                <tr>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Factura</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {ventas.slice(0, 20).map((v: any) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{v.cliente?.nombre ?? 'Mostrador'}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{v.factura}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fechaCorta(v.fecha)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCOP(Number(v.total) || 0)}</td>
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
