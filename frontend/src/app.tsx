// ══════════════════════════════════════════════════════════
//  app.tsx — Router principal de Farmacy
//  Tienda B2C (pública) + Panel Admin (protegido por rol)
// ══════════════════════════════════════════════════════════
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'

// ── Layouts ───────────────────────────────────────────────
import PublicLayout   from '@/components/layout/PublicLayout'
import AdminLayout    from '@/components/layout/AdminLayout'
import AuthLayout     from '@/components/layout/AuthLayout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'

// ── Spinner global de carga ───────────────────────────────
function Cargando() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F8F6]">
      <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Páginas TIENDA (lazy) ─────────────────────────────────
const Inicio             = lazy(() => import('@/pages/tienda/Inicio'))
const Catalogo           = lazy(() => import('@/pages/tienda/Catalogo'))
const ProductoDetalle    = lazy(() => import('@/pages/tienda/ProductoDetalle'))
const Carrito            = lazy(() => import('@/pages/tienda/Carrito'))
const Checkout           = lazy(() => import('@/pages/tienda/Checkout'))
const ConfirmacionPago   = lazy(() => import('@/pages/tienda/ConfirmacionPago'))
const Favoritos          = lazy(() => import('@/pages/tienda/Favoritos'))
const MiCuenta           = lazy(() => import('@/pages/tienda/MiCuenta'))
const MisPedidos         = lazy(() => import('@/pages/tienda/MisPedidos'))
const Sucursales         = lazy(() => import('@/pages/tienda/Sucursales'))
const Contacto           = lazy(() => import('@/pages/tienda/Contacto'))
const QuienesSomos       = lazy(() => import('@/pages/tienda/QuienesSomos'))
const PoliticaPrivacidad = lazy(() => import('@/pages/tienda/PoliticaPrivacidad'))
const TerminosCondiciones = lazy(() => import('@/pages/tienda/TerminosCondiciones'))
const NoEncontrado       = lazy(() => import('@/pages/tienda/NoEncontrado'))

// ── Páginas AUTH (lazy) ───────────────────────────────────
const LoginAdmin         = lazy(() => import('@/pages/auth/LoginAdmin'))
const LoginCliente       = lazy(() => import('@/pages/auth/LoginCliente'))
const RegistroCliente    = lazy(() => import('@/pages/auth/RegistroCliente'))
const RecuperarPassword  = lazy(() => import('@/pages/auth/RecuperarPassword'))
const ResetPassword      = lazy(() => import('@/pages/auth/ResetPassword'))
const VerificarEmail     = lazy(() => import('@/pages/auth/VerificarEmail'))
const AuthCallback       = lazy(() => import('@/pages/auth/AuthCallback'))

// ── Páginas ADMIN (lazy) ──────────────────────────────────
const Dashboard          = lazy(() => import('@/pages/admin/Dashboard'))
// Caja
const PuntoVenta         = lazy(() => import('@/pages/admin/caja/PuntoVenta'))
const HistorialCaja      = lazy(() => import('@/pages/admin/caja/HistorialCaja'))
const Devoluciones       = lazy(() => import('@/pages/admin/caja/Devoluciones'))
// Inventario
const ListaProductos     = lazy(() => import('@/pages/admin/inventario/ListaProductos'))
const GestionLotes       = lazy(() => import('@/pages/admin/inventario/GestionLotes'))
const AlertasInventario  = lazy(() => import('@/pages/admin/inventario/AlertasInventario'))
const Movimientos        = lazy(() => import('@/pages/admin/inventario/Movimientos'))
const DetalleProductoAdmin = lazy(() => import('@/pages/admin/inventario/DetalleProductoAdmin'))
// Compras
const OrdenesCompra      = lazy(() => import('@/pages/admin/compras/OrdenesCompra'))
const NuevaOrden         = lazy(() => import('@/pages/admin/compras/NuevaOrden'))
const RecepcionMercancia = lazy(() => import('@/pages/admin/compras/RecepcionMercancia'))
// Clientes admin
const ListaClientes      = lazy(() => import('@/pages/admin/clientes/ListaClientes'))
const DetalleCliente     = lazy(() => import('@/pages/admin/clientes/DetalleCliente'))
const ProgramaFidelidad  = lazy(() => import('@/pages/admin/clientes/ProgramaFidelidad'))
// Empleados
const ListaEmpleados     = lazy(() => import('@/pages/admin/empleados/ListaEmpleados'))
const DetalleEmpleado    = lazy(() => import('@/pages/admin/empleados/DetalleEmpleado'))
// Proveedores
const ListaProveedores   = lazy(() => import('@/pages/admin/proveedores/ListaProveedores'))
const DetalleProveedor   = lazy(() => import('@/pages/admin/proveedores/DetalleProveedor'))
// Reportes
const ReporteVentas      = lazy(() => import('@/pages/admin/reportes/ReporteVentas'))
const ReporteInventario  = lazy(() => import('@/pages/admin/reportes/ReporteInventario'))
const ReporteCompras     = lazy(() => import('@/pages/admin/reportes/ReporteCompras'))
const ReporteClientes    = lazy(() => import('@/pages/admin/reportes/ReporteClientes'))
// Configuración
const ConfigGeneral      = lazy(() => import('@/pages/admin/configuracion/ConfigGeneral'))
const ConfigUsuarios     = lazy(() => import('@/pages/admin/configuracion/ConfigUsuarios'))
const ConfigSucursales   = lazy(() => import('@/pages/admin/configuracion/ConfigSucursales'))
const ConfigSeguridad    = lazy(() => import('@/pages/admin/configuracion/ConfigSeguridad'))
const VisorAuditoria     = lazy(() => import('@/pages/admin/configuracion/VisorAuditoria'))

// ═════════════════════════════════════════════════════════
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Cargando />}>
        <Routes>

          {/* ══ TIENDA PÚBLICA ══════════════════════════ */}
          <Route element={<PublicLayout />}>
            <Route index                    element={<Inicio />} />
            <Route path="/productos"        element={<Catalogo />} />
            <Route path="/catalogo"         element={<Navigate to="/productos" replace />} />
            <Route path="/productos/:id"    element={<ProductoDetalle />} />
            <Route path="/carrito"          element={<Carrito />} />
            <Route path="/sucursales"       element={<Sucursales />} />
            <Route path="/contacto"         element={<Contacto />} />
            <Route path="/quienes-somos"    element={<QuienesSomos />} />
            <Route path="/nosotros"         element={<Navigate to="/quienes-somos" replace />} />
            <Route path="/privacidad"       element={<PoliticaPrivacidad />} />
            <Route path="/terminos"         element={<TerminosCondiciones />} />
          </Route>

          {/* ══ AUTH (tarjeta centrada, sin nav) ═══════ */}
          <Route element={<AuthLayout />}>
            <Route path="/login"               element={<LoginCliente />} />
            <Route path="/registro"            element={<RegistroCliente />} />
            <Route path="/recuperar-password"  element={<RecuperarPassword />} />
            <Route path="/reset-password"      element={<ResetPassword />} />
            <Route path="/verificar-email"     element={<VerificarEmail />} />
            <Route path="/admin/login"         element={<LoginAdmin />} />
          </Route>

          {/* ══ CLIENTE AUTENTICADO ══════════════════════ */}
          <Route element={<ProtectedRoute tipo="cliente" />}>
            <Route element={<PublicLayout />}>
              <Route path="/checkout"           element={<Checkout />} />
              <Route path="/pago/confirmacion"  element={<ConfirmacionPago />} />
              <Route path="/cuenta"             element={<MiCuenta />} />
              <Route path="/cuenta/pedidos"     element={<MisPedidos />} />
              <Route path="/cuenta/favoritos"   element={<Favoritos />} />
            </Route>
          </Route>

          {/* ══ PANEL ADMIN ══════════════════════════════ */}
          <Route element={<ProtectedRoute tipo="empleado" />}>
            <Route element={<AdminLayout />}>

              {/* Dashboard — todos los roles */}
              <Route path="/admin" element={<Dashboard />} />

              {/* Caja / POS — ADMINISTRADOR + FARMACEUTA */}
              <Route element={<ProtectedRoute tipo="empleado" roles={['ADMINISTRADOR','FARMACEUTA']} />}>
                <Route path="/admin/caja/pos"          element={<PuntoVenta />} />
                <Route path="/admin/caja/historial"    element={<HistorialCaja />} />
                <Route path="/admin/caja/devoluciones" element={<Devoluciones />} />
              </Route>

              {/* Inventario — ADMINISTRADOR + AUXILIAR */}
              <Route element={<ProtectedRoute tipo="empleado" roles={['ADMINISTRADOR','AUXILIAR']} />}>
                <Route path="/admin/inventario/productos"     element={<ListaProductos />} />
                <Route path="/admin/inventario/productos/:id" element={<DetalleProductoAdmin />} />
                <Route path="/admin/inventario/lotes"         element={<GestionLotes />} />
                <Route path="/admin/inventario/alertas"       element={<AlertasInventario />} />
                <Route path="/admin/inventario/movimientos"   element={<Movimientos />} />
              </Route>

              {/* Compras — ADMINISTRADOR + AUXILIAR */}
              <Route element={<ProtectedRoute tipo="empleado" roles={['ADMINISTRADOR','AUXILIAR']} />}>
                <Route path="/admin/compras/ordenes"   element={<OrdenesCompra />} />
                <Route path="/admin/compras/nueva"     element={<NuevaOrden />} />
                <Route path="/admin/compras/recepcion" element={<RecepcionMercancia />} />
              </Route>

              {/* Clientes — ADMINISTRADOR + FARMACEUTA */}
              <Route element={<ProtectedRoute tipo="empleado" roles={['ADMINISTRADOR','FARMACEUTA']} />}>
                <Route path="/admin/clientes"            element={<ListaClientes />} />
                <Route path="/admin/clientes/fidelidad"  element={<ProgramaFidelidad />} />
                <Route path="/admin/clientes/:id"        element={<DetalleCliente />} />
              </Route>

              {/* Proveedores — ADMINISTRADOR + AUXILIAR */}
              <Route element={<ProtectedRoute tipo="empleado" roles={['ADMINISTRADOR','AUXILIAR']} />}>
                <Route path="/admin/proveedores"     element={<ListaProveedores />} />
                <Route path="/admin/proveedores/:id" element={<DetalleProveedor />} />
              </Route>

              {/* Empleados — solo ADMINISTRADOR */}
              <Route element={<ProtectedRoute tipo="empleado" roles={['ADMINISTRADOR']} />}>
                <Route path="/admin/empleados"     element={<ListaEmpleados />} />
                <Route path="/admin/empleados/:id" element={<DetalleEmpleado />} />
              </Route>

              {/* Reportes — solo ADMINISTRADOR */}
              <Route element={<ProtectedRoute tipo="empleado" roles={['ADMINISTRADOR']} />}>
                <Route path="/admin/reportes/ventas"     element={<ReporteVentas />} />
                <Route path="/admin/reportes/inventario" element={<ReporteInventario />} />
                <Route path="/admin/reportes/compras"    element={<ReporteCompras />} />
                <Route path="/admin/reportes/clientes"   element={<ReporteClientes />} />
              </Route>

              {/* Configuración — solo ADMINISTRADOR */}
              <Route element={<ProtectedRoute tipo="empleado" roles={['ADMINISTRADOR']} />}>
                <Route path="/admin/configuracion"             element={<ConfigGeneral />} />
                <Route path="/admin/configuracion/usuarios"    element={<ConfigUsuarios />} />
                <Route path="/admin/configuracion/sucursales"  element={<ConfigSucursales />} />
                <Route path="/admin/configuracion/seguridad"   element={<ConfigSeguridad />} />
                <Route path="/admin/configuracion/auditoria"    element={<VisorAuditoria />} />
              </Route>

            </Route>
          </Route>

          {/* ══ AUTH CALLBACK (layout propio, sin card) ══ */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* 404 */}
          <Route path="*" element={<NoEncontrado />} />

        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
