import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Mail, Shield, Calendar, Clock, CheckCircle, XCircle, Phone, MapPin, Edit3 } from 'lucide-react'
import { } from '@/config/constants'
import toast from 'react-hot-toast'

const MOCK_EMPLEADO = {
  id: '1',
  nombre: 'Carlos Andrés',
  apellido: 'Farmacéutico Pérez',
  email: 'carlos@farmacy.co',
  telefono: '+57 300 123 4567',
  rol: 'FARMACEUTA' as const,
  activo: true,
  documento: 'CC 1.234.567',
  direccion: 'Calle 45 # 20-30, Bogotá',
  fechaIngreso: '2025-03-15',
  ultimoAcceso: '2026-05-20T10:30:00',
  sucursal: 'Sede Centro',
}

const ROL_LABELS: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  FARMACEUTA: 'Farmacéutico(a)',
  AUXILIAR: 'Auxiliar',
}

export default function DetalleEmpleado() {
  const { id: _id } = useParams()
  const [empleado, setEmpleado] = useState(MOCK_EMPLEADO)

  const toggleEstado = () => {
    setEmpleado(prev => ({ ...prev, activo: !prev.activo }))
    toast.success(`Empleado ${empleado.activo ? 'desactivado' : 'activado'} exitosamente`)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Volver */}
      <Link to="/admin/empleados" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft size={16} /> Volver a empleados
      </Link>

      {/* Perfil */}
      <div className="surface overflow-hidden">
        <div className="bg-gradient-to-r from-teal-900 via-teal-700 to-blue-700 px-6 py-8 md:px-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
              {empleado.nombre.charAt(0)}{empleado.apellido.charAt(0)}
            </div>
            <div className="text-white">
              <h1 className="text-2xl font-bold">{empleado.nombre} {empleado.apellido}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30">
                  {ROL_LABELS[empleado.rol] ?? empleado.rol}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs ${empleado.activo ? 'text-green-200' : 'text-red-200'}`}>
                  {empleado.activo ? <CheckCircle size={12} /> : <XCircle size={12} />}
                  {empleado.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 md:px-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Información personal */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Información personal</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail size={16} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">{empleado.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={16} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">{empleado.telefono}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin size={16} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">{empleado.direccion}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Shield size={16} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">{empleado.documento}</span>
                </div>
              </div>
            </div>

            {/* Información laboral */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Información laboral</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Shield size={16} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">{ROL_LABELS[empleado.rol] ?? empleado.rol}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar size={16} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">Ingresó el {new Date(empleado.fechaIngreso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock size={16} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">Último acceso: {new Date(empleado.ultimoAcceso).toLocaleString('es-CO')}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin size={16} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">{empleado.sucursal}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
            <button onClick={toggleEstado}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                ${empleado.activo
                  ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}>
              {empleado.activo ? <XCircle size={16} /> : <CheckCircle size={16} />}
              {empleado.activo ? 'Desactivar empleado' : 'Activar empleado'}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-all">
              <Edit3 size={16} /> Editar información
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
