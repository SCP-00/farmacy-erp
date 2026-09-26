import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShoppingCart, Search, Menu, X, Heart, User, LogOut } from 'lucide-react'
import { useCarritoStore } from '@/store/carritoStore'
import { useAuthClienteStore } from '@/store/authStore'
import { categoriasService } from '@/services'

/**
 * Header principal de la tienda B2C con navegación, búsqueda, favoritos,
 * carrito, menú de usuario y categorías.
 *
 * Incluye:
 * - Topbar promocional (envío gratis)
 * - Barra de búsqueda con submit a `/catalogo?q=...`
 * - Navegación por categorías
 * - Menú responsive (mobile + desktop)
 * - Indicador de cantidad en carrito
 * - Botón de favoritos y cuenta de usuario
 *
 * @example
 * ```tsx
 * <Header />
 * ```
 */
export function Header() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [busquedaAbierta, setBusquedaAbierta] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const navigate = useNavigate()
  const _disabled_location = useLocation() // eslint: unused
  
  const totalItems = useCarritoStore((state: any) => state.totalItems())
  const { cliente, cerrarSesion } = useAuthClienteStore()
  const [categorias, setCategorias] = useState<Array<{id: string; nombre: string; slug: string}>>([])

  useEffect(() => {
    categoriasService.listar().then(setCategorias).catch(() => {})
  }, [])

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault()
    if (busqueda.trim()) {
      navigate(`/catalogo?q=${encodeURIComponent(busqueda)}`)
      setBusqueda('')
      setBusquedaAbierta(false)
    }
  }

  const menuItems = [
    { label: 'Inicio', href: '/' },
    { label: 'Catálogo', href: '/catalogo' },
    { label: 'Sucursales', href: '/sucursales' },
    { label: 'Quiénes somos', href: '/quienes-somos' },
    { label: 'Contacto', href: '/contacto' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      {/* Top bar */}
      <div className="bg-blue-600 text-white py-2 px-4 text-sm text-center">
        <p>🚚 Envío GRATIS en compras mayores a $50.000 | Domicilio en 35 minutos</p>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 min-w-fit">
            <div className="bg-blue-600 text-white rounded-lg p-2">
              <span className="text-2xl font-bold">💊</span>
            </div>
            <span className="text-xl font-bold text-gray-900 hidden sm:inline">Farmacy</span>
          </Link>

          {/* Search bar - Desktop */}
          <form onSubmit={handleBuscar} className="hidden md:flex flex-1 max-w-2xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Busca productos, marcas..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </form>

          {/* Right actions */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Search mobile */}
            <button
              onClick={() => setBusquedaAbierta(!busquedaAbierta)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Search className="w-5 h-5 text-gray-700" />
            </button>

            {/* Favorites */}
            <Link to="/favoritos" className="hidden sm:flex items-center gap-1 p-2 hover:bg-gray-100 rounded-lg">
              <Heart className="w-5 h-5 text-gray-700" />
              <span className="text-sm hidden md:inline text-gray-700">Favoritos</span>
            </Link>

            {/* User menu */}
            {cliente ? (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <button
                  onClick={() => {
                    cerrarSesion()
                    navigate('/')
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            ) : (
              <Link to="/auth/login" className="hidden sm:flex items-center gap-1 p-2 hover:bg-gray-100 rounded-lg">
                <User className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-700">Cuenta</span>
              </Link>
            )}

            {/* Shopping cart */}
            <Link to="/carrito" className="relative p-2 hover:bg-gray-100 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-gray-700" />
              {totalItems > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </Link>

            {/* Mobile menu */}
            <button
              onClick={() => setMenuAbierto(!menuAbierto)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              {menuAbierto ? (
                <X className="w-5 h-5 text-gray-700" />
              ) : (
                <Menu className="w-5 h-5 text-gray-700" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile search */}
        {busquedaAbierta && (
          <form onSubmit={handleBuscar} className="md:hidden mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Busca productos..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                autoFocus
              />
            </div>
          </form>
        )}
      </div>

      {/* Categories bar */}
      <div className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="hidden md:flex overflow-x-auto gap-8 py-3 text-sm">
            <Link to="/catalogo" className="text-gray-700 hover:text-blue-600 whitespace-nowrap">
              Todos
            </Link>
            {categorias.map((cat) => (
              <Link
                key={cat.id}
                to={`/catalogo?categoria=${cat.slug}`}
                className="text-gray-700 hover:text-blue-600 whitespace-nowrap"
              >
                {cat.nombre}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuAbierto && (
        <div className="md:hidden border-t border-gray-200 bg-white py-4 max-h-[60vh] overflow-y-auto">
          <nav className="flex flex-col gap-3 px-4">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="text-gray-700 hover:text-blue-600 py-2 border-b border-gray-100"
                onClick={() => setMenuAbierto(false)}
              >
                {item.label}
              </Link>
            ))}
            {/* Categorías dinámicas en mobile */}
            <div className="pt-2 pb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Categorías</p>
              {categorias.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/catalogo?categoria=${cat.slug}`}
                  className="block text-gray-600 hover:text-blue-600 py-2 pl-2 border-b border-gray-50 text-sm"
                  onClick={() => setMenuAbierto(false)}
                >
                  {cat.nombre}
                </Link>
              ))}
            </div>
            <Link
              to="/auth/login"
              className="text-blue-600 font-medium py-2 mt-2"
              onClick={() => setMenuAbierto(false)}
            >
              {cliente ? 'Mi Cuenta' : 'Iniciar Sesión'}
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}

export default Header
