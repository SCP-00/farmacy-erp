import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Truck, Package, ChevronRight,
  ClipboardList, Save,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { comprasService, productosService } from '@/services'
import { useFormateo } from '@/hooks'
import { useAuthStore } from '@/store/authStore'
import { InputField } from '@/components/shared/InputField'

interface LoteRecibir {
  productoId: string
  nombre: string
  presentacion: string
  cantidadPedida: number
  codigoLote: string
  cantidad: number
  fechaVencimiento: string
  precioCompra: number
}

interface ItemOrden {
  productoId: string
  nombre: string
  presentacion: string
  cantidadPedida: number
  precioUnitario: number
}

interface ProductoResult {
  id: string
  nombre: string
  presentacion?: string
  precioPromedio?: number
  precioVenta?: number
  stockTotal?: number
}

// ── Validación de lote individual ─────────────────────────────

type CampoLote = 'codigoLote' | 'cantidad' | 'fechaVencimiento' | 'precioCompra'

function validarCampoLote(campo: CampoLote, valor: string | number, lote: LoteRecibir): string {
  switch (campo) {
    case 'codigoLote':
      if (!String(valor).trim()) return 'El código de lote es obligatorio'
      if (String(valor).trim().length < 3) return 'Debe tener al menos 3 caracteres'
      if (String(valor).trim().length > 50) return 'Máximo 50 caracteres'
      if (!/^[a-zA-Z0-9_\-\/.]+$/.test(String(valor))) return 'Solo letras, números, guiones y puntos'
      return ''
    case 'cantidad':
      if (Number(valor) < 1) return 'Debe ser al menos 1'
      if (Number(valor) > lote.cantidadPedida * 2) return `No puede exceder ${lote.cantidadPedida * 2} unidades`
      return ''
    case 'fechaVencimiento':
      if (!String(valor).trim()) return 'La fecha de vencimiento es obligatoria'
      if (new Date(valor) <= new Date()) return 'Debe ser una fecha futura'
      return ''
    case 'precioCompra':
      if (Number(valor) < 0) return 'No puede ser negativo'
      return ''
  }
}

export default function RecepcionMercancia() {
  const { cop, fechaCorta } = useFormateo()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const empleado = useAuthStore((s) => s.empleado)

  const [ordenId, setOrdenId] = useState('')
  const [sucursalId] = useState(empleado?.sucursalId ?? 1)
  const [lotes, setLotes] = useState<LoteRecibir[]>([])
  const [step, setStep] = useState<'select' | 'receive'>('select')

  // ── Estado de validación de lotes ───────────────────────────
  const [lotesTocados, setLotesTocados] = useState<Record<string, Partial<Record<CampoLote, boolean>>>>({})
  const [lotesErrores, setLotesErrores] = useState<Record<string, Partial<Record<CampoLote, string>>>>({})

  const tocarCampoLote = useCallback((idx: number, campo: CampoLote) => {
    setLotesTocados(prev => ({
      ...prev,
      [idx]: { ...(prev[idx] || {}), [campo]: true }
    }))
  }, [])

  const validarLote = useCallback((idx: number, campo: CampoLote, valor: string | number) => {
    const lote = lotes[idx]
    if (!lote) return
    const error = validarCampoLote(campo, valor, lote)
    setLotesErrores(prev => {
      const loteErrors = { ...(prev[idx] || {}) }
      if (error) {
        return { ...prev, [idx]: { ...loteErrors, [campo]: error } }
      }
      delete loteErrors[campo]
      if (Object.keys(loteErrors).length === 0) {
        const n = { ...prev }; delete n[idx]; return n
      }
      return { ...prev, [idx]: loteErrors }
    })
  }, [lotes])

  const handleBlurLote = useCallback((idx: number, campo: CampoLote) => {
    tocarCampoLote(idx, campo)
    const lote = lotes[idx]
    if (!lote) return
    validarLote(idx, campo, lote[campo])
  }, [lotes, tocarCampoLote, validarLote])

  const handleChangeLote = useCallback((idx: number, campo: CampoLote, valor: string | number) => {
    actualizarLote(idx, campo, valor)
    if (lotesTocados[idx]?.[campo]) {
      validarLote(idx, campo, valor)
    }
  }, [lotesTocados, validarLote])

  // ── Fin validación ──────────────────────────────────────────

  // Órdenes PENDIENTES
  const { data: ordenesData } = useQuery({
    queryKey: ['compras', 'pendientes'],
    queryFn: () => comprasService.listarOrdenes({ estado: 'PENDIENTE', limite: 100 }),
  })

  const ordenesPendientes = useMemo(() => ordenesData?.data ?? [], [ordenesData])

  // Detalle de la orden seleccionada
  const { data: ordenDetalle, isLoading: detalleLoading } = useQuery({
    queryKey: ['compras', 'detalle', ordenId],
    queryFn: () => comprasService.obtenerOrden(ordenId),
    enabled: !!ordenId,
  })

  const itemsOrden: ItemOrden[] = useMemo(() => {
    if (!ordenDetalle?.detalles) return []
    return ordenDetalle.detalles.map((d: any) => ({
      productoId: d.productoId,
      nombre: d.producto?.nombre ?? 'Producto',
      presentacion: d.producto?.presentacion ?? '',
      cantidadPedida: d.cantidadPedida,
      precioUnitario: Number(d.precioUnitario),
    }))
  }, [ordenDetalle])

  // Pre-fill lotes when order details load
  useEffect(() => {
    if (step === 'receive' && itemsOrden.length > 0 && lotes.length === 0) {
      const nuevosLotes = itemsOrden.map((item) => ({
        productoId: item.productoId,
        nombre: item.nombre,
        presentacion: item.presentacion,
        cantidadPedida: item.cantidadPedida,
        codigoLote: '',
        cantidad: item.cantidadPedida,
        fechaVencimiento: '',
        precioCompra: item.precioUnitario,
      }))
      setLotes(nuevosLotes)
      setLotesTocados({})
      setLotesErrores({})
    }
  }, [step, itemsOrden, lotes.length])

  function seleccionarOrden(id: string) {
    setOrdenId(id)
    setStep('receive')
    setLotes([])
    setLotesTocados({})
    setLotesErrores({})
  }

  function volver() {
    setOrdenId('')
    setStep('select')
    setLotes([])
    setLotesTocados({})
    setLotesErrores({})
  }

  function actualizarLote(index: number, campo: keyof LoteRecibir, valor: string | number) {
    setLotes(prev => prev.map((l, i) => i === index ? { ...l, [campo]: valor } : l))
  }

  const receiveMutation = useMutation({
    mutationFn: () => comprasService.recibirMercancia(ordenId, {
      sucursalId,
      lotes: lotes.map(l => ({
        productoId: l.productoId,
        codigoLote: l.codigoLote,
        cantidad: l.cantidad,
        fechaVencimiento: l.fechaVencimiento,
        precioCompra: l.precioCompra,
      })),
    }),
    onSuccess: () => {
      toast.success('Mercancía recibida y lotes creados exitosamente')
      qc.invalidateQueries({ queryKey: ['compras'] })
      qc.invalidateQueries({ queryKey: ['lotes'] })
      navigate('/admin/compras/ordenes')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al recibir mercancía')
    },
  })

  // ── Validación al enviar ────────────────────────────────────
  function validarFormularioLotes(): boolean {
    const nuevosTocados: Record<string, Partial<Record<CampoLote, boolean>>> = {}
    const nuevosErrores: Record<string, Partial<Record<CampoLote, string>>> = {}
    let hayError = false

    lotes.forEach((lote, idx) => {
      const campos: CampoLote[] = ['codigoLote', 'cantidad', 'fechaVencimiento', 'precioCompra']
      const idxStr = String(idx)
      nuevosTocados[idxStr] = {}
      nuevosErrores[idxStr] = {}

      campos.forEach(campo => {
        nuevosTocados[idxStr]![campo] = true
        const error = validarCampoLote(campo, lote[campo as keyof LoteRecibir] as string | number, lote)
        if (error) {
          nuevosErrores[idxStr]![campo] = error
          hayError = true
        }
      })
    })

    setLotesTocados(prev => ({ ...prev, ...nuevosTocados }))
    setLotesErrores(prev => ({ ...prev, ...nuevosErrores }))
    return !hayError
  }

  const handleRecibir = () => {
    if (!validarFormularioLotes()) {
      toast.error('Corrige los errores en los lotes antes de recibir')
      return
    }
    receiveMutation.mutate()
  }

  const lotesValidos = lotes.length > 0 &&
    lotes.every(l => l.codigoLote && l.fechaVencimiento && l.cantidad > 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => step === 'select' ? navigate('/admin/compras/ordenes') : volver()}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-surface rounded-xl">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Recepción de mercancía</h1>
          <p className="text-sm text-gray-500 dark:text-dark-text/60 mt-1">
            {step === 'select'
              ? 'Selecciona una orden de compra pendiente para recibir'
              : 'Registra los lotes recibidos para cada producto'}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 text-sm">
        <div className={`flex items-center gap-2 ${step === 'select' ? 'text-teal-700 dark:text-teal-400 font-semibold' : 'text-gray-400 dark:text-dark-text/60'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
            ${step === 'select' ? 'bg-teal-700 text-white' : 'bg-gray-200 dark:bg-dark-border text-gray-500 dark:text-dark-text/60'}`}>1</div>
          Seleccionar orden
        </div>
        <div className="w-8 h-px bg-gray-200 dark:bg-dark-border" />
        <div className={`flex items-center gap-2 ${step === 'receive' ? 'text-teal-700 dark:text-teal-400 font-semibold' : 'text-gray-400 dark:text-dark-text/60'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
            ${step === 'receive' ? 'bg-teal-700 text-white' : 'bg-gray-200 dark:bg-dark-border text-gray-500 dark:text-dark-text/60'}`}>2</div>
          Registrar lotes
        </div>
      </div>

      {/* Step 1: Select order */}
      {step === 'select' && (
        <div className="surface overflow-hidden bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-dark-text">Órdenes pendientes</h2>
          </div>

          {ordenesPendientes.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-dark-text/60">
              <ClipboardList size={40} className="mx-auto mb-3 text-gray-300 dark:text-dark-border" />
              <p>No hay órdenes pendientes por recibir</p>
              <button onClick={() => navigate('/admin/compras/nueva')}
                className="text-teal-700 dark:text-teal-400 font-medium text-sm mt-3 inline-flex items-center gap-1 hover:underline">
                Crear nueva orden
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-dark-border">
              {ordenesPendientes.map((o: any) => (
                <button
                  key={o.id}
                  onClick={() => seleccionarOrden(o.id)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50/70 dark:hover:bg-dark-surface/80 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                      <Truck size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-dark-text">
                        {o.proveedor?.nombre ?? 'Proveedor'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-dark-text/60">
                        OC-{String(o.numero ?? o.id).slice(0, 8)} · {fechaCorta(o.creadoEn)} · {o._count?.detalles ?? 0} producto(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-800 dark:text-dark-text">{cop(Number(o.total))}</span>
                    <ChevronRight size={16} className="text-gray-300 dark:text-dark-text/40" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Register lots */}
      {step === 'receive' && (
        <>
          {/* Order summary */}
          {ordenDetalle && (
            <div className="surface p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">{ordenDetalle.proveedor?.nombre}</h2>
                  <p className="text-sm text-gray-500 dark:text-dark-text/60">
                    OC-{String(ordenDetalle.numero ?? ordenDetalle.id).slice(0, 8)} · {fechaCorta(ordenDetalle.creadoEn)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800 dark:text-dark-text">{cop(Number(ordenDetalle.total))}</p>
                  <p className="text-xs text-gray-400 dark:text-dark-text/60">{lotes.length} producto(s)</p>
                </div>
              </div>
            </div>
          )}

          {/* Lots form */}
          <div className="surface overflow-hidden bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-dark-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-dark-text">Registrar lotes</h2>
              {lotes.length > 0 && (
                <span className="text-xs text-gray-500 dark:text-dark-text/60">
                  {lotes.filter(l => l.codigoLote && l.fechaVencimiento).length} de {lotes.length} completados
                </span>
              )}
            </div>

            <div className="p-5">
              {detalleLoading ? (
                <div className="p-8 text-center text-gray-400 dark:text-dark-text/60">
                  <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Cargando detalles de la orden...
                </div>
              ) : lotes.length === 0 ? (
                <div className="text-center py-8">
                  <Package size={40} className="mx-auto mb-3 text-gray-300 dark:text-dark-border" />
                  <p className="text-gray-500 dark:text-dark-text/60">No se encontraron productos en esta orden</p>
                  <div className="mt-4">
                    <AddProductToReceive
                      onAdd={(producto) => {
                        setLotes(prev => [...prev, {
                          productoId: producto.id,
                          nombre: producto.nombre,
                          presentacion: producto.presentacion ?? '',
                          cantidadPedida: 1,
                          codigoLote: '',
                          cantidad: 1,
                          fechaVencimiento: '',
                          precioCompra: Number(producto.precioPromedio) > 0 ? Number(producto.precioPromedio) : Number(producto.precioVenta),
                        } as LoteRecibir])
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {lotes.map((lote, idx) => {
                    const idxStr = String(idx)
                    const loteErr = lotesErrores[idxStr] || {}
                    const loteTouch = lotesTocados[idxStr] || {}

                    return (
                      <div key={idx} className="p-4 bg-gray-50 dark:bg-dark-surface/80 rounded-xl border border-gray-100 dark:border-dark-border">
                        <div className="flex items-center gap-2 mb-3">
                          <Package size={16} className="text-teal-600 dark:text-teal-400" />
                          <span className="text-sm font-semibold text-gray-800 dark:text-dark-text">{lote.nombre}</span>
                          <span className="text-xs text-gray-400 dark:text-dark-text/60">{lote.presentacion}</span>
                          <span className="text-xs text-gray-400 dark:text-dark-text/60 ml-auto">
                            Pedido: {lote.cantidadPedida} uds
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <InputField
                            label="Código lote"
                            value={lote.codigoLote}
                            onChange={e => handleChangeLote(idx, 'codigoLote', e.target.value)}
                            onBlur={() => handleBlurLote(idx, 'codigoLote')}
                            error={loteErr.codigoLote}
                            touched={loteTouch.codigoLote}
                            required
                            placeholder="LOT-001"
                          />
                          <InputField
                            label="Cantidad"
                            type="number"
                            min="1"
                            value={lote.cantidad}
                            onChange={e => handleChangeLote(idx, 'cantidad', Math.max(1, Number(e.target.value)))}
                            onBlur={() => handleBlurLote(idx, 'cantidad')}
                            error={loteErr.cantidad}
                            touched={loteTouch.cantidad}
                            required
                          />
                          <InputField
                            label="Vence"
                            type="date"
                            value={lote.fechaVencimiento}
                            onChange={e => handleChangeLote(idx, 'fechaVencimiento', e.target.value)}
                            onBlur={() => handleBlurLote(idx, 'fechaVencimiento')}
                            error={loteErr.fechaVencimiento}
                            touched={loteTouch.fechaVencimiento}
                            required
                          />
                          <InputField
                            label="Precio compra"
                            type="number"
                            min="0"
                            value={lote.precioCompra}
                            onChange={e => handleChangeLote(idx, 'precioCompra', Math.max(0, Number(e.target.value)))}
                            onBlur={() => handleBlurLote(idx, 'precioCompra')}
                            error={loteErr.precioCompra}
                            touched={loteTouch.precioCompra}
                          />
                        </div>
                      </div>
                    )
                  })}

                  {/* Add more products */}
                  <div className="pt-4 border-t border-gray-100 dark:border-dark-border">
                    <AddProductToReceive
                      onAdd={(producto) => {
                        setLotes(prev => [...prev, {
                          productoId: producto.id,
                          nombre: producto.nombre,
                          presentacion: producto.presentacion ?? '',
                          cantidadPedida: 1,
                          codigoLote: '',
                          cantidad: 1,
                          fechaVencimiento: '',
                          precioCompra: Number(producto.precioPromedio) > 0 ? Number(producto.precioPromedio) : Number(producto.precioVenta),
                        } as LoteRecibir])
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <button onClick={volver} className="btn-ghost">Volver</button>
            <button
              onClick={handleRecibir}
              disabled={!lotesValidos || receiveMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save size={16} />
              {receiveMutation.isPending ? 'Procesando...' : `Recibir ${lotes.length} lote(s)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function AddProductToReceive({ onAdd }: { onAdd: (producto: ProductoResult) => void }) {
  const [q, setQ] = useState('')
  const { data, isFetching } = useQuery({
    queryKey: ['productos', 'buscar-recibir', q],
    queryFn: () => productosService.listar({ q: q || undefined, limite: 10 }),
    enabled: q.length > 1,
  })
  const results: ProductoResult[] = Array.isArray(data?.data) ? data.data : []

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-dark-text/60 mb-2 uppercase tracking-wide">
        Agregar producto manualmente
      </p>
      <div className="relative">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full px-3.5 py-2 border border-gray-200 dark:border-dark-border rounded-lg outline-none focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-800/30 focus:border-teal-500 text-sm bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text"
        />
      </div>
      {q.length > 1 && (
        <div className="mt-2 border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden bg-white dark:bg-dark-surface">
          {isFetching ? (
            <div className="p-3 text-sm text-gray-400 dark:text-dark-text/60">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-gray-400 dark:text-dark-text/60">Sin resultados</div>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                onClick={() => { onAdd(p); setQ('') }}
                className="w-full text-left px-4 py-2.5 hover:bg-teal-50 dark:hover:bg-teal-900/20 border-b dark:border-dark-border last:border-b-0
                           flex items-center justify-between text-sm transition-colors"
              >
                <span className="font-medium text-gray-800 dark:text-dark-text">{p.nombre}</span>
                <span className="text-xs text-gray-400 dark:text-dark-text/60">Stock: {p.stockTotal ?? 0}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
