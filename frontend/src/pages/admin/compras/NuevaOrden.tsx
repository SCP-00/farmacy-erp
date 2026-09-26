import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, Search, Package, Save,
  Building2, Calendar,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { comprasService, proveedoresService, productosService } from '@/services'
import { useFormateo, useDebounce } from '@/hooks'
import { InputField, SelectField, TextAreaField, InputError } from '@/components/shared/InputField'

interface ItemOC {
  productoId: string
  nombre: string
  presentacion: string
  cantidadPedida: number
  precioUnitario: number
  subtotal: number
}

// ── Validación ────────────────────────────────────────────────

type CampoForm = 'proveedorId' | 'fechaEntrega' | 'notas'
type ErroresForm = Partial<Record<CampoForm, string>>

function validarCampo(campo: CampoForm, valor: string, _items: ItemOC[]): string {
  switch (campo) {
    case 'proveedorId':
      if (!valor) return 'Selecciona un proveedor'
      return ''
    case 'fechaEntrega':
      if (valor && new Date(valor) < new Date(new Date().toDateString())) return 'La fecha no puede ser anterior a hoy'
      return ''
    case 'notas':
      if (valor.length > 500) return 'Máximo 500 caracteres'
      return ''
  }
}

function validarItems(items: ItemOC[]): string | null {
  if (items.length === 0) return 'Agrega al menos un producto a la orden'
  const invalidos = items.filter(i => i.cantidadPedida < 1 || i.precioUnitario < 0)
  if (invalidos.length > 0) return `${invalidos.length} producto(s) tienen valores inválidos`
  return null
}

export default function NuevaOrden() {
  const { cop } = useFormateo()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [proveedorId, setProveedorId] = useState('')
  const [busqProd, setBusqProd] = useState('')
  const [items, setItems] = useState<ItemOC[]>([])
  const [notas, setNotas] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')

  // ── Estado de validación ────────────────────────────────────
  const [tocados, setTocados] = useState<Partial<Record<CampoForm, boolean>>>({})
  const [errores, setErrores] = useState<ErroresForm>({})
  const [errorItems, setErrorItems] = useState<string | null>(null)

  const handleBlur = useCallback((campo: CampoForm) => {
    setTocados(prev => ({ ...prev, [campo]: true }))
    const valores: Record<CampoForm, string> = { proveedorId, fechaEntrega, notas }
    const error = validarCampo(campo, valores[campo], items)
    setErrores(prev => {
      if (error) return { ...prev, [campo]: error }
      const n = { ...prev }; delete n[campo]; return n
    })
  }, [proveedorId, fechaEntrega, notas, items])

  function setError(campo: CampoForm, error: string | null) {
    setErrores(prev => {
      if (error) return { ...prev, [campo]: error }
      const n = { ...prev }; delete n[campo]; return n
    })
  }

  const handleChangeProveedor = (val: string) => {
    setProveedorId(val)
    if (tocados.proveedorId) {
      setError('proveedorId', validarCampo('proveedorId', val, items))
    }
  }

  const handleChangeNotas = (val: string) => {
    setNotas(val)
    if (tocados.notas) {
      setError('notas', validarCampo('notas', val, items))
    }
  }

  const handleChangeFecha = (val: string) => {
    setFechaEntrega(val)
    if (tocados.fechaEntrega) {
      setError('fechaEntrega', validarCampo('fechaEntrega', val, items))
    }
  }

  const debouncedBusqProv = useDebounce(busqProd, 300)

  // Proveedores
  const { data: provData } = useQuery({
    queryKey: ['proveedores', 'list'],
    queryFn: () => proveedoresService.listar({ limite: 100 }),
  })
  const proveedores = useMemo(() => provData?.data ?? [], [provData])

  // Búsqueda de productos para agregar
  const { data: prodData, isFetching: prodFetching } = useQuery({
    queryKey: ['productos', 'buscar-oc', debouncedBusqProv],
    queryFn: () => productosService.listar({ q: debouncedBusqProv || undefined, limite: 15 }),
    enabled: debouncedBusqProv.length > 1,
  })
  const resultadosProductos = useMemo(() => {
    const r = prodData?.data ?? prodData ?? []
    return Array.isArray(r) ? r : []
  }, [prodData])

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.cantidadPedida * i.precioUnitario, 0),
    [items]
  )
  const total = subtotal

  function agregarProducto(p: any) {
    setItems(prev => {
      const existe = prev.find(i => i.productoId === p.id)
      if (existe) {
        return prev.map(i => i.productoId === p.id
          ? { ...i, cantidadPedida: i.cantidadPedida + 1, subtotal: (i.cantidadPedida + 1) * i.precioUnitario }
          : i
        )
      }
      return [...prev, {
        productoId: p.id,
        nombre: p.nombre,
        presentacion: p.presentacion ?? '',
        cantidadPedida: 1,
        precioUnitario: Number(p.precioPromedio) > 0 ? Number(p.precioPromedio) : Number(p.precioVenta),
        subtotal: 0,
      }]
    })
    setBusqProd('')
    setErrorItems(null)
  }

  function actualizarItem(id: string, campo: 'cantidadPedida' | 'precioUnitario', valor: number) {
    setItems(prev => prev.map(i =>
      i.productoId === id
        ? { ...i, [campo]: valor, subtotal: (campo === 'cantidadPedida' ? valor : i.cantidadPedida) * (campo === 'precioUnitario' ? valor : i.precioUnitario) }
        : i
    ))
  }

  function eliminarItem(id: string) {
    setItems(prev => prev.filter(i => i.productoId !== id))
  }

  const createMutation = useMutation({
    mutationFn: () => comprasService.crearOrden({
      proveedorId,
      notas: notas || undefined,
      fechaEntregaEst: fechaEntrega || undefined,
      detalles: items.map(i => ({
        productoId: i.productoId,
        cantidadPedida: i.cantidadPedida,
        precioUnitario: i.precioUnitario,
      })),
    }),
    onSuccess: () => {
      toast.success('Orden de compra creada exitosamente')
      qc.invalidateQueries({ queryKey: ['compras'] })
      navigate('/admin/compras/ordenes')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al crear la orden')
    },
  })

  // ── Validación al enviar ────────────────────────────────────
  const puedeGuardar = proveedorId && items.length > 0 && !createMutation.isPending

  const handleGuardar = () => {
    const errItems = validarItems(items)
    if (errItems) { setErrorItems(errItems); toast.error(errItems); return }

    // Marcar todos como tocados
    setTocados({ proveedorId: true, fechaEntrega: true, notas: true })
    const campos: CampoForm[] = ['proveedorId', 'fechaEntrega', 'notas']
    const valores: Record<CampoForm, string> = { proveedorId, fechaEntrega, notas }
    const errs: ErroresForm = {}
    for (const c of campos) {
      const e = validarCampo(c, valores[c], items)
      if (e) errs[c] = e
    }
    setErrores(errs)

    if (Object.keys(errs).length > 0 || errItems) {
      toast.error('Corrige los errores antes de guardar')
      return
    }
    createMutation.mutate()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/compras/ordenes')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Nueva orden de compra</h1>
          <p className="text-sm text-gray-500 dark:text-dark-text/60 mt-1">Crea un pedido para abastecer tu inventario</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form principal */}
        <div className="lg:col-span-2 space-y-6">

          {/* Seleccionar proveedor */}
          <div className="surface p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-dark-text mb-3 flex items-center gap-2">
              <Building2 size={16} className="text-teal-600 dark:text-teal-400" /> Proveedor
            </h2>
            <SelectField
              label=""
              value={proveedorId}
              onChange={e => handleChangeProveedor(e.target.value)}
              onBlur={() => handleBlur('proveedorId')}
              error={errores.proveedorId}
              touched={tocados.proveedorId}
              required
              placeholder="Seleccionar proveedor..."
            >
              {proveedores.map((p: any) => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.nit})</option>
              ))}
            </SelectField>
          </div>

          {/* Agregar productos */}
          <div className="surface p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-dark-text mb-3 flex items-center gap-2">
              <Package size={16} className="text-teal-600 dark:text-teal-400" /> Productos
            </h2>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={busqProd}
                onChange={e => setBusqProd(e.target.value)}
                placeholder="Buscar producto por nombre..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-dark-border rounded-lg outline-none focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-800/30 focus:border-teal-500 text-sm bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text"
              />
            </div>

            {errorItems && items.length === 0 && (
              <InputError error={errorItems} />
            )}

            {busqProd.length > 1 && (
              <div className="mb-4 max-h-48 overflow-y-auto border border-gray-200 dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface">
                {prodFetching ? (
                  <div className="p-4 text-center text-gray-400 dark:text-dark-text/60 text-sm">Buscando...</div>
                ) : resultadosProductos.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 dark:text-dark-text/60 text-sm">Sin resultados</div>
                ) : (
                  resultadosProductos.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => agregarProducto(p)}
                      className="w-full text-left px-4 py-3 hover:bg-teal-50 dark:hover:bg-teal-900/20 border-b dark:border-dark-border last:border-b-0
                                 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-dark-text">{p.nombre}</p>
                        <p className="text-xs text-gray-400 dark:text-dark-text/60">{p.presentacion} · Stock: {p.stockTotal ?? 0}</p>
                      </div>
                      <Plus size={16} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Items agregados */}
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-dark-text/60 text-sm">
                <Package size={32} className="mx-auto mb-2 text-gray-300 dark:text-dark-border" />
                Busca y agrega productos a la orden
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.productoId}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-surface/80 rounded-xl border border-gray-100 dark:border-dark-border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-dark-text truncate">{item.nombre}</p>
                      <p className="text-xs text-gray-400 dark:text-dark-text/60">{item.presentacion}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 dark:text-dark-text/60 block">Cant.</label>
                        <input
                          type="number" min="1" value={item.cantidadPedida}
                          onChange={e => actualizarItem(item.productoId, 'cantidadPedida', Math.max(1, Number(e.target.value)))}
                          className={`w-16 text-sm px-2 py-1.5 border rounded-lg text-center bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text ${
                            item.cantidadPedida < 1 ? 'border-red-400' : 'border-gray-200 dark:border-dark-border'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 dark:text-dark-text/60 block">Precio</label>
                        <input
                          type="number" min="0" value={item.precioUnitario}
                          onChange={e => actualizarItem(item.productoId, 'precioUnitario', Math.max(0, Number(e.target.value)))}
                          className={`w-20 text-sm px-2 py-1.5 border rounded-lg text-right bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text ${
                            item.precioUnitario < 0 ? 'border-red-400' : 'border-gray-200 dark:border-dark-border'
                          }`}
                        />
                      </div>
                      <div className="text-right min-w-[80px]">
                        <label className="text-[10px] text-gray-400 dark:text-dark-text/60 block">Subtotal</label>
                        <p className="text-sm font-semibold text-gray-800 dark:text-dark-text">{cop(item.cantidadPedida * item.precioUnitario)}</p>
                      </div>
                      <button onClick={() => eliminarItem(item.productoId)}
                        className="p-1.5 text-gray-400 dark:text-dark-text/60 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="surface p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl">
            <TextAreaField
              label="Notas"
              value={notas}
              onChange={e => handleChangeNotas(e.target.value)}
              onBlur={() => handleBlur('notas')}
              error={errores.notas}
              touched={tocados.notas}
              placeholder="Instrucciones especiales para el proveedor..."
              rows={3}
            />
          </div>
        </div>

        {/* Sidebar — resumen */}
        <div className="space-y-6">
          <div className="surface p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-dark-text mb-3">Resumen</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500 dark:text-dark-text/60">
                <span>Productos</span>
                <span className="font-medium text-gray-800 dark:text-dark-text">{items.length}</span>
              </div>
              <div className="flex justify-between text-gray-500 dark:text-dark-text/60">
                <span>Unidades</span>
                <span className="font-medium text-gray-800 dark:text-dark-text">
                  {items.reduce((s, i) => s + i.cantidadPedida, 0)}
                </span>
              </div>
              <div className="border-t dark:border-dark-border pt-2 flex justify-between font-bold">
                <span>Total estimado</span>
                <span className="text-teal-700 dark:text-teal-400">{cop(total)}</span>
              </div>
            </div>
          </div>

          {/* Fecha entrega */}
          <div className="surface p-5 bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border rounded-xl">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-dark-text mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-teal-600 dark:text-teal-400" /> Fecha entrega est.
            </h2>
            <InputField
              label=""
              type="date"
              value={fechaEntrega}
              onChange={e => handleChangeFecha(e.target.value)}
              onBlur={() => handleBlur('fechaEntrega')}
              error={errores.fechaEntrega}
              touched={tocados.fechaEntrega}
            />
          </div>

          {/* Guardar */}
          <button
            onClick={handleGuardar}
            disabled={!puedeGuardar}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            <Save size={16} />
            {createMutation.isPending ? 'Creando...' : 'Crear orden'}
          </button>
        </div>
      </div>
    </div>
  )
}
