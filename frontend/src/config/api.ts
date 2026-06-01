import axios from 'axios'
import { useAuthStore }        from '@/store/authStore'
import { useAuthClienteStore } from '@/store/authStore'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

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