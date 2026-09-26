import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Send } from 'lucide-react'
import { authClienteService } from '@/services'
import toast from 'react-hot-toast'

export default function RecuperarPassword() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setCargando(true)
    try {
      await authClienteService.recuperarPassword(email)
      setEnviado(true)
      toast.success('Revisa tu bandeja de entrada')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al enviar el correo. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  if (enviado) {
    return (
      <>
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mb-4">
            <Send size={28} className="text-teal-700" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Correo enviado</h2>
          <p className="text-sm text-gray-500 mb-2 max-w-xs">
            Si existe una cuenta con <strong className="text-gray-700">{email}</strong>, recibirás un enlace para restablecer tu contraseña.
          </p>
          <p className="text-xs text-gray-400 mb-6">Revisa también tu carpeta de spam.</p>
          <Link to="/login" className="text-sm text-teal-700 hover:underline font-medium flex items-center gap-1">
            <ArrowLeft size={14} /> Volver al inicio de sesión
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <h2 className="text-xl font-semibold mb-1">Recuperar acceso</h2>
      <p className="text-sm text-gray-500 mb-6">
        Te enviaremos un enlace seguro para restablecer tu contraseña.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="recuperar-email" className="block text-xs font-medium text-gray-700 mb-1.5">Correo electrónico</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="recuperar-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input-base pl-10" placeholder="tucorreo@ejemplo.com" autoComplete="email" required />
          </div>
        </div>

        <button type="submit" disabled={cargando || !email}
          className="w-full py-3 bg-teal-700 text-white rounded-xl font-semibold text-sm
                     hover:bg-teal-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {cargando ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
          ) : (
            <><Send size={16} /> Enviar enlace</>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        <Link to="/login" className="text-teal-700 font-medium hover:underline flex items-center justify-center gap-1">
          <ArrowLeft size={14} /> Volver al inicio de sesión
        </Link>
      </p>
    </>
  )
}
