import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductCard } from './ProductCard'

// ── Mocks ────────────────────────────────────────────────────
vi.mock('@/store/carritoStore', () => ({
  useCarritoStore: (selector: any) => selector({ agregar: vi.fn() }),
}))

vi.mock('@/hooks', () => ({
  useAuthCliente: () => ({
    estaLogueado: false,
  }),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services', () => ({
  clientesService: { toggleFavorito: vi.fn() },
}))

// ── Helpers ──────────────────────────────────────────────────
function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter initialEntries={['/productos']}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

const baseProducto = {
  nombre: 'Amoxicilina 500mg',
  laboratorio: 'Genfar',
  presentacion: 'Caja x 12 cápsulas',
  concentracion: '500 mg',
  precioVenta: 12500,
  stockTotal: 20,
  requiereRx: false,
  imagenUrl: null,
}

// ── Tests ────────────────────────────────────────────────────
describe('ProductCard — link generation', () => {
  describe('grid variant (default)', () => {
    it('generates link to /productos/{id} when id is a valid UUID', () => {
      const producto = { ...baseProducto, id: '0281c1f0-e880-4f0c-b4a2-4084386e9746' }
      render(<ProductCard producto={producto} />, { wrapper })

      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        expect(link.getAttribute('href')).toBe('/productos/0281c1f0-e880-4f0c-b4a2-4084386e9746')
      })
    })

    it('generates link to /productos/{id} when id is a numeric string', () => {
      const producto = { ...baseProducto, id: '42' }
      render(<ProductCard producto={producto} />, { wrapper })

      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        expect(link.getAttribute('href')).toBe('/productos/42')
      })
    })

    it('falls back to # when id is undefined (no /productos/{id} link)', () => {
      const producto = { ...baseProducto, id: undefined }
      render(<ProductCard producto={producto} />, { wrapper })

      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        const href = link.getAttribute('href')
        // Should NOT generate /productos/undefined
        expect(href).not.toMatch(/\/productos\/[^/]/)
      })
    })

    it('falls back to # when id is null (no /productos/{id} link)', () => {
      const producto = { ...baseProducto, id: null }
      render(<ProductCard producto={producto} />, { wrapper })

      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        const href = link.getAttribute('href')
        expect(href).not.toMatch(/\/productos\/[^/]/)
      })
    })

    it('falls back to # when id is empty string (no /productos/{id} link)', () => {
      const producto = { ...baseProducto, id: '' }
      render(<ProductCard producto={producto} />, { wrapper })

      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        const href = link.getAttribute('href')
        expect(href).not.toMatch(/\/productos\/[^/]/)
      })
    })

    it('renders product name in the card', () => {
      const producto = { ...baseProducto, id: 'test-id' }
      render(<ProductCard producto={producto} />, { wrapper })

      expect(screen.getByText(/Amoxicilina 500mg/)).toBeInTheDocument()
    })
  })

  describe('list variant', () => {
    it('generates link to /productos/{id} when id is valid', () => {
      const producto = { ...baseProducto, id: 'abc-123' }
      render(<ProductCard producto={producto} variant="list" />, { wrapper })

      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        expect(link.getAttribute('href')).toBe('/productos/abc-123')
      })
    })

    it('falls back to # when id is undefined in list variant', () => {
      const producto = { ...baseProducto, id: undefined }
      render(<ProductCard producto={producto} variant="list" />, { wrapper })

      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        const href = link.getAttribute('href')
        expect(href).not.toMatch(/\/productos\/[^/]/)
      })
    })
  })

  describe('URL never contains "undefined" string', () => {
    it('grid variant — no link contains /productos/undefined', () => {
      const producto = { ...baseProducto, id: undefined }
      render(<ProductCard producto={producto} />, { wrapper })

      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        expect(link.getAttribute('href')).not.toContain('/productos/undefined')
      })
    })

    it('list variant — no link contains /productos/undefined', () => {
      const producto = { ...baseProducto, id: undefined }
      render(<ProductCard producto={producto} variant="list" />, { wrapper })

      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        expect(link.getAttribute('href')).not.toContain('/productos/undefined')
      })
    })

    it('grid variant — valid UUID produces correct URL, not /productos/undefined', () => {
      const producto = { ...baseProducto, id: '0281c1f0-e880-4f0c-b4a2-4084386e9746' }
      render(<ProductCard producto={producto} />, { wrapper })

      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        const href = link.getAttribute('href')
        expect(href).not.toBe('/productos/undefined')
        expect(href).toBe('/productos/0281c1f0-e880-4f0c-b4a2-4084386e9746')
      })
    })
  })
})
