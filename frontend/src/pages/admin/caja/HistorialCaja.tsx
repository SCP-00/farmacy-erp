import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock3, Landmark, Receipt, WalletCards, X, Save, ArrowDownCircle, ArrowUpCircle, Plus, Scale, Settings } from 'lucide-react'
import { cajaService } from '@/services'
import { useFormateo } from '@/hooks'
import { useAuthStore } from '@/store/authStore'
import {
  seleccionarImpresoraUSB, olvidarImpresoraUSB, obtenerImpresoraUSB, soportaWebUSB,
  impresionAutomatica, activarImpresionAutomatica,
  obtenerConfigImpresoras, guardarConfigImpresora,
} from '@/services/impresion'
import toast from 'react-hot-toast'

export default function HistorialCaja() {
  const { cop, fechaHora } = useFormateo()
  const qc = useQueryClient()

  const [modalCierre, setModalCierre] = useState(false)
  const [modalMovimiento, setModalMovimiento] = useState(false)
  const [efectivoContado, setEfectivoContado] = useState(0)
  const [observaciones, setObservaciones] = useState('')
  const [movForm, setMovForm] = useState<{ tipo: 'SANGRIA' | 'INGRESO'; monto: number; motivo: string }>({
    tipo: 'SANGRIA', monto: 0, motivo: '',
  })

  // ── Configuración de impresora térmica ──
  const { empleado } = useAuthStore()
  const esAdmin = empleado?.rol === 'ADMINISTRADOR'
  const [modalImpresora, setModalImpresora] = useState(false)
  const [configForm, setConfigForm] = useState({ host: '', port: 9100, ancho: 48, abrirCajon: true })
  const [usbGuardada, setUsbGuardada] = useState(obtenerImpresoraUSB())
  const [autoPrint, setAutoPrint] = useState(impresionAutomatica())

  const { data: cajaActual } = useQuery({
    queryKey: ['caja', 'actual'],
    queryFn: cajaService.estadoActual,
  })

  // Resumen del turno: totales calculados en el servidor + efectivo esperado
  const { data: resumen, isLoading: cargandoResumen } = useQuery({
    queryKey: ['caja', 'actual', 'resumen'],
    queryFn: cajaService.resumenActual,
    enabled: !!cajaActual,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['caja', 'historial'],
    queryFn: cajaService.historial,
  })

  const cajas = (data ?? []) as any[]
  const totalCajas = cajas.length
  const totalVentas = cajas.reduce((acc, caja) => acc + Number(caja.totalVentas ?? 0), 0)
  const totalDiferencia = cajas.reduce((acc, caja) => acc + Number(caja.diferencia ?? 0), 0)

  const efectivoEsperado = Number(resumen?.efectivoEsperado ?? 0)
  const diferenciaPreview = Number((Number(efectivoContado) - efectivoEsperado).toFixed(2))

  // ── Cierre de caja (arqueo) ──────────────────────────────
  const cerrarCajaMutation = useMutation({
    mutationFn: () => cajaService.cerrarCaja(cajaActual.id, {
      efectivoContado: Number(efectivoContado),
      observaciones: observaciones || undefined,
    }),
    onSuccess: (res: any) => {
      const dif = Number(res.diferencia ?? 0)
      toast.success(dif === 0 ? 'Caja cuadrada perfectamente' : `Caja cerrada con diferencia de ${cop(dif)}`)
      setModalCierre(false)
      setEfectivoContado(0)
      setObservaciones('')
      qc.invalidateQueries({ queryKey: ['caja'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al cerrar caja')
    },
  })

  // ── Movimiento de efectivo (sangría / ingreso) ───────────
  const movimientoMutation = useMutation({
    mutationFn: () => cajaService.registrarMovimiento(cajaActual.id, {
      tipo: movForm.tipo, monto: Number(movForm.monto), motivo: movForm.motivo.trim(),
    }),
    onSuccess: () => {
      toast.success(movForm.tipo === 'SANGRIA' ? 'Sangría registrada' : 'Ingreso registrado')
      setModalMovimiento(false)
      setMovForm({ tipo: 'SANGRIA', monto: 0, motivo: '' })
      qc.invalidateQueries({ queryKey: ['caja'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'No se pudo registrar el movimiento')
    },
  })

  // ── Impresora: config del servidor + WebUSB local ──
  const { data: configImpresoras } = useQuery({
    queryKey: ['impresion', 'config'],
    queryFn: obtenerConfigImpresoras,
    enabled: modalImpresora && esAdmin,
  })

  useEffect(() => {
    if (!configImpresoras) return
    const clave = empleado?.sucursalId ? `IMPRESORA_SUCURSAL_${empleado.sucursalId}` : 'IMPRESORA_DEFAULT'
    const encontrada: any = (configImpresoras as any[]).find((c: any) => c.clave === clave) ?? (configImpresoras as any[])[0]
    if (encontrada?.host) {
      setConfigForm({ host: encontrada.host, port: encontrada.port ?? 9100, ancho: encontrada.ancho ?? 48, abrirCajon: encontrada.abrirCajon ?? true })
    }
  }, [configImpresoras, empleado?.sucursalId])

  const guardarImpresoraMutation = useMutation({
    mutationFn: () => guardarConfigImpresora({ sucursalId: empleado?.sucursalId ?? undefined, ...configForm }),
    onSuccess: () => {
      toast.success('Impresora guardada')
      qc.invalidateQueries({ queryKey: ['impresion', 'config'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'No se pudo guardar la impresora'),
  })

  const elegirImpresoraUSB = async () => {
    try {
      const d = await seleccionarImpresoraUSB()
      setUsbGuardada(d)
      if (d) toast.success(`Impresora USB: ${d.nombre}`)
    } catch (err: any) {
      toast.error(err?.message ?? 'No se pudo seleccionar la impresora USB')
    }
  }

  const alternarAutoImpresion = (valor: boolean) => {
    setAutoPrint(valor)
    activarImpresionAutomatica(valor)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner de Caja Actual */}
      {cajaActual ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-emerald-800 font-bold text-lg">Turno Activo</h2>
            </div>
            <p className="text-emerald-700 text-sm mt-1">Caja abierta el {fechaHora(cajaActual.abiertaEn)} con base de {cop(Number(cajaActual.montoApertura))}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setModalMovimiento(true)} className="px-4 py-2.5 bg-white text-emerald-700 border border-emerald-300 rounded-xl font-medium hover:bg-emerald-100 transition shadow-sm flex items-center gap-2">
              <ArrowUpCircle size={16} /> Movimiento de efectivo
            </button>
            <button onClick={() => setModalCierre(true)} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition shadow-sm flex items-center gap-2">
              <Scale size={16} /> Arqueo y cierre
            </button>
            {esAdmin && (
              <button onClick={() => setModalImpresora(true)} className="px-4 py-2.5 bg-white text-emerald-700 border border-emerald-300 rounded-xl font-medium hover:bg-emerald-100 transition shadow-sm flex items-center gap-2">
                <Settings size={16} /> Impresora
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <h2 className="text-slate-700 font-bold text-lg">Caja Cerrada</h2>
          <p className="text-slate-500 text-sm mt-1">No hay ningún turno activo en este momento.</p>
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
        </div>
        {isLoading ? (
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

      {/* Modal Movimiento de efectivo */}
      {modalMovimiento && cajaActual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Movimiento de efectivo</h2>
              <button onClick={() => setModalMovimiento(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMovForm({ ...movForm, tipo: 'SANGRIA' })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-medium transition ${movForm.tipo === 'SANGRIA' ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                  <ArrowUpCircle size={16} /> Sangría (sale)
                </button>
                <button
                  onClick={() => setMovForm({ ...movForm, tipo: 'INGRESO' })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-medium transition ${movForm.tipo === 'INGRESO' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                  <ArrowDownCircle size={16} /> Ingreso (entra)
                </button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Monto</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input type="number" min="0" value={movForm.monto} onChange={(e) => setMovForm({ ...movForm, monto: Number(e.target.value) })} className="input-base pl-7 font-mono text-lg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Motivo</label>
                <input type="text" value={movForm.motivo} onChange={(e) => setMovForm({ ...movForm, motivo: e.target.value })} className="input-base" placeholder="Ej. Retiro a caja fuerte" />
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button onClick={() => setModalMovimiento(false)} className="flex-1 btn-secondary justify-center">Cancelar</button>
              <button
                onClick={() => movimientoMutation.mutate()}
                disabled={movimientoMutation.isPending || movForm.monto <= 0 || movForm.motivo.trim().length < 3}
                className="flex-1 btn-primary justify-center"
              >
                <Plus size={16} /> {movimientoMutation.isPending ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuración de Impresora */}
      {modalImpresora && esAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0">
              <h2 className="text-lg font-bold text-gray-900">Impresora térmica</h2>
              <button onClick={() => setModalImpresora(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Impresora de la sede (por red, TCP 9100). Todos los equipos de la sede imprimen en ella.</p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">IP o host</label>
                <input type="text" value={configForm.host} onChange={(e) => setConfigForm({ ...configForm, host: e.target.value })} className="input-base" placeholder="192.168.1.50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Puerto</label>
                  <input type="number" value={configForm.port} onChange={(e) => setConfigForm({ ...configForm, port: Number(e.target.value) })} className="input-base font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Ancho (car.)</label>
                  <input type="number" value={configForm.ancho} onChange={(e) => setConfigForm({ ...configForm, ancho: Number(e.target.value) })} className="input-base font-mono" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={configForm.abrirCajon} onChange={(e) => setConfigForm({ ...configForm, abrirCajon: e.target.checked })} />
                Abrir el cajón de dinero al cobrar
              </label>
              <button onClick={() => guardarImpresoraMutation.mutate()} disabled={guardarImpresoraMutation.isPending || !configForm.host} className="btn-primary w-full justify-center">
                <Save size={16} /> {guardarImpresoraMutation.isPending ? 'Guardando...' : 'Guardar impresora de red'}
              </button>

              <div className="pt-4 border-t border-dashed border-gray-200 space-y-3">
                <p className="text-sm text-gray-600">O una impresora <strong>USB</strong> conectada a este equipo (Chrome/Edge).</p>
                {!soportaWebUSB() ? (
                  <p className="text-xs text-amber-600">Este navegador no soporta impresión USB directa.</p>
                ) : usbGuardada ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700">💾 {usbGuardada.nombre}</span>
                    <button onClick={() => { olvidarImpresoraUSB(); setUsbGuardada(null) }} className="text-xs text-red-600 hover:text-red-700">Quitar</button>
                  </div>
                ) : (
                  <button onClick={elegirImpresoraUSB} className="btn-secondary w-full justify-center">Seleccionar impresora USB</button>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 pt-4 border-t border-dashed border-gray-200">
                <input type="checkbox" checked={autoPrint} onChange={(e) => alternarAutoImpresion(e.target.checked)} />
                Imprimir automáticamente al cobrar
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Modal Arqueo y Cierre de Caja */}
      {modalCierre && cajaActual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0">
              <h2 className="text-lg font-bold text-gray-900">Arqueo y Cierre de Caja</h2>
              <button onClick={() => setModalCierre(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              {cargandoResumen ? (
                <div className="p-6 text-center text-gray-500">
                  <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Calculando totales del turno...
                </div>
              ) : (
                <>
                  {/* Ventas del sistema */}
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ventas del sistema</div>
                    <div className="p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-600">Efectivo (gaveta)</span><span className="font-mono font-medium">{cop(Number(resumen?.totalEfectivo ?? 0))}</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Tarjeta</span><span className="font-mono font-medium">{cop(Number(resumen?.totalTarjeta ?? 0))}</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Online / transferencia</span><span className="font-mono font-medium">{cop(Number(resumen?.totalOnline ?? 0))}</span></div>
                      <div className="flex justify-between pt-2 border-t border-slate-100 font-semibold"><span>Total ventas ({resumen?.cantidadVentas ?? 0})</span><span className="font-mono">{cop(Number(resumen?.totalVentas ?? 0))}</span></div>
                    </div>
                  </div>

                  {/* Movimientos de efectivo */}
                  {(resumen?.movimientos?.length ?? 0) > 0 && (
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Movimientos de efectivo del turno</div>
                      <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                        {resumen.movimientos.map((m: any) => (
                          <div key={m.id} className="px-4 py-2 flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {m.tipo === 'INGRESO' ? <ArrowDownCircle size={14} className="text-emerald-600" /> : <ArrowUpCircle size={14} className="text-red-600" />}
                              <span className="text-slate-600">{m.motivo}</span>
                            </div>
                            <span className={`font-mono ${m.tipo === 'INGRESO' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {m.tipo === 'INGRESO' ? '+' : '−'}{cop(Number(m.monto ?? 0))}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2 bg-slate-50 flex justify-between text-xs text-slate-500">
                        <span>Ingresos: {cop(Number(resumen?.totalIngresos ?? 0))}</span>
                        <span>Sangrías: {cop(Number(resumen?.totalSangrias ?? 0))}</span>
                      </div>
                    </div>
                  )}

                  {/* Arqueo */}
                  <div className="rounded-2xl border-2 border-teal-100 bg-teal-50/40 p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">Efectivo esperado en gaveta</span>
                      <span className="font-mono font-bold text-teal-800">{cop(efectivoEsperado)}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Efectivo contado</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number" min="0" autoFocus
                          value={efectivoContado}
                          onChange={(e) => setEfectivoContado(Number(e.target.value))}
                          className="input-base pl-7 font-mono text-lg"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-teal-100">
                      <span className="text-sm font-semibold text-gray-600">Diferencia</span>
                      <span className={`font-mono font-bold ${diferenciaPreview === 0 ? 'text-emerald-600' : diferenciaPreview < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {cop(diferenciaPreview)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Observaciones (Opcional)</label>
                    <textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="input-base resize-none text-sm" placeholder="Ej. Faltante por dar devueltas erróneas..." />
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 sticky bottom-0">
              <button onClick={() => setModalCierre(false)} className="flex-1 btn-secondary justify-center">Cancelar</button>
              <button
                onClick={() => cerrarCajaMutation.mutate()}
                disabled={cerrarCajaMutation.isPending || cargandoResumen}
                className="flex-1 btn-primary justify-center bg-red-600 hover:bg-red-700"
              >
                <Save size={16} /> {cerrarCajaMutation.isPending ? 'Cerrando...' : 'Confirmar Cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
