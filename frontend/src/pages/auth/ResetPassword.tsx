import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, KeyRound } from 'lucide-react'
import { authClienteService } from '@/services'
import toast from 'react-hot-toast'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'Min. 8 caracteres', ok: password.length >= 8 },
    { label: 'Una mayúscula', ok: /[A-Z]/.test(password) },
    { label: 'Una minúscula', ok: /[a-z]/.test(password) },
    { label: 'Un número', ok: /\d/.test(password) },
  ]
  const strength = checks.filter(c => c.ok).length
  const barColor = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-400', 'bg-green-400']
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {checks.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < strength ? barColor[strength - 1] : 'bg-gray-200'}`} />
        ))}
      </div>
      <ul className="space-y-0.5">
        {checks.map((c, i) => (
          <li key={i} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-green-600' : 'text-gray-400'}`}>
            {c.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function ResetPassword() {
  const _disabled_navigate = useNavigate() // eslint: unused
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [verPass, setVerPass] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [completado, setCompletado] = useState(false)

  if (!token) {
    return (
      <>
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Enlace inválido</h2>
          <p className="text-sm text-gray-500 mb-4">Este enlace de recuperación no es válido o ha expirado.</p>
          <Link to="/recuperar-password" className="text-sm text-teal-700 hover:underline font-medium">
            Solicitar un nuevo enlace
          </Link>
        </div>
      </>
    )
  }

  const passwordValida = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
  const passwordCoincide = password === confirmar

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordValida) return toast.error('La contraseña no cumple con los requisitos de seguridad')
    if (!passwordCoincide) return toast.error('Las contraseñas no coinciden')

    setCargando(true)
    try {
      await authClienteService.resetPassword(token, password)
      setCompletado(true)
      toast.success('Contraseña actualizada exitosamente')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al restablecer la contraseña. El enlace puede haber expirado.')
    } finally {
      setCargando(false)
    }
  }

  if (completado) {
    return (
      <>
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle size={28} className="text-green-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Contraseña actualizada</h2>
          <p className="text-sm text-gray-500 mb-6">Tu contraseña se ha restablecido correctamente.</p>
          <Link to="/login"
            className="w-full py-3 bg-teal-700 text-white rounded-xl font-semibold text-sm
                       hover:bg-teal-600 transition-all text-center block">
            Iniciar sesión
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-1">
        <KeyRound size={20} className="text-teal-700" />
        <h2 className="text-xl font-semibold">Nueva contraseña</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">Define una nueva contraseña segura para tu cuenta.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reset-password" className="block text-xs font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="reset-password" type={verPass ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-base pl-10 pr-10" placeholder="••••••••" autoComplete="new-password" required minLength={8} />
            <button type="button" onClick={() => setVerPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {verPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password.length > 0 && <PasswordStrength password={password} />}
        </div>

        <div>
          <label htmlFor="reset-confirmar" className="block text-xs font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="reset-confirmar" type={verPass ? 'text' : 'password'} value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              className={`input-base pl-10 ${confirmar && !passwordCoincide ? 'border-red-300 focus:border-red-400' : ''}`}
              placeholder="••••••••" autoComplete="new-password" required minLength={8} />
          </div>
          {confirmar && !passwordCoincide && (
            <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
          )}
        </div>

        <button type="submit" disabled={cargando || !passwordValida || !passwordCoincide}
          className="w-full py-3 bg-teal-700 text-white rounded-xl font-semibold text-sm
                     hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {cargando ? 'Restableciendo...' : 'Restablecer contraseña'}
        </button>
      </form>
    </>
  )
}
