import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock3, Landmark, Receipt, WalletCards, X, Save } from 'lucide-react'
import { cajaService } from '@/services'
import { useFormateo } from '@/hooks'
import toast from 'react-hot-toast'

export default function HistorialCaja() {
  const { cop, fechaHora } = useFormateo()
  const qc = useQueryClient()
  
  const [modalCierre, setModalCierre] = useState(false)
  const [cierreForm, setCierreForm] = useState({ totalEfectivo: 0, totalTarjeta: 0, totalOnline: 0, observaciones: '' })

  const { data: cajaActual } = useQuery({
    queryKey: ['caja', 'actual'],
    queryFn: cajaService.estadoActual,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['caja', 'historial'],
    queryFn: cajaService.historial,
  })

  const cajas = useMemo(() => (data ?? []) as any[], [data])
  const totalCajas = cajas.length
  const totalVentas = cajas.reduce((acc, caja) => acc + Number(caja.totalVentas ?? 0), 0)
  const totalDiferencia = cajas.reduce((acc, caja) => acc + Number(caja.diferencia ?? 0), 0)

  // Mutación para cerrar la caja
  const cerrarCajaMutation = useMutation({
    mutationFn: () => {
      const montoCierre = Number(cierreForm.totalEfectivo) + Number(cierreForm.totalTarjeta) + Number(cierreForm.totalOnline)
      return cajaService.cerrarCaja(cajaActual.id, {
        montoCierre,
        totalEfectivo: Number(cierreForm.totalEfectivo),
        totalTarjeta: Number(cierreForm.totalTarjeta),
        totalOnline: Number(cierreForm.totalOnline),
        observaciones: cierreForm.observaciones
      })
    },
    onSuccess: (data) => {
      toast.success(data.diferencia === 0 ? 'Caja cuadrada perfectamente' : `Caja cerrada con diferencia de ${cop(data.diferencia)}`)
      setModalCierre(false)
      qc.invalidateQueries({ queryKey: ['caja'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al cerrar caja')
    }
  })

  const totalCalculado = Number(cierreForm.totalEfectivo) + Number(cierreForm.totalTarjeta) + Number(cierreForm.totalOnline)

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Banner de Caja Actual */}
      {cajaActual ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-emerald-800 font-bold text-lg">Turno Activo</h2>
            </div>
            <p className="text-emerald-700 text-sm mt-1">Caja abierta el {fechaHora(cajaActual.abiertaEn)} con base de {cop(Number(cajaActual.montoApertura))}</p>
          </div>
          <button onClick={() => setModalCierre(true)} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition shadow-sm">
            Realizar Cierre de Caja
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <h2 className="text-slate-700 font-bold text-lg">Caja Cerrada</h2>
            <p className="text-slate-500 text-sm mt-1">No hay ningún turno activo en este momento.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="surface p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border">
          <div className="flex items-center gap-3 text-teal-700 dark:text-teal-400"><Landmark className="w-5 h-5" /><span className="text-sm font-semibold">Cajas registradas</span></div>
          <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-dark-text">{totalCajas}</p>
        </div>
        <div className="surface p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border">
          <div className="flex items-center gap-3 text-teal-700 dark:text-teal-400"><Receipt className="w-5 h-5" /><span className="text-sm font-semibold">Ventas en historial</span></div>
          <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-dark-text">{cop(totalVentas)}</p>
        </div>
        <div className="surface p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border">
          <div className="flex items-center gap-3 text-teal-700 dark:text-teal-400"><WalletCards className="w-5 h-5" /><span className="text-sm font-semibold">Descuadre acumulado</span></div>
          <p className={`mt-3 text-3xl font-bold ${totalDiferencia < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{cop(totalDiferencia)}</p>
        </div>
      </section>

      {/* Tabla Historial */}
      <section className="surface overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-slate-900">Movimientos de caja</h2><p className="text-sm text-slate-500">Ordenado por apertura más reciente</p></div>
          <Clock3 className="w-5 h-5 text-teal-700" />
        </div>          {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-dark-text/60">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Cargando historial...
          </div>
        ) : cajas.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-dark-text/60">Aún no hay registros de caja.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 dark:bg-dark-surface text-slate-500 dark:text-dark-text/60 uppercase text-[11px] tracking-[0.18em]">
                <tr>
                  <th className="px-5 py-3 text-left">Apertura</th>
                  <th className="px-5 py-3 text-left">Cierre</th>
                  <th className="px-5 py-3 text-left">Empleado / Sede</th>
                  <th className="px-5 py-3 text-right">Monto Inicial</th>
                  <th className="px-5 py-3 text-right">Ventas Sistema</th>
                  <th className="px-5 py-3 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-border bg-white dark:bg-dark-surface">
                {cajas.map((caja) => (
                  <tr key={caja.id} className="hover:bg-slate-50/70 dark:hover:bg-dark-surface/80 transition-colors">
                    <td className="px-5 py-4 text-slate-700 font-medium">{fechaHora(caja.abiertaEn)}</td>
                    <td className="px-5 py-4 text-slate-600">{caja.cerradaEn ? fechaHora(caja.cerradaEn) : <span className="text-emerald-600 font-semibold">Turno Activo</span>}</td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{caja.empleado ? `${caja.empleado.nombre} ${caja.empleado.apellido}` : 'Sistema'}</div>
                      <div className="text-xs text-slate-500">{caja.sucursal?.nombre ?? 'Sin sede'}</div>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-600">{cop(Number(caja.montoApertura ?? 0))}</td>
                    <td className="px-5 py-4 text-right font-medium">{caja.cerradaEn ? cop(Number(caja.totalVentas ?? 0)) : '—'}</td>
                    <td className="px-5 py-4 text-right">
                      {caja.cerradaEn ? (
                        <span className={`font-bold px-2 py-1 rounded-md ${Number(caja.diferencia ?? 0) === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                          {cop(Number(caja.diferencia ?? 0))}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Cierre de Caja */}
      {modalCierre && cajaActual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Arqueo y Cierre de Caja</h2>
              <button onClick={() => setModalCierre(false)} className="text-gray-400 hover:text-gray-700"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 mb-4">Ingresa los montos físicos contados al final del turno. El sistema calculará el descuadre automáticamente basado en las ventas.</p>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Efectivo en gaveta</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input type="number" min="0" value={cierreForm.totalEfectivo} onChange={(e) => setCierreForm({...cierreForm, totalEfectivo: Number(e.target.value)})} className="input-base pl-7 font-mono text-lg" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Pagos Tarjeta</label>
                  <input type="number" min="0" value={cierreForm.totalTarjeta} onChange={(e) => setCierreForm({...cierreForm, totalTarjeta: Number(e.target.value)})} className="input-base font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Pagos Online</label>
                  <input type="number" min="0" value={cierreForm.totalOnline} onChange={(e) => setCierreForm({...cierreForm, totalOnline: Number(e.target.value)})} className="input-base font-mono" />
                </div>
              </div>

              <div className="pt-3 border-t border-dashed border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-600">Total Arqueo:</span>
                  <span className="text-xl font-bold text-teal-700">{cop(totalCalculado)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 mt-2">Observaciones (Opcional)</label>
                <textarea rows={2} value={cierreForm.observaciones} onChange={(e) => setCierreForm({...cierreForm, observaciones: e.target.value})} className="input-base resize-none text-sm" placeholder="Ej. Faltante por dar devueltas erróneas..." />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button onClick={() => setModalCierre(false)} className="flex-1 btn-secondary justify-center">Cancelar</button>
              <button onClick={() => cerrarCajaMutation.mutate()} disabled={cerrarCajaMutation.isPending} className="flex-1 btn-primary justify-center bg-red-600 hover:bg-red-700">
                <Save size={16}/> {cerrarCajaMutation.isPending ? 'Cerrando...' : 'Confirmar Cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
