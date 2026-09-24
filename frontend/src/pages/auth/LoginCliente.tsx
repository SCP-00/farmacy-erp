// LoginCliente.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuthCliente } from '@/hooks'

export function LoginClienteComponent() {
  const { login, loginLoading, googleUrl } = useAuthCliente()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [verPass, setVerPass]   = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login({ email, password })
  }

  return (
    <>
      <h2 className="text-xl font-semibold mb-1">Iniciar sesión</h2>
      <p className="text-sm text-gray-500 mb-6">Accede a tu cuenta Farmacy</p>

      {/* OAuth */}
      <div className="space-y-2 mb-5">
        <a href={googleUrl}
          className="flex items-center justify-center gap-3 w-full py-2.5 border border-[#D8EBE4]
                     rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </a>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-[#D8EBE4]"/>
        <span className="text-xs text-gray-400">o con tu correo</span>
        <div className="flex-1 h-px bg-[#D8EBE4]"/>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="cliente-email" className="block text-xs font-medium text-gray-700 mb-1.5">Correo</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input id="cliente-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="input-base pl-10" placeholder="tu@correo.com" autoComplete="email" required/>
          </div>
        </div>
        <div>
          <label htmlFor="cliente-password" className="block text-xs font-medium text-gray-700 mb-1.5">Contraseña</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input id="cliente-password" type={verPass ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-base pl-10 pr-10" placeholder="••••••••" autoComplete="current-password" required/>
            <button type="button" onClick={() => setVerPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {verPass ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <Link to="/recuperar" className="text-xs text-teal-700 hover:underline">¿Olvidaste tu contraseña?</Link>
        </div>
        <button type="submit" disabled={loginLoading}
          className="w-full py-3 bg-teal-700 text-white rounded-xl font-semibold text-sm
                     hover:bg-teal-600 disabled:opacity-60 transition-all">
          {loginLoading ? 'Verificando...' : 'Iniciar sesión'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-5">
        ¿No tienes cuenta?{' '}
        <Link to="/registro" className="text-teal-700 font-medium hover:underline">Crear una gratis</Link>
      </p>
    </>
  )
}

export default LoginClienteComponent