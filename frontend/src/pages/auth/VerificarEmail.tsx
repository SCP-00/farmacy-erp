import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { authClienteService } from '@/services'

type Estado = 'verificando' | 'exitoso' | 'error'

export default function VerificarEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [estado, setEstado] = useState<Estado>(token ? 'verificando' : 'error')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    if (!token) {
      setMensaje('No se encontró un token de verificación en el enlace.')
      return
    }
    ;(async () => {
      try {
        await authClienteService.verificarEmail(token)
        setEstado('exitoso')
        setMensaje('Tu correo electrónico ha sido verificado exitosamente.')
      } catch (err: any) {
        setEstado('error')
        setMensaje(err?.response?.data?.error || 'El enlace de verificación no es válido o ha expirado.')
      }
    })()
  }, [token])

  const states = {
    verificando: {
      icon: <Loader2 size={48} className="animate-spin text-teal-600" />,
      title: 'Verificando...',
      bg: 'bg-teal-50',
    },
    exitoso: {
      icon: <CheckCircle size={48} className="text-green-600" />,
      title: '¡Correo verificado!',
      bg: 'bg-green-50',
    },
    error: {
      icon: <XCircle size={48} className="text-red-500" />,
      title: 'Verificación fallida',
      bg: 'bg-red-50',
    },
  }

  const s = states[estado]

  return (
    <div className="flex flex-col items-center text-center py-6">
      <div className={`w-20 h-20 rounded-full ${s.bg} flex items-center justify-center mb-5`}>
        {s.icon}
      </div>
      <h2 className="text-xl font-semibold mb-2">{s.title}</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">{mensaje}</p>

      {estado === 'exitoso' && (
        <Link to="/login"
          className="w-full py-3 bg-teal-700 text-white rounded-xl font-semibold text-sm
                     hover:bg-teal-600 transition-all text-center block">
          Iniciar sesión
        </Link>
      )}
      {estado === 'error' && (
        <div className="space-y-2 w-full">
          <Link to="/login"
            className="w-full py-3 bg-teal-700 text-white rounded-xl font-semibold text-sm
                       hover:bg-teal-600 transition-all text-center block">
            Ir al inicio de sesión
          </Link>
          {!token && (
            <p className="text-xs text-gray-400">
              Si creaste tu cuenta, revisa tu bandeja de entrada para encontrar el enlace de verificación.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
