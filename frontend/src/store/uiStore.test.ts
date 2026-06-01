// ══════════════════════════════════════════════════════════
//  uiStore.test.ts — Tests del estado de UI
// ══════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUiStore } from './uiStore'

// Mock localStorage
const store: Record<string, string> = {}
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  },
  writable: true,
})

// Mock document.documentElement.classList
const classListMock = {
  _classes: new Set<string>(),
  add: vi.fn((cls: string) => classListMock._classes.add(cls)),
  remove: vi.fn((cls: string) => classListMock._classes.delete(cls)),
  toggle: vi.fn((cls: string, force?: boolean) => {
    if (force === false || (!classListMock._classes.has(cls) && force === undefined)) {
      classListMock._classes.delete(cls)
    } else {
      classListMock._classes.add(cls)
    }
  }),
  contains: vi.fn((cls: string) => classListMock._classes.has(cls)),
}
Object.defineProperty(document, 'documentElement', {
  value: { classList: classListMock },
  writable: true,
})

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      sidebarAbierto: false,
      carritoAbierto: false,
      chatbotAbierto: false,
      modalActivo: null,
      darkMode: false,
    })
    Object.keys(store).forEach(k => delete store[k])
    classListMock._classes.clear()
    vi.clearAllMocks()
  })

  // ── Sidebar ─────────────────────────────────────────
  describe('toggleSidebar', () => {
    it('abre la sidebar cuando está cerrada', () => {
      useUiStore.getState().toggleSidebar()
      expect(useUiStore.getState().sidebarAbierto).toBe(true)
    })

    it('cierra la sidebar cuando está abierta', () => {
      useUiStore.setState({ sidebarAbierto: true })
      useUiStore.getState().toggleSidebar()
      expect(useUiStore.getState().sidebarAbierto).toBe(false)
    })
  })

  // ── Carrito drawer ──────────────────────────────────
  describe('toggleCarrito', () => {
    it('abre el carrito cuando está cerrado', () => {
      useUiStore.getState().toggleCarrito()
      expect(useUiStore.getState().carritoAbierto).toBe(true)
    })

    it('cierra el carrito cuando está abierto', () => {
      useUiStore.setState({ carritoAbierto: true })
      useUiStore.getState().toggleCarrito()
      expect(useUiStore.getState().carritoAbierto).toBe(false)
    })
  })

  // ── Chatbot ─────────────────────────────────────────
  describe('toggleChatbot', () => {
    it('abre el chatbot', () => {
      useUiStore.getState().toggleChatbot()
      expect(useUiStore.getState().chatbotAbierto).toBe(true)
    })

    it('cierra el chatbot', () => {
      useUiStore.setState({ chatbotAbierto: true })
      useUiStore.getState().toggleChatbot()
      expect(useUiStore.getState().chatbotAbierto).toBe(false)
    })
  })

  // ── Modal ───────────────────────────────────────────
  describe('modales', () => {
    it('abre un modal con el id dado', () => {
      useUiStore.getState().abrirModal('confirmacion')
      expect(useUiStore.getState().modalActivo).toBe('confirmacion')
    })

    it('cierra el modal activo', () => {
      useUiStore.getState().abrirModal('confirmacion')
      useUiStore.getState().cerrarModal()
      expect(useUiStore.getState().modalActivo).toBeNull()
    })

    it('reemplaza el modal activo al abrir otro', () => {
      useUiStore.getState().abrirModal('modal-1')
      useUiStore.getState().abrirModal('modal-2')
      expect(useUiStore.getState().modalActivo).toBe('modal-2')
    })
  })

  // ── Dark mode ───────────────────────────────────────
  describe('dark mode', () => {
    it('toggleDarkMode cambia de false a true', () => {
      useUiStore.setState({ darkMode: false })
      useUiStore.getState().toggleDarkMode()
      expect(useUiStore.getState().darkMode).toBe(true)
    })

    it('toggleDarkMode cambia de true a false', () => {
      useUiStore.setState({ darkMode: true })
      useUiStore.getState().toggleDarkMode()
      expect(useUiStore.getState().darkMode).toBe(false)
    })

    it('persiste dark mode en localStorage', () => {
      useUiStore.getState().toggleDarkMode()
      expect(store['farmacy-dark-mode']).toBe('true')
    })

    it('toggleDarkMode actualiza classList del document', () => {
      useUiStore.setState({ darkMode: false })
      useUiStore.getState().toggleDarkMode()
      expect(classListMock.toggle).toHaveBeenCalledWith('dark', true)
    })

    it('setDarkMode fuerza un valor específico', () => {
      useUiStore.getState().setDarkMode(true)
      expect(useUiStore.getState().darkMode).toBe(true)

      useUiStore.getState().setDarkMode(true) // ya está true
      expect(useUiStore.getState().darkMode).toBe(true)
    })

    it('setDarkMode(false) quita la clase dark', () => {
      useUiStore.setState({ darkMode: true })
      useUiStore.getState().setDarkMode(false)
      expect(classListMock.toggle).toHaveBeenCalledWith('dark', false)
    })
  })
})
