import axios from 'axios'
import { useAuthStore }        from '@/store/authStore'
import { useAuthClienteStore } from '@/store/authStore'

// Orden de resolución del servidor API:
//  1. VITE_API_URL compilada (deploys web: nube/staging) — fija.
//  2. localStorage 'farmacy.apiBaseUrl' (apps de escritorio Tauri/Electron
//     o POS en LAN: el farmacéuta escribe la URL de su servidor una vez
//     en la pantalla de login, p. ej. https://api.mi-farmacia.com/v1).
//  3. '/api/v1' (web con proxy del propio origin).
export const API_URL_COMPILADA = import.meta.env.VITE_API_URL || ''
export const API_URL_LOCALSTORAGE = 'farmacy.apiBaseUrl'
export function resolverBaseUrl(): string {
  if (API_URL_COMPILADA) return API_URL_COMPILADA
  try {
    const guardada = localStorage.getItem(API_URL_LOCALSTORAGE)
    if (guardada) return guardada.replace(/\/$/, '')
  } catch { /* localStorage no disponible (SSR/test) */ }
  // Empaquetado de escritorio (Tauri/Electron) sin servidor configurado:
  // apunta al backend local instalado en el mismo equipo. El farmacéuta
  // puede cambiarlo por el de su empresa desde el login.
  const esDesktop = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || 'electronAPI' in window)
  if (esDesktop) return 'http://localhost:3000/api/v1'
  return '/api/v1'
}
const BASE_URL = resolverBaseUrl()

/**
 * Cliente axios autenticado para empleados (admin/farmaceuta/auxiliar).
 * Incluye interceptor de refresh token automático en 401.
 *
 * @example
 * ```ts
 * import { api } from '@/config/api'
 * const { data } = await api.get('/categorias')
 * ```
 */
export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      // Intentar refresh token
      const refreshToken = useAuthStore.getState().refreshToken
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
          useAuthStore.getState().setToken(data.data.token)
          error.config.headers.Authorization = `Bearer ${data.data.token}`
          return axios(error.config)
        } catch {
          useAuthStore.getState().cerrarSesion()
        }
      }
    }
    return Promise.reject(error)
  }
)

/**
 * Cliente axios autenticado para clientes de la tienda web.
 * Usa el token de `useAuthClienteStore`. En 401 cierra sesión automáticamente.
 */
export const apiCliente = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

apiCliente.interceptors.request.use((config) => {
  const token = useAuthClienteStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiCliente.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthClienteStore.getState().cerrarSesion()
    }
    return Promise.reject(error)
  }
)

/**
 * Cliente axios público sin autenticación.
 * Para consultas abiertas como catálogo, sucursales, etc.
 */
export const apiPublica = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})