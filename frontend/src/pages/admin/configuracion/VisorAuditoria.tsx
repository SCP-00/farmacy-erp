import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search, Filter, Clock, Shield, Activity,
  Download, RefreshCw,
} from 'lucide-react'
import { auditoriaService } from '@/services'
import { useFormateo } from '@/hooks'

const ACCION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-50 text-green-700 border-green-200',
  LOGOUT: 'bg-gray-50 text-gray-600 border-gray-200',
  LOGIN_FALLIDO: 'bg-red-50 text-red-700 border-red-200',
  ACCESO_DENEGADO_RBAC: 'bg-red-50 text-red-700 border-red-200',
  CREAR: 'bg-blue-50 text-blue-700 border-blue-200',
  ACTUALIZAR: 'bg-amber-50 text-amber-700 border-amber-200',
  ELIMINAR: 'bg-red-50 text-red-700 border-red-200',
  VENTA: 'bg-teal-50 text-teal-700 border-teal-200',
  APERTURA_CAJA: 'bg-purple-50 text-purple-700 border-purple-200',
  CIERRE_CAJA: 'bg-purple-50 text-purple-700 border-purple-200',
  DEVOLUCION: 'bg-orange-50 text-orange-700 border-orange-200',
}

const ACCION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio Sesión',
  LOGOUT: 'Cierre Sesión',
  LOGIN_FALLIDO: 'Login Fallido',
  ACCESO_DENEGADO_RBAC: 'Acceso Denegado',
  CREAR: 'Creación',
  ACTUALIZAR: 'Actualización',
  ELIMINAR: 'Eliminación',
  VENTA: 'Venta',
  APERTURA_CAJA: 'Apertura Caja',
  CIERRE_CAJA: 'Cierre Caja',
  DEVOLUCION: 'Devolución',
}

export default function VisorAuditoria() {
  const { fechaHora } = useFormateo()
  const hoy = new Date().toISOString().split('T')[0]
  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [desde, setDesde] = useState(hace7dias)
  const [hasta, setHasta] = useState(hoy)
  const [accion, setAccion] = useState('')
  const [modulo, setModulo] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['auditoria', 'logs', { desde, hasta, accion, modulo, busqueda, pagina }],
    queryFn: () => auditoriaService.listarLogs({ desde, hasta, accion: accion || undefined, modulo: modulo || undefined, q: busqueda || undefined, pagina }),
    placeholderData: (prev) => prev,
  })

  const { data: accionesData } = useQuery({
    queryKey: ['auditoria', 'acciones'],
    queryFn: () => auditoriaService.listarAcciones(),
    staleTime: 1000 * 60 * 5,
  })

  const registros = (data as any)?.data ?? []
  const meta = (data as any)?.meta ?? { pagina: 1, total: 0, totalPaginas: 1, limite: 20 }
  const acciones = (accionesData as any)?.data ?? []

  const exportarCSV = () => {
    if (!registros.length) return
    let csv = 'Fecha,Empleado,Email,Rol,Acción,Módulo,IP\n'
    for (const r of registros) {
      const emp = r.empleado ? `${r.empleado.nombre} ${r.empleado.apellido}` : 'Sistema'
      const email = r.empleado?.email ?? ''
      const rol = r.empleado?.rol ?? ''
      csv += `${r.creadoEn},${emp},${email},${rol},${r.accion},${r.modulo ?? ''},${r.ip ?? ''}\n`
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `auditoria-${desde}-a-${hasta}.csv`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visor de Auditoría</h1>
          <p className="text-sm text-gray-500 mt-1">Registro detallado de actividad del sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={isFetching}
            className="btn-secondary text-sm flex items-center gap-2">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button onClick={exportarCSV}
            className="btn-secondary text-sm flex items-center gap-2">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Filter size={14} /> Filtros:</div>
          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Desde</label>
            <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPagina(1) }}
              className="input-base text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Hasta</label>
            <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPagina(1) }}
              className="input-base text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Acción</label>
            <select value={accion} onChange={e => { setAccion(e.target.value); setPagina(1) }}
              className="input-base text-sm min-w-[140px]">
              <option value="">Todas</option>
              {acciones.map((a: any) => (
                <option key={a.accion} value={a.accion}>
                  {ACCION_LABELS[a.accion] ?? a.accion} ({a.total})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Módulo</label>
            <input type="text" value={modulo} onChange={e => { setModulo(e.target.value); setPagina(1) }}
              placeholder="auth, productos..."
              className="input-base text-sm w-32" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-0.5">Buscar</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
                placeholder="Email, IP..."
                className="input-base text-sm pl-8 w-40" />
            </div>
          </div>
          {(desde !== hace7dias || hasta !== hoy || accion || modulo || busqueda) && (
            <button onClick={() => { setDesde(hace7dias); setHasta(hoy); setAccion(''); setModulo(''); setBusqueda(''); setPagina(1) }}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium pb-0.5">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="surface overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <Activity size={15} className="text-teal-600" />
            Registros de actividad
          </h2>
          <span className="text-xs text-gray-400">{meta.total ?? 0} registros</span>
        </div>

        {isLoading ? (
          <div className="p-10 flex justify-center">
            <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-500">
            Error al cargar registros de auditoría
          </div>
        ) : !registros.length ? (
          <div className="p-8 text-center text-gray-400">
            <Shield size={40} className="mx-auto mb-3 text-gray-200" />
            <p>No hay registros de actividad para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-white text-slate-500 uppercase text-[11px] tracking-[0.18em]">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Empleado</th>
                  <th className="px-4 py-3 text-left">Acción</th>
                  <th className="px-4 py-3 text-left">Módulo</th>
                  <th className="px-4 py-3 text-right">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {registros.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {fechaHora(r.creadoEn)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.empleado ? (
                          <>
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                              {r.empleado.nombre.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {r.empleado.nombre} {r.empleado.apellido}
                              </p>
                              <p className="text-[10px] text-gray-400">{r.empleado.email}</p>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Shield size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-500">Sistema</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${ACCION_COLORS[r.accion] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {ACCION_LABELS[r.accion] ?? r.accion}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded">
                        {r.modulo ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[10px] font-mono text-gray-400">{r.ip ?? '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {meta.totalPaginas > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Página {meta.pagina} de {meta.totalPaginas}
            </span>
            <div className="flex gap-2">
              <button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}
                className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">
                Anterior
              </button>
              <button disabled={pagina >= meta.totalPaginas} onClick={() => setPagina(p => p + 1)}
                className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
