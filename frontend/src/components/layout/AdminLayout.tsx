import { Outlet, NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, Truck, Users,
  BarChart3, Settings, LogOut, Bell,
 CreditCard, UserCheck, PanelRightClose, PanelRightOpen,
  Shield, BellOff, BellRing,
} from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventarioService } from '@/services'
import { useAuth, usePermisos, usePushNotifications } from '@/hooks'
import { useUiStore } from '@/store/uiStore'
import ThemeToggle from '@/components/shared/ThemeToggle'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  visible: boolean
}

/**
 * Layout principal del panel administrativo (dashboard).
 * Incluye sidebar colapsable con navegación por roles, topbar con
 * alertas de inventario, toggle de tema oscuro, notificaciones push,
 * y selector de perfil de usuario.
 *
 * - Sidebar: colapsable (expandido/contraído), navegación por permisos
 * - Topbar: alertas de stock, push notifications, theme toggle
 * - Contenido: `<Outlet />` de React Router para páginas hijas
 *
 * @example
 * ```tsx
 * <Route element={<ProtectedRoute tipo="empleado" />}>
 *   <Route element={<AdminLayout />}>
 *     <Route path="/admin" element={<Dashboard />} />
 *     <Route path="/admin/caja/*" element={<CajaPages />} />
 *   </Route>
 * </Route>
 * ```
 */
export default function AdminLayout() {
  const { empleado, logout } = useAuth()
  const permisos = usePermisos()
  const { sidebarAbierto, toggleSidebar, darkMode } = useUiStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const { data: alertas = [] } = useQuery({
    queryKey: ['inventario', 'alertas'],
    queryFn: () => inventarioService.alertas('')
  })
  const alertasNoLeidas = (Array.isArray(alertas) ? alertas : []).filter((a: any) => !a.leida)

  const nav: NavItem[] = [
    { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard size={17} />, visible: true },
    { label: 'Punto Venta', href: '/admin/caja/pos', icon: <ShoppingCart size={17} />, visible: permisos.puedeVerCaja },
    { label: 'Historial Caja', href: '/admin/caja/historial', icon: <CreditCard size={17} />, visible: permisos.puedeVerCaja },
    { label: 'Inventario', href: '/admin/inventario/productos', icon: <Package size={17} />, visible: permisos.puedeVerInventario },
    { label: 'Compras', href: '/admin/compras/ordenes', icon: <Truck size={17} />, visible: permisos.puedeVerCompras },
    { label: 'Proveedores', href: '/admin/proveedores', icon: <UserCheck size={17} />, visible: permisos.puedeVerCompras },
    { label: 'Clientes', href: '/admin/clientes', icon: <Users size={17} />, visible: permisos.puedeVerClientes },
    { label: 'Empleados', href: '/admin/empleados', icon: <Users size={17} />, visible: permisos.puedeVerEmpleados },
    { label: 'Reportes', href: '/admin/reportes/ventas', icon: <BarChart3 size={17} />, visible: permisos.puedeVerReportes },
    { label: 'Configuración', href: '/admin/configuracion', icon: <Settings size={17} />, visible: permisos.puedeVerConfig },
    { label: 'Auditoría', href: '/admin/configuracion/auditoria', icon: <Shield size={17} />, visible: permisos.puedeVerConfig },
  ]

  const initials = empleado?.nombre
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() ?? 'U'

  const rolLabel: Record<string, string> = {
    ADMINISTRADOR: 'Administrador',
    FARMACEUTA: 'Farmacéuta',
    AUXILIAR: 'Auxiliar',
  }

  return (
    <div className={`flex min-h-screen transition-colors duration-300
      ${darkMode ? 'bg-dark-bg' : 'bg-[#F5F8F6]'}`}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className={`
        fixed top-0 left-0 h-full z-50 flex flex-col
        transition-all duration-300 ease-in-out
        ${darkMode ? 'bg-dark-surface border-r border-dark-border' : 'bg-teal-900'}
        ${sidebarAbierto ? 'w-56' : 'w-16'}
      `}>
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b ${darkMode ? 'border-dark-border' : 'border-white/10'}`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
            ${darkMode ? 'bg-teal-600' : 'bg-teal-500'}`}>
            <span className="text-white font-bold text-sm">F</span>
          </div>
          {sidebarAbierto && (
            <span className={`font-semibold text-sm whitespace-nowrap ${darkMode ? 'text-dark-text' : 'text-white'}`}>Farmacy</span>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={toggleSidebar}
          className={`absolute -right-3 top-16 w-6 h-6 rounded-full
                     flex items-center justify-center z-10 transition-colors
                     ${darkMode ? 'bg-dark-surface border border-dark-border text-dark-text-secondary' : 'bg-teal-700 border border-teal-600 text-white'}`}
          title={sidebarAbierto ? 'Contraer menú' : 'Expandir menú'}
        >
          {sidebarAbierto
            ? <PanelRightClose size={12} />
            : <PanelRightOpen size={12} />}
        </button>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {nav.filter(n => n.visible).map(item => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/admin'}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-2.5 mx-2 rounded-xl mb-0.5
                text-sm transition-all duration-200
                ${isActive
                  ? darkMode
                    ? 'bg-teal-500/15 text-teal-400 border-l-2 border-teal-500'
                    : 'bg-teal-500/20 text-white border-l-2 border-teal-400'
                  : darkMode
                    ? 'text-dark-text-secondary hover:bg-dark-hover hover:text-dark-text'
                    : 'text-teal-200 hover:bg-white/5 hover:text-white'
                }
              `}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {sidebarAbierto && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className={`px-3 py-4 border-t ${darkMode ? 'border-dark-border' : 'border-white/10'}`}>
          <div className={`flex items-center gap-3 ${!sidebarAbierto && 'justify-center'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center
                            text-white text-xs font-bold flex-shrink-0
                            ${darkMode ? 'bg-teal-600' : 'bg-teal-500'}`}>
              {initials}
            </div>
            {sidebarAbierto && (
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${darkMode ? 'text-dark-text' : 'text-white'}`}>{empleado?.nombre}</p>
                <p className={`text-[10px] ${darkMode ? 'text-dark-text-secondary' : 'text-teal-300'}`}>{rolLabel[empleado?.rol ?? '']}</p>
              </div>
            )}
            {sidebarAbierto && (
              <button
                onClick={logout}
                className={`transition-colors ${darkMode ? 'text-dark-text-secondary hover:text-dark-text' : 'text-teal-300 hover:text-white'}`}
                title="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────── */}
      <main className={`flex-1 flex flex-col transition-all duration-300
        ${sidebarAbierto ? 'ml-56' : 'ml-16'}`}
      >
        {/* Topbar */}
        <header className={`sticky top-0 z-40 px-6 py-3 flex items-center justify-between transition-colors duration-300
          ${darkMode
            ? 'bg-dark-surface border-b border-dark-border'
            : 'bg-white border-b border-[#D8EBE4] shadow-soft'
          }`}>
          <div>
            <h1 className={`text-base font-semibold ${darkMode ? 'text-dark-text' : 'text-gray-900'}`} id="page-title">Panel de Gestión</h1>
            <p className={`text-xs ${darkMode ? 'text-dark-text-muted' : 'text-gray-400'}`}>
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Push toggle */}
            <PushToggle />

            {/* Theme toggle */}
            <ThemeToggle compact />

            {/* Alertas */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className={`relative p-2 rounded-xl transition-colors
                  ${darkMode
                    ? 'text-dark-text-secondary hover:bg-dark-hover'
                    : 'text-gray-500 hover:text-teal-700 hover:bg-teal-50'
                  }`}
                aria-label="Alertas"
              >
                <Bell size={18} />
                {Array.isArray(alertasNoLeidas) && alertasNoLeidas.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white
                                   text-[10px] rounded-full flex items-center justify-center font-bold">
                    {alertasNoLeidas.length}
                  </span>
                )}
              </button>

              {dropdownOpen && (
                <div className={`absolute right-0 mt-2 w-80 border rounded-xl shadow-lg z-50 animate-menu-slide
                  ${darkMode ? 'bg-dark-surface border-dark-border' : 'bg-white border-gray-100'}`}>
                  <div className={`p-3 border-b ${darkMode ? 'border-dark-border' : 'border-gray-100'}`}>
                    <strong className={`text-sm ${darkMode ? 'text-dark-text' : 'text-gray-900'}`}>Alertas</strong>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {(alertasNoLeidas ?? []).slice(0, 20).map((a: any) => (
                      <Link
                        key={a.id}
                        to={a.loteId ? `/admin/inventario/lotes?loteId=${a.loteId}` : '/admin/inventario/alertas'}
                        className={`block px-3 py-2 border-b last:border-b-0 transition-colors
                          ${darkMode ? 'hover:bg-dark-hover border-dark-border' : 'hover:bg-gray-50 border-gray-100'}`}
                        onClick={() => setDropdownOpen(false)}
                      >
                        <div className={`text-xs font-semibold ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>
                          {a.tipo === 'STOCK_MINIMO' ? 'Stock Crítico' : a.tipo === 'PROXIMO_VENCER' ? 'Por Vencer' : 'Alerta'}
                        </div>
                        <div className={`text-xs mt-0.5 truncate ${darkMode ? 'text-dark-text-secondary' : 'text-gray-500'}`}>{a.mensaje}</div>
                      </Link>
                    ))}
                    {!(alertasNoLeidas ?? []).length && (
                      <div className={`p-4 text-center ${darkMode ? 'text-dark-text-muted' : 'text-gray-400'}`}>No hay alertas</div>
                    )}
                  </div>
                  <div className={`p-2 text-right border-t rounded-b-xl
                    ${darkMode ? 'bg-dark-bg border-dark-border' : 'bg-gray-50 border-gray-100'}`}>
                    <Link to="/admin/inventario/alertas" className={`text-sm font-medium transition-colors
                      ${darkMode ? 'text-teal-400 hover:text-teal-300' : 'text-teal-700 hover:text-teal-600'}`}
                      onClick={() => setDropdownOpen(false)}>Ver todas</Link>
                  </div>
                </div>
              )}
            </div>

            {/* Perfil */}
            <div className={`flex items-center gap-2 pl-3 border-l ${darkMode ? 'border-dark-border' : 'border-gray-100'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold
                ${darkMode ? 'bg-teal-600' : 'bg-teal-700'}`}>
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className={`text-xs font-medium ${darkMode ? 'text-dark-text' : 'text-gray-800'}`}>{empleado?.nombre}</p>
                <p className={`text-[10px] ${darkMode ? 'text-dark-text-muted' : 'text-gray-400'}`}>{rolLabel[empleado?.rol ?? '']}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Contenido de cada página */}
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

// ── Push Toggle Component ────────────────────────────────
function PushToggle() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications()
  const { darkMode } = useUiStore()

  if (!supported) return null

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe()
    } else {
      await subscribe()
    }
  }

  // Si está denegado permanentemente, mostrar como deshabilitado
  const isDenied = permission === 'denied'

  return (
    <div className="relative group">
      <button
        onClick={handleToggle}
        disabled={loading || isDenied}
        title={
          isDenied
            ? 'Notificaciones bloqueadas — habilítalas desde la configuración del navegador'
            : subscribed
              ? 'Desactivar notificaciones push'
              : 'Activar notificaciones push'
        }
        className={`relative p-2 rounded-xl transition-all duration-200
          ${loading ? 'animate-pulse' : ''}
          ${isDenied
            ? darkMode
              ? 'text-dark-text-muted opacity-40 cursor-not-allowed'
              : 'text-gray-300 opacity-40 cursor-not-allowed'
            : subscribed
              ? darkMode
                ? 'text-teal-400 bg-teal-500/10 hover:bg-teal-500/20'
                : 'text-teal-600 bg-teal-50 hover:bg-teal-100'
              : darkMode
                ? 'text-dark-text-secondary hover:bg-dark-hover hover:text-dark-text'
                : 'text-gray-500 hover:text-teal-700 hover:bg-teal-50'
          }`}
        aria-label={subscribed ? 'Desactivar notificaciones' : 'Activar notificaciones'}
      >
        {loading ? (
          <Bell className="animate-pulse" size={18} />
        ) : subscribed ? (
          <BellRing size={18} />
        ) : (
          <BellOff size={18} />
        )}
      </button>

      {/* Tooltip en desktop */}
      <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px]
        whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50
        ${darkMode ? 'bg-dark-surface text-dark-text border border-dark-border' : 'bg-gray-800 text-white'}`}>
        {isDenied
          ? 'Bloqueado' : loading
            ? '...' : subscribed
              ? 'Push activado' : 'Activar push'
        }
      </div>
    </div>
  )
}