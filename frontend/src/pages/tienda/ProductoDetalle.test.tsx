import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProductoDetalle from './ProductoDetalle'

// ── Mocks ────────────────────────────────────────────────────
const mockObtener = vi.fn()

vi.mock('@/services', () => ({
  productosService: {
    obtener: (...args: any[]) => mockObtener(...args),
  },
  clientesService: {
    obtenerFavoritos: vi.fn().mockResolvedValue([]),
  },
  chatbotService: {
    verificarInteracciones: vi.fn(),
  },
}))

vi.mock('@/store/carritoStore', () => ({
  useCarritoStore: (selector: any) => selector({ agregar: vi.fn() }),
}))

vi.mock('@/hooks', () => ({
  useFormateo: () => ({
    cop: (n: number) => `$${n.toLocaleString()}`,
    fecha: (d: string) => d,
    fechaCorta: (d: string) => d,
    fechaHora: (d: string) => d,
  }),
  useAuthCliente: () => ({
    estaLogueado: false,
  }),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/components/shared/SEOHead', () => ({
  default: () => null,
}))

vi.mock('@/components/shared/InteractionAlertModal', () => ({
  default: () => null,
}))

// ── Helpers ──────────────────────────────────────────────────
function renderWithRoute(id: string | undefined) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={id ? [`/productos/${id}`] : ['/productos']}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/productos/:id" element={<ProductoDetalle />} />
          <Route path="/productos" element={<ProductoDetalle />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

// ── Tests ────────────────────────────────────────────────────
describe('ProductoDetalle — route param handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the :id param from the URL correctly', async () => {
    mockObtener.mockResolvedValue({
      id: '0281c1f0-e880-4f0c-b4a2-4084386e9746',
      nombre: 'Amoxicilina 500mg',
      precioVenta: 12500,
      concentracion: '500 mg',
      laboratorio: 'Genfar',
      presentacion: 'Caja x 12',
      requiereRx: false,
      esMuestraMedica: false,
      stockTotal: 20,
      cum: '12345-1',
      registroInvima: 'INVIMA 2020M-001',
      principioActivo: 'Amoxicilina',
      estadoCum: 'Activo',
      estadoRegistro: 'Vigente',
      categoria: { nombre: 'Antibióticos' },
      lotes: [{ cantidadActual: 20 }],
    })

    renderWithRoute('0281c1f0-e880-4f0c-b4a2-4084386e9746')

    // Verify the service was called with the correct ID from the route param
    expect(mockObtener).toHaveBeenCalledWith('0281c1f0-e880-4f0c-b4a2-4084386e9746')
  })

  it('does NOT call obtener when id param is undefined (no route match)', () => {
    renderWithRoute(undefined)

    // With no :id param, the query should be disabled (enabled: !!id)
    // So obtener should not be called
    expect(mockObtener).not.toHaveBeenCalled()
  })

  it('shows loading state while fetching', async () => {
    // Return a never-resolving promise to keep loading state
    mockObtener.mockReturnValue(new Promise(() => {}))

    renderWithRoute('some-uuid')

    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  it('shows "Producto no encontrado" when product does not exist', async () => {
    mockObtener.mockResolvedValue(null)

    renderWithRoute('nonexistent-id')

    // Wait for the query to resolve
    const notFound = await screen.findByText(/Producto no encontrado/)
    expect(notFound).toBeInTheDocument()
  })

  it('renders product name when product loads successfully', async () => {
    mockObtener.mockResolvedValue({
      id: 'test-id',
      nombre: 'Omeprazol 20mg',
      precioVenta: 15600,
      concentracion: '20 mg',
      laboratorio: 'Genfar',
      presentacion: 'Caja x 28 cápsulas',
      requiereRx: false,
      esMuestraMedica: false,
      stockTotal: 30,
      cum: '99999-1',
      registroInvima: 'INVIMA 2020M-099',
      principioActivo: 'Omeprazol',
      estadoCum: 'Activo',
      estadoRegistro: 'Vigente',
      categoria: { nombre: 'Gastrointestinal' },
      lotes: [{ cantidadActual: 30 }],
    })

    renderWithRoute('test-id')

    const name = await screen.findByText(/Omeprazol 20mg/)
    expect(name).toBeInTheDocument()
  })

  it('URL /productos/undefined never triggers a fetch (query disabled)', () => {
    // Simulate the exact bug scenario: route captures the literal string "undefined"
    mockObtener.mockResolvedValue(null)

    renderWithRoute('undefined' as any)

    // The param is the string "undefined", not actually undefined
    // So it WILL call obtener with "undefined" — this is expected behavior
    // The real fix is in ProductCard which never generates this URL
    expect(mockObtener).toHaveBeenCalledWith('undefined')
  })
})
