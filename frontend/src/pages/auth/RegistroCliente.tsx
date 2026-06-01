import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { authClienteService } from '@/services'
import toast from 'react-hot-toast'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'Min. 8 caracteres', ok: password.length >= 8 },
    { label: 'Una mayúscula', ok: /[A-Z]/.test(password) },
    { label: 'Una minúscula', ok: /[a-z]/.test(password) },
    { label: 'Un número', ok: /\d/.test(password) },
    { label: 'Un carácter especial', ok: /[!@#$%^&*_\-+=]/.test(password) },
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
      {checks.map((c, i) => (
        <p key={i} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-green-600' : 'text-gray-400'}`}>
          {c.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
          {c.label}
        </p>
      ))}
    </div>
  )
}

export default function RegistroCliente() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: '', confirmar: '', tipoDoc: 'CC', documento: '' })
  const [verPass, setVerPass] = useState(false)
  const [aceptoTerminos, setAceptoTerminos] = useState(false)
  const [cargando, setCargando] = useState(false)

  const handleChange = (campo: string, valor: string) => setForm(f => ({ ...f, [campo]: valor }))

  const passwordCoincide = form.password === form.confirmar
  const passwordValida = form.password.length >= 8 && /[A-Z]/.test(form.password) && /[a-z]/.test(form.password) && /\d/.test(form.password) && /[!@#$%^&*_\-+=]/.test(form.password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordCoincide) return toast.error('Las contraseñas no coinciden')
    if (!aceptoTerminos) return toast.error('Debes aceptar los términos y condiciones')
    if (!passwordValida) return toast.error('La contraseña no cumple con los requisitos de seguridad')

    setCargando(true)
    try {
      await authClienteService.registro({
        nombre: form.nombre, apellido: form.apellido,
        email: form.email, password: form.password,
        tipoDoc: form.tipoDoc, documento: form.documento,
        autorizacionDatos: true,
      })
      toast.success('¡Cuenta creada exitosamente! Revisa tu correo para verificar tu cuenta.')
      navigate('/login')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear la cuenta. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      <h2 className="text-xl font-semibold mb-1">Crear cuenta</h2>
      <p className="text-sm text-gray-500 mb-6">Regístrate para comprar en Farmacy</p>

      <form onSubmit={handleSubmit} className="space-y-4">          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-nombre" className="block text-xs font-medium text-gray-700 mb-1.5">Nombre</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input id="reg-nombre" type="text" value={form.nombre} onChange={e => handleChange('nombre', e.target.value)}
                  className="input-base pl-10" placeholder="Juan" autoComplete="given-name" required />
              </div>
            </div>
            <div>
              <label htmlFor="reg-apellido" className="block text-xs font-medium text-gray-700 mb-1.5">Apellido</label>
              <input id="reg-apellido" type="text" value={form.apellido} onChange={e => handleChange('apellido', e.target.value)}
                className="input-base" placeholder="Pérez" autoComplete="family-name" required />
            </div>
          </div>

          {/* Documento de identidad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="reg-tipo-doc" className="block text-xs font-medium text-gray-700 mb-1.5">Tipo doc.</label>
              <select id="reg-tipo-doc" value={form.tipoDoc} onChange={e => handleChange('tipoDoc', e.target.value)}
                className="input-base" required>
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="NIT">NIT</option>
                <option value="PEP">PEP</option>
                <option value="PPT">PPT</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="reg-documento" className="block text-xs font-medium text-gray-700 mb-1.5">Número de documento</label>
              <input id="reg-documento" type="text" value={form.documento} onChange={e => handleChange('documento', e.target.value)}
                className="input-base" placeholder="1.234.567.890" autoComplete="off" required />
            </div>
          </div>

        <div>
          <label htmlFor="reg-email" className="block text-xs font-medium text-gray-700 mb-1.5">Correo electrónico</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="reg-email" type="email" value={form.email} onChange={e => handleChange('email', e.target.value)}
              className="input-base pl-10" placeholder="tucorreo@ejemplo.com" autoComplete="email" required />
          </div>
        </div>

        <div>
          <label htmlFor="reg-password" className="block text-xs font-medium text-gray-700 mb-1.5">Contraseña</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="reg-password" type={verPass ? 'text' : 'password'} value={form.password}
              onChange={e => handleChange('password', e.target.value)}
              className="input-base pl-10 pr-10" placeholder="••••••••" autoComplete="new-password" required minLength={8} />
            <button type="button" onClick={() => setVerPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {verPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {form.password.length > 0 && <PasswordStrength password={form.password} />}
        </div>

        <div>
          <label htmlFor="reg-confirmar" className="block text-xs font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input id="reg-confirmar" type={verPass ? 'text' : 'password'} value={form.confirmar}
              onChange={e => handleChange('confirmar', e.target.value)}
              className={`input-base pl-10 pr-10 ${form.confirmar && !passwordCoincide ? 'border-red-300 focus:border-red-400' : ''}`}
              placeholder="••••••••" autoComplete="new-password" required minLength={8} />
          </div>
          {form.confirmar && !passwordCoincide && (
            <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
          )}
        </div>

        <div className="flex items-start gap-3 cursor-pointer group">
          <input id="reg-terminos" type="checkbox" checked={aceptoTerminos} onChange={e => setAceptoTerminos(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-teal-700 focus:ring-teal-500" />
          <label htmlFor="reg-terminos" className="text-xs text-gray-600 group-hover:text-gray-800 cursor-pointer">
            Acepto los{' '}
            <Link to="/terminos" target="_blank" className="text-teal-700 hover:underline font-medium">Términos y Condiciones</Link>{' '}
            y la{' '}
            <Link to="/privacidad" target="_blank" className="text-teal-700 hover:underline font-medium">Política de Privacidad</Link>, incluyendo el tratamiento de mis datos personales.
          </label>
        </div>

        <button type="submit" disabled={cargando || !passwordCoincide || !passwordValida}
          className="w-full py-3 bg-teal-700 text-white rounded-xl font-semibold text-sm
                     hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="text-teal-700 font-medium hover:underline">Inicia sesión</Link>
      </p>
    </>
  )
}
