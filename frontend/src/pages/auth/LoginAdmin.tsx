import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, Plus, Server } from 'lucide-react'
import { useAuth } from '@/hooks'
import { API_URL_COMPILADA, API_URL_LOCALSTORAGE, resolverBaseUrl } from '@/config/api'

export default function LoginAdmin() {
  const { login, loginLoading } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [verPass,  setVerPass]  = useState(false)
  const [error,    setError]    = useState('')

  // Servidor API configurable en builds de escritorio (Tauri/Electron):
  // el farmacéuta apunta su POS al servidor de su empresa una sola vez.
  // En web compilada contra nube (VITE_API_URL) el campo no aplica.
  const [servidor, setServidor] = useState(() => {
    const base = resolverBaseUrl()
    return base.startsWith('http') ? base : ''
  })
  const mostrarServidor = !API_URL_COMPILADA

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Completa todos los campos'); return }
    if (mostrarServidor && servidor.trim()) {
      try {
        // Validar formato antes de guardarlo: evita dejar el POS apuntando a una URL rota
        const url = new URL(servidor.trim())
        if (!url.protocol.startsWith('http')) throw new Error('protocolo')
        localStorage.setItem(API_URL_LOCALSTORAGE, url.origin + (url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')))
      } catch {
        setError('URL del servidor inválida (ejemplo: https://api.mi-farmacia.com)')
        return
      }
    }
    login({ email, password })
  }

  return (
    <>
      {/* Marca: cruz farmacéutica en espacio negativo */}
      <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-teal-700 shadow-md" aria-hidden="true">
        <Plus size={36} className="text-white" strokeWidth={2.5} />
        <span className="absolute -bottom-3 -right-3 h-8 w-8 rounded-full bg-white/10" />
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-1">Acceso empleados</h2>
      <p className="text-sm text-gray-500 mb-7">Ingresa con tus credenciales de Farmacy</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Servidor API (solo builds de escritorio / LAN) */}
        {mostrarServidor && (
          <div>
            <label htmlFor="admin-servidor" className="block text-sm font-medium text-gray-700 mb-1.5">
              Servidor de la empresa
            </label>
            <div className="relative">
              <Server size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input
                id="admin-servidor"
                type="url"
                value={servidor}
                onChange={e => setServidor(e.target.value)}
                placeholder="https://api.mi-farmacia.com  (vacío = este equipo)"
                autoComplete="url"
                className="input-base pl-10"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Déjalo vacío para usar el servidor local instalado</p>
          </div>
        )}

        {/* Email */}
        <div>
          <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Correo electrónico
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@farmacy.co"
              autoComplete="email"
              className="input-base pl-10"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              id="admin-password"
              type={verPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="input-base pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setVerPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {verPass ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loginLoading}
          className="w-full py-3 bg-teal-700 text-white rounded-xl font-semibold text-sm
                     hover:bg-teal-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {loginLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
              Verificando...
            </>
          ) : 'Ingresar al sistema'}
        </button>
      </form>

      {/* Credenciales de prueba — SOLO en desarrollo: en producción
          un login no debe publicitar cuentas (riesgo de seguridad) */}
      {import.meta.env.DEV && (
        <div className="mt-6 p-4 bg-teal-50 rounded-2xl border border-teal-100">
          <p className="text-xs font-semibold text-teal-800 mb-2">🔐 Credenciales de prueba (solo desarrollo)</p>
          <div className="space-y-1 text-xs text-teal-700 font-mono">
            <p>admin@farmacy.co / Admin@1234</p>
            <p>farmaceuta@farmacy.co / Farm@1234</p>
            <p>auxiliar@farmacy.co / Aux@1234</p>
          </div>
        </div>
      )}

      <div className="mt-4 text-center">
        <Link to="/" className="text-sm text-gray-400 hover:text-teal-700 transition-colors">
          ← Volver a la tienda
        </Link>
      </div>
    </>
  )
}
