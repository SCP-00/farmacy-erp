import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, FileText, AlertTriangle,
  Pill, FlaskConical, Eye,
  Hash, Activity, Syringe, Package,
  History, RotateCcw, Clock,
} from 'lucide-react'
import { productosService, auditoriaService } from '@/services'
import { useFormateo } from '@/hooks'

// ── Subcomponente: Historial de Cambios ─────────────────
function HistorialCambios({ productoId }: { productoId: string }) {
  const { fechaHora } = useFormateo()

  const { data: cambiosData, isLoading } = useQuery({
    queryKey: ['admin', 'producto', productoId, 'historial-cambios'],
    queryFn: () => auditoriaService.historialCambios(productoId),
    enabled: !!productoId,
  })

  const cambios = (cambiosData as any)?.data ?? []

  const CAMPOS_LABELS: Record<string, string> = {
    precioVenta: 'Precio Venta',
    precioPromedio: 'Precio Promedio',
    stockMinimo: 'Stock Mínimo',
    nombre: 'Nombre',
    requiereRx: 'Requiere RX',
    activo: 'Activo',
    laboratorio: 'Laboratorio',
    presentacion: 'Presentación',
    concentracion: 'Concentración',
    descripcion: 'Descripción',
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
        <History size={15} className="text-teal-700" /> Historial de Cambios
      </h2>

      {isLoading ? (
        <div className="py-4 flex justify-center">
          <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !cambios.length ? (
        <div className="py-4 text-center text-xs text-gray-400">
          <RotateCcw size={24} className="mx-auto mb-2 text-gray-200" />
          <p>No hay cambios registrados para este producto.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {cambios.slice(0, 20).map((c: any) => (
            <div key={c.id} className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-700">
                  {CAMPOS_LABELS[c.campo] ?? c.campo}
                </span>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock size={9} />{fechaHora(c.creadoEn)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-red-600 line-through bg-red-50 px-1.5 py-0.5 rounded">
                  {c.valorAnterior || '(vacío)'}
                </span>
                <span className="text-gray-400">→</span>
                <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                  {c.valorNuevo || '(vacío)'}
                </span>
              </div>
              {c.empleado && (
                <p className="text-[10px] text-gray-400">
                  por {c.empleado.nombre} {c.empleado.apellido}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DetalleProductoAdmin() {
  const { id } = useParams()
  const { cop } = useFormateo()

  const { data: producto, isLoading } = useQuery({
    queryKey: ['admin', 'producto', id],
    queryFn: () => productosService.obtener(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="py-20 text-center text-gray-500">
        Cargando información regulatoria del medicamento...
      </div>
    )
  }

  if (!producto) {
    return (
      <div className="section-shell py-12">
        <div className="surface p-8 text-center">
          <Package size={48} className="mx-auto text-gray-200 mb-3" />
          <h1 className="text-xl font-bold text-slate-900">Producto no encontrado</h1>
          <p className="mt-2 text-sm text-slate-500">
            El producto no existe o fue eliminado del sistema.
          </p>
          <Link to="/admin/inventario" className="btn-primary mt-6 inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Volver al inventario
          </Link>
        </div>
      </div>
    )
  }

  const fmtFecha = (f: string | null | undefined) => {
    if (!f) return 'No registrada'
    return new Date(f).toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  const listaAlergenos = producto.alergenos
    ? producto.alergenos.split(',').map((a: string) => a.trim())
    : []

  const stockTotal = producto.lotes?.reduce((sum: number, l: any) => sum + l.cantidadActual, 0) ?? 0
  const stockBajo = stockTotal <= producto.stockMinimo

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/inventario" className="btn-secondary !px-3 !py-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{producto.nombre}</h1>
          <p className="text-sm text-gray-400 flex items-center gap-2 mt-0.5">
            <Hash size={12} /> CUM: <span className="font-mono font-bold text-teal-700">{producto.cum}</span>
            <span className="mx-1">·</span>
            <FileText size={12} /> Registro: {producto.registroInvima}
          </p>
        </div>
      </div>

      {/* Estado Header */}
      <div className="flex flex-wrap gap-2">
        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
          producto.estadoCum === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          CUM: {producto.estadoCum}
        </span>
        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
          producto.estadoRegistro === 'Vigente' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          Registro: {producto.estadoRegistro || 'Vigente'}
        </span>
        {producto.esMuestraMedica && (
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800">
            🚫 Muestra Médica
          </span>
        )}
        {producto.requiereRx && (
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
            RX (Receta)
          </span>
        )}
        {stockBajo && (
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800">
            Stock Bajo
          </span>
        )}
      </div>

      {/* Grid de información */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Registro Sanitario */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <FileText size={16} className="text-teal-700" /> Registro Sanitario INVIMA
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs text-slate-700">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">Registro Sanitario:</span>
                <span className="font-semibold font-mono">{producto.registroInvima}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">Expediente:</span>
                <span className="font-semibold">{producto.expediente || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">Fecha Expedición:</span>
                <span className="font-semibold">{fmtFecha(producto.fechaExpedicion)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">Vencimiento:</span>
                <span className="font-semibold">{fmtFecha(producto.fechaVencimientoRegistro)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">Titular:</span>
                <span className="font-semibold">{producto.titular || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">Estado:</span>
                <span className={`font-semibold ${producto.estadoRegistro === 'Vigente' ? 'text-green-600' : 'text-red-600'}`}>
                  {producto.estadoRegistro || 'Vigente'}
                </span>
              </div>
            </div>
          </div>

          {/* CUM */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Hash size={16} className="text-teal-700" /> Código Único de Medicamento (CUM)
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs text-slate-700">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">CUM:</span>
                <span className="font-mono font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">{producto.cum}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">Estado CUM:</span>
                <span className={`font-semibold ${producto.estadoCum === 'Activo' ? 'text-green-600' : 'text-red-600'}`}>
                  {producto.estadoCum}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">Fecha Activación:</span>
                <span className="font-semibold">{fmtFecha(producto.fechaActivoCum)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">Fecha Inactivación:</span>
                <span className="font-semibold">{fmtFecha(producto.fechaInactivoCum)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50 col-span-2">
                <span className="text-slate-400">IUM:</span>
                <span className="font-mono font-semibold">{producto.ium || 'No asignado'}</span>
              </div>
            </div>
          </div>

          {/* Forma Farmacéutica */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Syringe size={16} className="text-teal-700" /> Forma Farmacéutica y Dosificación
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs text-slate-700">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400 flex items-center gap-1"><FlaskConical size={12} /> Forma:</span>
                <span className="font-semibold">{producto.formaFarmaceutica || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400 flex items-center gap-1"><Eye size={12} /> Vía Admin.:</span>
                <span className="font-semibold">{producto.viaAdministracion || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">Concentración:</span>
                <span className="font-semibold">{producto.concentracion || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">U. Medida:</span>
                <span className="font-semibold">{producto.unidadMedida || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">Cantidad:</span>
                <span className="font-semibold">{producto.cantidad || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-400">U. Referencia:</span>
                <span className="font-semibold">{producto.unidadReferencia || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50 col-span-2">
                <span className="text-slate-400">Modalidad:</span>
                <span className="font-semibold">{producto.modalidad || 'No registrada'}</span>
              </div>
            </div>
          </div>

          {/* Presentación */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Package size={16} className="text-teal-700" /> Presentación Comercial
            </h2>
            <p className="text-xs text-slate-700 leading-relaxed bg-teal-50 border border-teal-100 p-4 rounded-xl">
              {producto.presentacion || 'No registrada'}
            </p>
          </div>

          {/* Información Clínica */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Pill size={16} className="text-teal-700" /> Información Clínica
            </h2>
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Activity size={12} /> Principio Activo
              </h3>
              <p className="text-sm font-bold text-teal-800">{producto.principioActivo}</p>
              <div className="flex gap-2 mt-1">
                {producto.atc && (
                  <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-mono">
                    ATC: {producto.atc}
                  </span>
                )}
                {producto.descripcionAtc && (
                  <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                    {producto.descripcionAtc}
                  </span>
                )}
              </div>
            </div>
            {producto.indicaciones && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                <h3 className="text-xs font-bold text-blue-900 mb-1">Indicaciones Terapéuticas</h3>
                <p className="text-xs text-blue-800 leading-relaxed whitespace-pre-line">{producto.indicaciones}</p>
              </div>
            )}
            {producto.modoUso && (
              <div className="bg-green-50/50 border border-green-100 rounded-xl p-4">
                <h3 className="text-xs font-bold text-green-900 mb-1">Modo de Uso / Dosificación</h3>
                <p className="text-xs text-green-800 leading-relaxed whitespace-pre-line">{producto.modoUso}</p>
              </div>
            )}
            {producto.contraindicaciones && (
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-4">
                <h3 className="text-xs font-bold text-red-900 mb-1">Contraindicaciones</h3>
                <p className="text-xs text-red-800 leading-relaxed whitespace-pre-line">{producto.contraindicaciones}</p>
              </div>
            )}
            {producto.reaccionesAdversas && (
              <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-4">
                <h3 className="text-xs font-bold text-orange-900 mb-1">Reacciones Adversas</h3>
                <p className="text-xs text-orange-800 leading-relaxed whitespace-pre-line">{producto.reaccionesAdversas}</p>
              </div>
            )}
            {producto.interacciones && (
              <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4">
                <h3 className="text-xs font-bold text-purple-900 mb-1">Interacciones Medicamentosas</h3>
                <p className="text-xs text-purple-800 leading-relaxed whitespace-pre-line">{producto.interacciones}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Precio y Stock */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4">Comercial</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Precio Venta:</span>
                <span className="text-lg font-bold text-teal-700">{cop(producto.precioVenta)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Stock Total:</span>
                <span className={`font-bold ${stockBajo ? 'text-red-600' : 'text-gray-900'}`}>
                  {stockTotal} {stockBajo && '(Bajo)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stock Mínimo:</span>
                <span className="font-semibold">{producto.stockMinimo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Laboratorio:</span>
                <span className="font-semibold text-right">{producto.laboratorio || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Categoría:</span>
                <span className="font-semibold">{producto.categoria?.nombre || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Farmacovigilancia */}
          {(producto.alergenos || producto.advertencias) && (
            <div className="card p-5">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                <AlertTriangle size={14} className="text-amber-600" /> Farmacovigilancia
              </h2>
              {listaAlergenos.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Alérgenos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {listaAlergenos.map((al: string) => (
                      <span key={al} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold uppercase">
                        {al}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {producto.advertencias && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Advertencias</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{producto.advertencias}</p>
                </div>
              )}
            </div>
          )}

          {/* Lotes */}
          {producto.lotes && producto.lotes.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Lotes en Inventario</h2>
              <div className="space-y-2">
                {producto.lotes.map((lote: any) => (
                  <div key={lote.id} className="bg-slate-50 rounded-lg p-3 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="font-mono">{lote.codigoLote}</span>
                      <span className="text-teal-700">{lote.cantidadActual} uds</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Vence: {fmtFecha(lote.fechaVencimiento)} · {lote.sucursal?.nombre || ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial de Cambios */}
          <HistorialCambios productoId={producto.id} />

          {/* Metadatos */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Metadatos</h2>
            <div className="space-y-2 text-[10px] text-slate-400">
              <p>ID: <span className="font-mono">{producto.id}</span></p>
              <p>Slug: <span className="font-mono">{producto.slug}</span></p>
              {producto.descripcion && (
                <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded">{producto.descripcion}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
