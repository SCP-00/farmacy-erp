import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useEffect } from 'react'
import { X, Save, Eye, EyeOff } from 'lucide-react'
import { empleadosService, sucursalesService } from '@/services'
import toast from 'react-hot-toast'
import { InputField, SelectField } from '@/components/shared/InputField'

// ── Esquema de validación con Zod ─────────────────────────
const empleadoSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  apellido: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  email: z.string().email('Debe ser un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  rol: z.enum(['ADMINISTRADOR', 'FARMACEUTA', 'AUXILIAR'], { required_error: 'Seleccione un rol' }),
  sucursalId: z.coerce.number().min(1, 'Seleccione una sucursal'),
})

type EmpleadoFormData = z.infer<typeof empleadoSchema>

interface Props {
  empleadoActual?: any // Si es undefined, es creación
  onClose: () => void
  onSuccess: () => void
}

export default function FormularioEmpleado({ empleadoActual, onClose, onSuccess }: Props) {
  const isEditing = !!empleadoActual
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [sucursales, setSucursales] = useState<any[]>([])

  const { register, handleSubmit, formState: { errors } } = useForm<EmpleadoFormData>({
    resolver: zodResolver(empleadoSchema),
    defaultValues: {
      nombre: empleadoActual?.nombre || '',
      apellido: empleadoActual?.apellido || '',
      email: empleadoActual?.email || '',
      rol: empleadoActual?.rol || 'AUXILIAR',
      sucursalId: empleadoActual?.sucursal?.id || empleadoActual?.sucursalId || '',
      password: '',
    }
  })

  // Cargar sucursales al abrir el form
  useEffect(() => {
    sucursalesService.listar().then((data) => setSucursales(data || []))
  }, [])

  const onSubmit = async (data: EmpleadoFormData) => {
    setLoading(true)
    try {
      if (isEditing) {
        const { password, ...rest } = data
        const payload = password ? { password, ...rest } : rest
        await empleadosService.actualizar(empleadoActual.id, payload)
        toast.success('Empleado actualizado correctamente')
      } else {
        if (!data.password) {
          toast.error('La contraseña es obligatoria para nuevos empleados')
          setLoading(false)
          return
        }
        await empleadosService.crear(data)
        toast.success('Empleado creado correctamente')
      }
      onSuccess()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al guardar el empleado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-semibold text-gray-800">
            {isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6">
          <form id="empleado-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Nombre"
                {...register('nombre')}
                error={errors.nombre?.message}
                touched={true}
                required
                placeholder="Ej. Carlos"
              />
              <InputField
                label="Apellido"
                {...register('apellido')}
                error={errors.apellido?.message}
                touched={true}
                required
                placeholder="Ej. Pérez"
              />
            </div>

            <InputField
              label="Correo Electrónico"
              type="email"
              {...register('email')}
              error={errors.email?.message}
              touched={true}
              required
              placeholder="correo@farmacy.co"
            />

            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Rol"
                {...register('rol')}
                error={errors.rol?.message}
                touched={true}
                required
              >
                <option value="AUXILIAR">Auxiliar</option>
                <option value="FARMACEUTA">Farmaceuta</option>
                <option value="ADMINISTRADOR">Administrador</option>
              </SelectField>

              <SelectField
                label="Sucursal"
                {...register('sucursalId')}
                error={errors.sucursalId?.message}
                touched={true}
                required
                placeholder="Seleccione..."
              >
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </SelectField>
            </div>

            <div>
              <div className="relative">
                <InputField
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  error={errors.password?.message}
                  touched={true}
                  placeholder="******"
                  helperText={isEditing ? 'Dejar en blanco para mantener la contraseña actual' : 'Mínimo 6 caracteres'}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 bottom-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="empleado-form"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Guardar Empleado
          </button>
        </div>

      </div>
    </div>
  )
}
