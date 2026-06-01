// ══════════════════════════════════════════════════════════
//  carritoStore.test.ts — Tests del carrito de compras
// ══════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach } from 'vitest'
import { useCarritoStore, setClienteIdCarrito } from './carritoStore'
import type { CarritoProducto } from '@/types/producto.types'

const makeItem = (overrides: Partial<CarritoProducto> = {}): CarritoProducto => ({
  productoId: 'prod-1',
  nombre: 'Ibuprofeno 400mg',
  marca: 'Genfar',
  presentacion: 'Tabletas',
  concentracion: '400mg',
  precioUnitario: 8500,
  cantidad: 1,
  stockMaximo: 20,
  requiereRx: false,
  disponibleEnvio: true,
  disponibleTienda: true,
  ...overrides,
})

describe('carritoStore', () => {
  beforeEach(() => {
    useCarritoStore.setState({ items: [] })
    setClienteIdCarrito(null)
  })

  // ── Agregar ──────────────────────────────────────────
  describe('agregar', () => {
    it('agrega un producto nuevo al carrito', () => {
      useCarritoStore.getState().agregar(makeItem())
      const items = useCarritoStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].productoId).toBe('prod-1')
      expect(items[0].cantidad).toBe(1)
    })

    it('incrementa cantidad si el producto ya existe', () => {
      const store = useCarritoStore.getState()
      store.agregar(makeItem({ cantidad: 2 }))
      store.agregar(makeItem({ cantidad: 3 }))

      const items = useCarritoStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].cantidad).toBe(5)
    })

    it('no excede el stockMaximo al sumar cantidades', () => {
      const store = useCarritoStore.getState()
      store.agregar(makeItem({ cantidad: 15, stockMaximo: 20 }))
      store.agregar(makeItem({ cantidad: 10, stockMaximo: 20 }))

      expect(useCarritoStore.getState().items[0].cantidad).toBe(20)
    })

    it('agrega productos diferentes como items separados', () => {
      const store = useCarritoStore.getState()
      store.agregar(makeItem({ productoId: 'prod-1' }))
      store.agregar(makeItem({ productoId: 'prod-2', nombre: 'Paracetamol' }))

      expect(useCarritoStore.getState().items).toHaveLength(2)
    })

    it('respetar cantidad mínima de 1', () => {
      useCarritoStore.getState().agregar(makeItem({ cantidad: 0 }))
      expect(useCarritoStore.getState().items[0].cantidad).toBe(1)
    })

    it('respeta stockMaximo del producto al agregar', () => {
      useCarritoStore.getState().agregar(makeItem({ stockMaximo: 3 }))
      const item = useCarritoStore.getState().items[0]
      expect(item.stockMaximo).toBe(3)
      expect(item.cantidad).toBe(1) // cantidad default es 1, no stockMaximo
    })
  })

  // ── Quitar ──────────────────────────────────────────
  describe('quitar', () => {
    it('elimina un producto del carrito', () => {
      const store = useCarritoStore.getState()
      store.agregar(makeItem({ productoId: 'prod-1' }))
      store.agregar(makeItem({ productoId: 'prod-2' }))
      store.quitar('prod-1')

      const items = useCarritoStore.getState().items
      expect(items).toHaveLength(1)
      expect(items[0].productoId).toBe('prod-2')
    })

    it('no falla si el producto no existe', () => {
      useCarritoStore.getState().quitar('nonexistent')
      expect(useCarritoStore.getState().items).toHaveLength(0)
    })
  })

  // ── Cambiar cantidad ────────────────────────────────
  describe('cambiarCantidad', () => {
    it('actualiza la cantidad de un producto', () => {
      useCarritoStore.getState().agregar(makeItem({ cantidad: 1 }))
      useCarritoStore.getState().cambiarCantidad('prod-1', 5)

      expect(useCarritoStore.getState().items[0].cantidad).toBe(5)
    })

    it('elimina el producto si cantidad es 0', () => {
      useCarritoStore.getState().agregar(makeItem())
      useCarritoStore.getState().cambiarCantidad('prod-1', 0)

      expect(useCarritoStore.getState().items).toHaveLength(0)
    })

    it('elimina el producto si cantidad es negativa', () => {
      useCarritoStore.getState().agregar(makeItem())
      useCarritoStore.getState().cambiarCantidad('prod-1', -1)

      expect(useCarritoStore.getState().items).toHaveLength(0)
    })

    it('no excede stockMaximo', () => {
      useCarritoStore.getState().agregar(makeItem({ stockMaximo: 10 }))
      useCarritoStore.getState().cambiarCantidad('prod-1', 50)

      expect(useCarritoStore.getState().items[0].cantidad).toBe(10)
    })

    it('no baja de 1', () => {
      useCarritoStore.getState().agregar(makeItem())
      useCarritoStore.getState().cambiarCantidad('prod-1', 0)

      expect(useCarritoStore.getState().items).toHaveLength(0)
    })
  })

  // ── Sincronizar stock ───────────────────────────────
  describe('sincronizarStock', () => {
    it('actualiza stockMaximo desde datos del servidor', () => {
      useCarritoStore.getState().agregar(makeItem({ stockMaximo: 20 }))
      useCarritoStore.getState().sincronizarStock([
        { id: 'prod-1', stockTotal: 5 } as any,
      ])

      const item = useCarritoStore.getState().items[0]
      expect(item.stockMaximo).toBe(5)
    })

    it('elimina items con stock 0', () => {
      useCarritoStore.getState().agregar(makeItem({ productoId: 'prod-1' }))
      useCarritoStore.getState().agregar(makeItem({ productoId: 'prod-2' }))
      useCarritoStore.getState().sincronizarStock([
        { id: 'prod-1', stockTotal: 10 } as any,
        { id: 'prod-2', stockTotal: 0 } as any,
      ])

      expect(useCarritoStore.getState().items).toHaveLength(1)
    })

    it('clamping cantidad al nuevo stock si es menor', () => {
      useCarritoStore.getState().agregar(makeItem({ cantidad: 15, stockMaximo: 20 }))
      useCarritoStore.getState().sincronizarStock([
        { id: 'prod-1', stockTotal: 5 } as any,
      ])

      expect(useCarritoStore.getState().items[0].cantidad).toBe(5)
    })
  })

  // ── Limpiar ─────────────────────────────────────────
  describe('limpiar', () => {
    it('vacia el carrito completamente', () => {
      const store = useCarritoStore.getState()
      store.agregar(makeItem({ productoId: 'prod-1' }))
      store.agregar(makeItem({ productoId: 'prod-2' }))
      store.limpiar()

      expect(useCarritoStore.getState().items).toHaveLength(0)
    })
  })

  // ── Totales ─────────────────────────────────────────
  describe('totales', () => {
    it('totalItems suma todas las cantidades', () => {
      const store = useCarritoStore.getState()
      store.agregar(makeItem({ productoId: 'prod-1', cantidad: 3 }))
      store.agregar(makeItem({ productoId: 'prod-2', cantidad: 2 }))

      expect(useCarritoStore.getState().totalItems()).toBe(5)
    })

    it('subtotal calcula precio × cantidad para cada item', () => {
      const store = useCarritoStore.getState()
      store.agregar(makeItem({ productoId: 'prod-1', precioUnitario: 8500, cantidad: 2 }))
      store.agregar(makeItem({ productoId: 'prod-2', precioUnitario: 3200, cantidad: 1 }))

      expect(useCarritoStore.getState().subtotal()).toBe(8500 * 2 + 3200)
    })

    it('total es igual a subtotal (sin impuestos adicionales)', () => {
      useCarritoStore.getState().agregar(makeItem({ precioUnitario: 10000, cantidad: 3 }))

      expect(useCarritoStore.getState().total()).toBe(useCarritoStore.getState().subtotal())
    })

    it('retorna 0 cuando el carrito está vacío', () => {
      expect(useCarritoStore.getState().totalItems()).toBe(0)
      expect(useCarritoStore.getState().subtotal()).toBe(0)
      expect(useCarritoStore.getState().total()).toBe(0)
    })
  })

  // ── Tiene Rx ────────────────────────────────────────
  describe('tieneRx', () => {
    it('retorna false si ningún producto requiere receta', () => {
      useCarritoStore.getState().agregar(makeItem({ requiereRx: false }))
      expect(useCarritoStore.getState().tieneRx()).toBe(false)
    })

    it('retorna true si al menos un producto requiere receta', () => {
      const store = useCarritoStore.getState()
      store.agregar(makeItem({ productoId: 'prod-1', requiereRx: false }))
      store.agregar(makeItem({ productoId: 'prod-2', requiereRx: true }))

      expect(useCarritoStore.getState().tieneRx()).toBe(true)
    })

    it('retorna false con carrito vacío', () => {
      expect(useCarritoStore.getState().tieneRx()).toBe(false)
    })
  })
})
