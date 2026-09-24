import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Building2, Mail, Phone, MapPin, FileText, Package,
  ArrowLeft, Pencil, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { proveedoresService, comprasService } from '@/services'
import { useFormateo } from '@/hooks'

interface ProveedorForm {
  nit: string
  nombre: string
  nombreContacto: string
  email: string
  telefono: string
  ciudad: string
}

export default function DetalleProveedor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { cop, fechaCorta } = useFormateo()
  const qc = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<ProveedorForm>({
    nit: '', nombre: '', nombreContacto: '', email: '', telefono: '', ciudad: '',
  })

  const { data: proveedor, isLoading, isError } = useQuery({
    queryKey: ['proveedor', id],
    queryFn: () => proveedoresService.obtener(id!),
    enabled: !!id,
  })

  // Órdenes de compra del proveedor via listar
  const { data: ordenesData } = useQuery({
    queryKey: ['compras', 'proveedor', id],
    queryFn: () => comprasService.listarOrdenes({ pagina: 1, limite: 50 }),
  })

  const ordenes = useMemo(() =>
    (ordenesData?.data ?? []).filter((o: any) => o.proveedorId === id),
    [ordenesData, id]
  )

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ProveedorForm>) =>
      proveedoresService.actualizar(id!, data as any),
    onSuccess: () => {
      toast.success('Proveedor actualizado')
      setEditando(false)
      qc.invalidateQueries({ queryKey: ['proveedor', id] })
      qc.invalidateQueries({ queryKey: ['proveedores'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Error al actualizar')
    },
  })

  function iniciarEdicion() {
    if (!proveedor) return
    setForm({
      nit: proveedor.nit ?? '',
      nombre: proveedor.nombre ?? '',
      nombreContacto: proveedor.nombreContacto ?? '',
      email: proveedor.email ?? '',
      telefono: proveedor.telefono ?? '',
      ciudad: proveedor.ciudad ?? '',
    })
    setEditando(true)
  }

  function guardar() {
    if (!form.nit || !form.nombre) {
      toast.error('NIT y Nombre son obligatorios')
      return
    }
    updateMutation.mutate(form)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isError || !proveedor) {
    return (
      <div className="text-center py-16">
        <Building2 size={48} className="mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Proveedor no encontrado</h2>
        <p className="text-gray-400 mb-6">El proveedor que buscas no existe o fue eliminado.</p>
        <button onClick={() => navigate('/admin/proveedores')} className="btn-primary">
          Volver a proveedores
        </button>
      </div>
    )
  }

  const estadoBadge = proveedor.activo !== false
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-red-50 text-red-700 border-red-200'

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/proveedores')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-teal-700 transition-colors"
      >
        <ArrowLeft size={14} /> Volver a proveedores
      </button>

      {/* Header card */}
      <div className="surface overflow-hidden">
        <div className="bg-gradient-to-r from-teal-900 via-teal-700 to-emerald-700 text-white px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]">
                Proveedor
              </span>
              <h1 className="mt-3 text-3xl font-bold leading-tight">{proveedor.nombre}</h1>
              <p className="text-white/70 text-sm mt-1">NIT {proveedor.nit}</p>
            </div>
            <div className="flex gap-2">
              {!editando && (
                <button onClick={iniciarEdicion}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/15 rounded-xl text-xs font-medium
                             hover:bg-white/25 transition-colors">
                  <Pencil size={12} /> Editar
                </button>
              )}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${estadoBadge}`}>
                {proveedor.activo !== false ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>

        {editando ? (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">NIT *</label>
                <input value={form.nit} onChange={e => setForm(f => ({ ...f, nit: e.target.value }))}
                  className="input-base" />
              </div>
              <div>
                <label className="label">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="input-base" />
              </div>
              <div>
                <label className="label">Nombre contacto</label>
                <input value={form.nombreContacto} onChange={e => setForm(f => ({ ...f, nombreContacto: e.target.value }))}
                  className="input-base" />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                  className="input-base" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="input-base" />
              </div>
              <div>
                <label className="label">Ciudad</label>
                <input value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                  className="input-base" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditando(false)} className="btn-ghost text-sm">Cancelar</button>
              <button onClick={guardar} disabled={updateMutation.isPending}
                className="btn-primary text-sm flex items-center gap-2">
                <Check size={14} /> Guardar cambios
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Contacto</p>
                <p className="text-sm font-medium text-gray-800">{proveedor.nombreContacto || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                  <Mail size={12} className="inline mr-1" />Email
                </p>
                <p className="text-sm text-gray-700">{proveedor.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                  <Phone size={12} className="inline mr-1" />Teléfono
                </p>
                <p className="text-sm text-gray-700">{proveedor.telefono || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                  <MapPin size={12} className="inline mr-1" />Ciudad
                </p>
                <p className="text-sm text-gray-700">{proveedor.ciudad || '—'}</p>
              </div>
            </div>
            <div className="flex gap-6 mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileText size={14} className="text-gray-400" />
                <span><strong className="text-gray-800">{proveedor._count?.ordenesCompra ?? 0}</strong> órdenes</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Package size={14} className="text-gray-400" />
                <span><strong className="text-gray-800">{proveedor._count?.lotes ?? 0}</strong> lotes</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Órdenes de compra relacionadas */}
      <div className="surface overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Órdenes de compra</h2>
            <p className="text-sm text-slate-500">{ordenes.length} orden(es)</p>
          </div>
        </div>

        {ordenes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <FileText size={36} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Este proveedor no tiene órdenes de compra</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-[0.18em]">
                <tr>
                  <th className="px-5 py-3 text-left">N°</th>
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-5 py-3 text-left">Total</th>
                  <th className="px-5 py-3 text-left">Estado</th>
                  <th className="px-5 py-3 text-left">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {ordenes.map((o: any) => {
                  const estadoColores: Record<string, string> = {
                    PENDIENTE: 'bg-amber-50 text-amber-700',
                    RECIBIDA: 'bg-emerald-50 text-emerald-700',
                    CANCELADA: 'bg-red-50 text-red-700',
                  }
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs text-gray-600">OC-{String(o.numero ?? o.id).slice(0, 8)}</td>
                      <td className="px-5 py-4 text-gray-600">{fechaCorta(o.creadoEn)}</td>
                      <td className="px-5 py-4 font-medium text-gray-900">{cop(Number(o.total))}</td>
                      <td className="px-5 py-4">
                        <span className={`badge ${estadoColores[o.estado] ?? 'bg-gray-50 text-gray-600'}`}>
                          {o.estado}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{o._count?.detalles ?? 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
