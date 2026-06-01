// ══════════════════════════════════════════════════════════
//  authStore.ts — Estado global de autenticación
// ══════════════════════════════════════════════════════════
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCarritoStore, setClienteIdCarrito } from './carritoStore'

/** Estado y acciones del store de autenticación de empleados (admin).
 * - Almacena token JWT, refresh token y datos del empleado
 * - Persiste en localStorage via Zustand `persist` middleware
 * - Provee helpers `estaLogueado()` y `tieneRol()` para control de acceso
 */
interface EmpleadoState {
  token:        string | null
  refreshToken: string | null
  empleado: {
    id:        string
    nombre:    string
    email:     string
    rol:       string
    sucursal?: string | null
    sucursalId?: number | null
  } | null
  setLogin:      (token: string, refreshToken: string, empleado: EmpleadoState['empleado']) => void
  setToken:      (token: string) => void
  cerrarSesion:  () => void
  estaLogueado:  () => boolean
  tieneRol:      (...roles: string[]) => boolean
}

export const useAuthStore = create<EmpleadoState>()(
  persist(
    (set, get) => ({
      token:        null,
      refreshToken: null,
      empleado:     null,

      setLogin: (token, refreshToken, empleado) =>
        set({ token, refreshToken, empleado }),

      setToken: (token) => set({ token }),

      cerrarSesion: () => {
        set({ token: null, refreshToken: null, empleado: null })
        window.location.href = '/admin/login'
      },

      estaLogueado: () => !!get().token && !!get().empleado,

      tieneRol: (...roles) => {
        const rol = get().empleado?.rol
        return !!rol && roles.includes(rol)
      },
    }),
    { name: 'farmacy-empleado-auth' }
  )
)

/** Estado y acciones del store de autenticación de clientes (B2C).
 * - Almacena token JWT y datos del cliente
 * - Persiste en localStorage via Zustand `persist` middleware
 * - Provee `actualizarPuntos()` para actualizar puntos de fidelidad
 */
interface ClienteState {
  token:    string | null
  cliente: {
    id:      string
    nombre:  string
    apellido:string
    email:   string
    puntos:  number
  } | null
  setLogin:     (token: string, cliente: ClienteState['cliente']) => void
  cerrarSesion: () => void
  estaLogueado: () => boolean
  actualizarPuntos: (puntos: number) => void
}

export const useAuthClienteStore = create<ClienteState>()(
  persist(
    (set, get) => ({
      token:   null,
      cliente: null,

      setLogin: (token, cliente) => {
        useCarritoStore.getState().limpiar()
        setClienteIdCarrito(cliente?.id ?? null)
        set({ token, cliente })
      },

      cerrarSesion: () => {
        set({ token: null, cliente: null })
        useCarritoStore.getState().limpiar()
        setClienteIdCarrito(null)
        // Limpiar datos de checkout persistentes para evitar mezcla entre usuarios
        try { localStorage.removeItem('checkout_datos_envio') } catch { /* ignore */ }
        window.location.href = '/login'
      },

      estaLogueado: () => !!get().token && !!get().cliente,

      actualizarPuntos: (puntos) => {
        const c = get().cliente
        if (c) set({ cliente: { ...c, puntos } })
      },
    }),
    { name: 'farmacy-cliente-auth' }
  )
)