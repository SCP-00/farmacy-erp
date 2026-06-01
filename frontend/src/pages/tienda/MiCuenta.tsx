import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authClienteService, clientesService } from '@/services'
import {
  User, Heart, Coins, AlertTriangle, Stethoscope, Pill,
  Save, RotateCcw, CheckCircle, Info, ShieldAlert
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useFormateo } from '@/hooks'

type TabPerfil = 'datos' | 'salud' | 'puntos'

export default function MiCuenta() {
  const qc = useQueryClient()
  const { cop } = useFormateo()
  const { data: cliente, isLoading } = useQuery({ queryKey: ['cliente', 'me'], queryFn: authClienteService.me })
  const { data: perfilSalud } = useQuery({
    queryKey: ['cliente', 'salud'],
    queryFn: clientesService.obtenerSalud,
    enabled: true,
  })
  const [tabActiva, setTabActiva] = useState<TabPerfil>('datos')

  // ── Formulario datos básicos ──────────────────────────
  const [form, setForm] = useState({ nombre: '', apellido: '', tipoDoc: '', documento: '', telefono: '', ciudad: '' })

  // Poblar el formulario cuando se cargan los datos del cliente
  useEffect(() => {
    if (cliente) {
      setForm({
        nombre: cliente.nombre ?? '',
        apellido: cliente.apellido ?? '',
        tipoDoc: cliente.tipoDoc ?? 'CC',
        documento: cliente.documento ?? '',
        telefono: cliente.telefono ?? '',
        ciudad: cliente.ciudad ?? '',
      })
    }
  }, [cliente])

  const mutationPerfil = useMutation({
    mutationFn: (payload: any) => authClienteService.actualizarMe(payload),
    onSuccess: () => {
      toast.success('Perfil actualizado')
      qc.invalidateQueries({ queryKey: ['cliente', 'me'] })
    },
    onError: () => toast.error('Error actualizando perfil'),
  })

  // ── Formulario salud ─────────────────────────────────
  const [alergenosInput, setAlergenosInput] = useState('')
  const [condicionesInput, setCondicionesInput] = useState('')

  // Sincronizar datos de salud cuando se cargan
  useEffect(() => {
    if (perfilSalud) {
      setAlergenosInput((perfilSalud.alergenos ?? []).join(', '))
      setCondicionesInput((perfilSalud.condiciones ?? []).join(', '))
    }
  }, [perfilSalud])

  const mutationSalud = useMutation({
    mutationFn: (payload: { alergenos?: string[]; condiciones?: string[] }) =>
      clientesService.actualizarSalud(payload),
    onSuccess: (data) => {
      toast.success('Perfil de salud actualizado')
      qc.invalidateQueries({ queryKey: ['cliente', 'salud'] })
    },
    onError: () => toast.error('Error actualizando perfil de salud'),
  })

  if (isLoading) {
    return (
      <div className="section-shell py-12 flex justify-center">
        <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const handleSubmitPerfil = (e: any) => {
    e.preventDefault()
    mutationPerfil.mutate(form)
  }

  const handleGuardarSalud = () => {
    const alergenos = alergenosInput
      .split(',')
      .map(a => a.trim())
      .filter(Boolean)
    const condiciones = condicionesInput
      .split(',')
      .map(c => c.trim())
      .filter(Boolean)
    mutationSalud.mutate({ alergenos, condiciones })
  }

  const TABS: { id: TabPerfil; label: string; icon: React.ReactNode }[] = [
    { id: 'datos', label: 'Datos personales', icon: <User size={16} /> },
    { id: 'salud', label: 'Perfil de salud', icon: <Heart size={16} /> },
    { id: 'puntos', label: 'Programa de puntos', icon: <Coins size={16} /> },
  ]

  return (
    <div className="section-shell py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Mi cuenta</h1>
        <p className="text-slate-500 mt-1">Gestiona tus datos y preferencias de salud</p>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTabActiva(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              tabActiva === tab.id
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Datos personales ────────────────────────── */}
      {tabActiva === 'datos' && (
        <div className="surface p-6 md:p-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-teal-100 text-teal-700">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Datos básicos</h2>
              <p className="text-sm text-slate-500">Información personal y de contacto</p>
            </div>
          </div>

          <form onSubmit={handleSubmitPerfil} className="max-w-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Nombre</label>
                <input
                  className="input-base"
                  defaultValue={cliente?.nombre}
                  onChange={e => setForm(s => ({ ...s, nombre: e.target.value }))}
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Apellido</label>
                <input
                  className="input-base"
                  defaultValue={cliente?.apellido}
                  onChange={e => setForm(s => ({ ...s, apellido: e.target.value }))}
                  placeholder="Tu apellido"
                />
              </div>
            </div>

            {/* Documento de identidad */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Tipo doc.</label>
                <select
                  className="input-base"
                  defaultValue={cliente?.tipoDoc ?? 'CC'}
                  onChange={e => setForm(s => ({ ...s, tipoDoc: e.target.value }))}
                >
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="NIT">NIT</option>
                  <option value="PEP">PEP</option>
                  <option value="PPT">PPT</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Número de documento</label>
                <input
                  className="input-base"
                  defaultValue={cliente?.documento ?? ''}
                  onChange={e => setForm(s => ({ ...s, documento: e.target.value }))}
                  placeholder="1.234.567.890"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
              <input
                className="input-base bg-slate-50 text-slate-400 cursor-not-allowed"
                defaultValue={cliente?.email}
                disabled
              />
              <p className="text-[10px] text-slate-400 mt-1">El correo no se puede modificar</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Teléfono</label>
                <input
                  className="input-base"
                  defaultValue={cliente?.telefono ?? ''}
                  onChange={e => setForm(s => ({ ...s, telefono: e.target.value }))}
                  placeholder="300 123 4567"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Ciudad</label>
                <input
                  className="input-base"
                  defaultValue={cliente?.ciudad ?? ''}
                  onChange={e => setForm(s => ({ ...s, ciudad: e.target.value }))}
                  placeholder="Pereira"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={mutationPerfil.isPending}
              >
                <Save size={16} />
                {mutationPerfil.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setForm({
                    nombre: cliente?.nombre ?? '',
                    apellido: cliente?.apellido ?? '',
                    tipoDoc: cliente?.tipoDoc ?? 'CC',
                    documento: cliente?.documento ?? '',
                    telefono: cliente?.telefono ?? '',
                    ciudad: cliente?.ciudad ?? '',
                  })
                }}
              >
                <RotateCcw size={14} /> Restaurar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tab: Perfil de Salud ─────────────────────────── */}
      {tabActiva === 'salud' && (
        <div className="space-y-6 animate-fade-in">
          <div className="surface p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                <Heart size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Perfil de salud</h2>
                <p className="text-sm text-slate-500">
                  Esta información nos ayuda a advertirte sobre posibles interacciones y alérgenos al momento de comprar
                </p>
              </div>
            </div>

            <div className="max-w-xl space-y-5">
              {/* Alérgenos */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  Alérgenos / Excipientes
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Ingresa tus alérgenos conocidos separados por coma. Ejemplo: <em>lactosa, gluten, maní, colorante amarillo</em>
                </p>
                <textarea
                  value={alergenosInput}
                  onChange={e => setAlergenosInput(e.target.value)}
                  placeholder="lactosa, gluten, aspirina, penicilina"
                  rows={3}
                  className="input-base w-full resize-none"
                />
                {alergenosInput.trim() && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {alergenosInput.split(',').map(a => a.trim()).filter(Boolean).map((al, i) => (
                      <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold uppercase">
                        {al}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Condiciones preexistentes */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Stethoscope size={16} className="text-blue-500" />
                  Condiciones preexistentes
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Ingresa condiciones de salud relevantes separadas por coma. Ejemplo: <em>diabetes, hipertensión, asma</em>
                </p>
                <textarea
                  value={condicionesInput}
                  onChange={e => setCondicionesInput(e.target.value)}
                  placeholder="diabetes, hipertensión, asma, hipotiroidismo"
                  rows={3}
                  className="input-base w-full resize-none"
                />
              </div>

              <button
                onClick={handleGuardarSalud}
                disabled={mutationSalud.isPending}
                className="btn-primary"
              >
                <Save size={16} />
                {mutationSalud.isPending ? 'Guardando...' : 'Guardar perfil de salud'}
              </button>

              {/* Info box */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
                <Info size={18} className="text-sky-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-sky-800">
                  <p className="font-semibold mb-1">¿Cómo se usa esta información?</p>
                  <p className="leading-relaxed">
                    Al agregar productos al carrito, verificaremos automáticamente si contienen
                    alérgenos que hayas registrado. Si detectamos una posible reacción, te mostraremos
                    una advertencia antes de finalizar la compra. También podrás verificar interacciones
                    entre medicamentos desde la ficha de producto.
                  </p>
                  <p className="font-semibold mt-2 text-[10px]">
                    ⚕️ Esta herramienta es informativa y no reemplaza la consulta con un profesional de la salud.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Programa de Puntos ──────────────────────── */}
      {tabActiva === 'puntos' && (
        <div className="surface p-6 md:p-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
              <Coins size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Programa de puntos</h2>
              <p className="text-sm text-slate-500">Acumula puntos por tus compras y canjéalos como cashback</p>
            </div>
          </div>

          <div className="flex flex-col items-center py-6">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-200">
                <Coins size={36} className="text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md">
                <span className="text-amber-600 font-bold text-xs">★</span>
              </div>
            </div>
            <div className="text-center mb-4">
              <div className="text-5xl font-bold text-amber-600">
                {cliente?.puntosAcumulados ?? 0}
              </div>
              <p className="text-sm text-slate-500 mt-1">puntos acumulados</p>
            </div>
            {cliente?.puntosExpiranEn && (
              <div className="text-sm text-slate-400 mb-6">
                Expiran: {new Date(cliente.puntosExpiranEn).toLocaleDateString('es-CO')}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 w-full max-w-md text-sm">
              <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                <Info size={16} /> ¿Cómo funcionan?
              </h3>
              <ul className="space-y-2 text-amber-800">
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>Acumulas <strong>1 punto por cada $1.000 COP</strong> en tus compras</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>Puedes usar tus puntos como <strong>cashback</strong> en tu próxima compra</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>Los puntos tienen una vigencia de <strong>12 meses</strong> desde su acumulación</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
