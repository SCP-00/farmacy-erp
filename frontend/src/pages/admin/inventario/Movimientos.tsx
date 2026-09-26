import { useState, useEffect } from 'react'
import { Filter, Package, User, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { inventarioService } from '@/services'
import { useFormateo } from '@/hooks'

const TIPO_MOVIMIENTO_LABEL: Record<string, string> = {
  AJUSTE_POSITIVO: 'Entrada por ajuste',
  AJUSTE_NEGATIVO: 'Salida por ajuste',
  VENTA: 'Venta',
  COMPRA: 'Compra',
  DEVOLUCION: 'Devolución',
  PERDIDA: 'Pérdida',
  DANO: 'Daño',
  VENCIMIENTO: 'Vencimiento',
  ERROR_DIGITACION: 'Error de digitación',
  INVENTARIO_FISICO: 'Inventario físico',
  OTRO: 'Otro',
}

export default function Movimientos() {
  const { fechaHora } = useFormateo()
  const [movs, setMovs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)

  const fetchMovimientos = async () => {
    setLoading(true)
    try {
      const params: any = { pagina, limite: 20 }
      if (filtroTipo) params.tipo = filtroTipo
      const data = await inventarioService.movimientos(params)
      setMovs(data.data || data)
      setTotalPaginas(data.meta?.totalPaginas ?? 1)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al cargar movimientos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMovimientos()
  }, [pagina, filtroTipo])

  const getColorPorTipo = (tipo: string) => {
    if (tipo === 'AJUSTE_POSITIVO' || tipo === 'COMPRA' || tipo === 'DEVOLUCION') return 'text-green-600 bg-green-50 border-green-200'
    if (tipo === 'AJUSTE_NEGATIVO' || tipo === 'VENTA') return 'text-blue-600 bg-blue-50 border-blue-200'
    if (['PERDIDA', 'DANO', 'VENCIMIENTO'].includes(tipo)) return 'text-red-600 bg-red-50 border-red-200'
    return 'text-gray-600 bg-gray-50 border-gray-200'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Movimientos de inventario</h1>
        <p className="text-gray-500 text-sm mt-1">
          Auditoría de entradas, salidas y ajustes realizados por usuario.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter size={16} />
          <span>Filtrar:</span>
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => { setFiltroTipo(e.target.value); setPagina(1) }}
          className="input-base text-sm py-1.5 w-auto"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_MOVIMIENTO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Timeline de movimientos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Cargando movimientos...
          </div>
        ) : movs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <FileText size={40} className="mx-auto mb-3 text-gray-200" />
            <p>No hay movimientos registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {movs.map((mov: any) => (
              <div key={mov.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Indicador visual izquierdo */}
                  <div className="hidden sm:flex flex-col items-center pt-1">
                    <div className={`w-3 h-3 rounded-full border-2 ${getColorPorTipo(mov.tipo).split(' ').slice(1).join(' ')}`} />
                    <div className="w-0.5 h-full bg-gray-100 mt-1" />
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getColorPorTipo(mov.tipo)}`}>
                            {TIPO_MOVIMIENTO_LABEL[mov.tipo] ?? mov.tipo}
                          </span>
                          {mov.cantidad && (
                            <span className={`text-sm font-bold ${mov.tipo?.includes('POSITIVO') || mov.tipo === 'COMPRA' || mov.tipo === 'DEVOLUCION' ? 'text-green-600' : 'text-red-500'}`}>
                              {mov.tipo?.includes('POSITIVO') || mov.tipo === 'COMPRA' || mov.tipo === 'DEVOLUCION' ? '+' : '-'}{mov.cantidad} uds
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-1.5">{mov.motivo ?? mov.descripcion ?? 'Sin descripción'}</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{fechaHora(mov.creadoEn)}</span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {mov.lote && (
                        <span className="flex items-center gap-1">
                          <Package size={12} />
                          {mov.lote.producto?.nombre} — Lote {mov.lote.codigoLote}
                        </span>
                      )}
                      {mov.empleado && (
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {mov.empleado.nombre}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <button
              disabled={pagina <= 1}
              onClick={() => setPagina(p => p - 1)}
              className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <span className="text-xs text-gray-500">Pág. {pagina} de {totalPaginas}</span>
            <button
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina(p => p + 1)}
              className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
