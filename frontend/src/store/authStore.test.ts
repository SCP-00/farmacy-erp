// ══════════════════════════════════════════════════════════
//  authStore.test.ts — Tests de autenticación (empleado + cliente)
// ══════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore, useAuthClienteStore } from './authStore'
import { useCarritoStore } from './carritoStore'

// Mock window.location.href
const mockLocation = { href: '' }
Object.defineProperty(window, 'location', { value: mockLocation, writable: true })

// Mock localStorage
const localStorageMock: Record<string, string> = {}
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageMock[key] ?? null,
    setItem: (key: string, value: string) => { localStorageMock[key] = value },
    removeItem: (key: string) => { delete localStorageMock[key] },
    clear: () => { Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]) },
  },
  writable: true,
})

const empleadoFixture = {
  id: 'emp-1',
  nombre: 'Juan Pérez',
  email: 'juan@farmacy.co',
  rol: 'ADMINISTRADOR',
  sucursal: 'Sede Principal',
  sucursalId: 1,
}

const clienteFixture = {
  id: 'cli-1',
  nombre: 'María',
  apellido: 'López',
  email: 'maria@ejemplo.co',
  puntos: 150,
}

// ── useAuthStore (Empleado) ──────────────────────────
describe('useAuthStore (Empleado)', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, refreshToken: null, empleado: null })
    mockLocation.href = ''
  })

  describe('setLogin', () => {
    it('almacena token, refreshToken y datos del empleado', () => {
      useAuthStore.getState().setLogin('tok-123', 'ref-456', empleadoFixture)
      const state = useAuthStore.getState()

      expect(state.token).toBe('tok-123')
      expect(state.refreshToken).toBe('ref-456')
      expect(state.empleado).toEqual(empleadoFixture)
    })
  })

  describe('setToken', () => {
    it('actualiza solo el token (para refresh)', () => {
      useAuthStore.getState().setLogin('old-token', 'ref', empleadoFixture)
      useAuthStore.getState().setToken('new-token')

      expect(useAuthStore.getState().token).toBe('new-token')
      expect(useAuthStore.getState().empleado).toEqual(empleadoFixture)
    })
  })

  describe('cerrarSesion', () => {
    it('limpia token, refreshToken y empleado', () => {
      useAuthStore.getState().setLogin('tok', 'ref', empleadoFixture)
      useAuthStore.getState().cerrarSesion()

      const state = useAuthStore.getState()
      expect(state.token).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.empleado).toBeNull()
    })

    it('redirige a /admin/login', () => {
      useAuthStore.getState().cerrarSesion()
      expect(mockLocation.href).toBe('/admin/login')
    })
  })

  describe('estaLogueado', () => {
    it('retorna false sin sesión', () => {
      expect(useAuthStore.getState().estaLogueado()).toBe(false)
    })

    it('retorna true con token y empleado', () => {
      useAuthStore.getState().setLogin('tok', 'ref', empleadoFixture)
      expect(useAuthStore.getState().estaLogueado()).toBe(true)
    })

    it('retorna false con token pero sin empleado', () => {
      useAuthStore.setState({ token: 'tok', empleado: null })
      expect(useAuthStore.getState().estaLogueado()).toBe(false)
    })
  })

  describe('tieneRol', () => {
    it('retorna true si el empleado tiene el rol', () => {
      useAuthStore.getState().setLogin('tok', 'ref', { ...empleadoFixture, rol: 'FARMACEUTA' })
      expect(useAuthStore.getState().tieneRol('FARMACEUTA')).toBe(true)
    })

    it('retorna true si el rol está en la lista de roles permitidos', () => {
      useAuthStore.getState().setLogin('tok', 'ref', { ...empleadoFixture, rol: 'AUXILIAR' })
      expect(useAuthStore.getState().tieneRol('ADMINISTRADOR', 'AUXILIAR')).toBe(true)
    })

    it('retorna false si el rol no está en la lista', () => {
      useAuthStore.getState().setLogin('tok', 'ref', { ...empleadoFixture, rol: 'AUXILIAR' })
      expect(useAuthStore.getState().tieneRol('ADMINISTRADOR')).toBe(false)
    })

    it('retorna false sin sesión', () => {
      expect(useAuthStore.getState().tieneRol('ADMINISTRADOR')).toBe(false)
    })
  })
})

// ── useAuthClienteStore (Cliente B2C) ────────────────
describe('useAuthClienteStore (Cliente)', () => {
  beforeEach(() => {
    useAuthClienteStore.setState({ token: null, cliente: null })
    useCarritoStore.setState({ items: [] })
    mockLocation.href = ''
  })

  describe('setLogin', () => {
    it('almacena token y datos del cliente', () => {
      useAuthClienteStore.getState().setLogin('cli-tok', clienteFixture)

      expect(useAuthClienteStore.getState().token).toBe('cli-tok')
      expect(useAuthClienteStore.getState().cliente).toEqual(clienteFixture)
    })

    it('limpia el carrito al hacer login', () => {
      useCarritoStore.getState().agregar({
        productoId: 'p1', nombre: 'Test', marca: 'X', presentacion: 'Tabletas',
        concentracion: '100mg', precioUnitario: 5000, cantidad: 2,
        stockMaximo: 10, requiereRx: false, disponibleEnvio: true, disponibleTienda: true,
      })
      expect(useCarritoStore.getState().items).toHaveLength(1)

      useAuthClienteStore.getState().setLogin('cli-tok', clienteFixture)
      expect(useCarritoStore.getState().items).toHaveLength(0)
    })
  })

  describe('cerrarSesion', () => {
    it('limpia token y cliente', () => {
      useAuthClienteStore.getState().setLogin('tok', clienteFixture)
      useAuthClienteStore.getState().cerrarSesion()

      expect(useAuthClienteStore.getState().token).toBeNull()
      expect(useAuthClienteStore.getState().cliente).toBeNull()
    })

    it('limpia el carrito', () => {
      useCarritoStore.getState().agregar({
        productoId: 'p1', nombre: 'Test', marca: 'X', presentacion: 'Tabletas',
        concentracion: '100mg', precioUnitario: 5000, cantidad: 1,
        stockMaximo: 10, requiereRx: false, disponibleEnvio: true, disponibleTienda: true,
      })
      useAuthClienteStore.getState().cerrarSesion()
      expect(useCarritoStore.getState().items).toHaveLength(0)
    })

    it('redirige a /login', () => {
      useAuthClienteStore.getState().cerrarSesion()
      expect(mockLocation.href).toBe('/login')
    })

    it('limpia datos de checkout de localStorage', () => {
      localStorageMock['checkout_datos_envio'] = JSON.stringify({ ciudad: 'Bogotá' })
      useAuthClienteStore.getState().cerrarSesion()
      expect(localStorageMock['checkout_datos_envio']).toBeUndefined()
    })
  })

  describe('estaLogueado', () => {
    it('retorna false sin sesión', () => {
      expect(useAuthClienteStore.getState().estaLogueado()).toBe(false)
    })

    it('retorna true con token y cliente', () => {
      useAuthClienteStore.getState().setLogin('tok', clienteFixture)
      expect(useAuthClienteStore.getState().estaLogueado()).toBe(true)
    })
  })

  describe('actualizarPuntos', () => {
    it('actualiza los puntos del cliente', () => {
      useAuthClienteStore.getState().setLogin('tok', clienteFixture)
      useAuthClienteStore.getState().actualizarPuntos(500)

      expect(useAuthClienteStore.getState().cliente?.puntos).toBe(500)
    })

    it('no falla sin sesión activa', () => {
      // No debe lanzar error
      expect(() => useAuthClienteStore.getState().actualizarPuntos(100)).not.toThrow()
    })
  })
})
