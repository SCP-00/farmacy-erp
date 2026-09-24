// ══════════════════════════════════════════════════════════
//  services/index.ts — Todos los servicios de la API
//  Cada función representa una llamada HTTP
// ══════════════════════════════════════════════════════════

import { api, apiCliente, apiPublica } from '@/config/api'
import { filtrarCatalogo, mockCategorias, mockSedes } from '@/data/catalogo'

/** Autenticación de empleados (admin panel). Login, refresh token, logout. */
export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then(r => r.data.data),

  me: () =>
    api.get('/auth/me').then(r => r.data.data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then(r => r.data.data),

  logout: () =>
    api.post('/auth/logout').then(r => r.data),
}

/** Autenticación de clientes (B2C web). Registro, login, OAuth Google, verificación email. */
export const authClienteService = {
  registro: (data: {
    nombre: string; apellido: string; email: string
    password: string; tipoDoc?: string; documento?: string
    autorizacionDatos: boolean
  }) => apiPublica.post('/clientes/auth/registro', data).then(r => r.data),

  login: (email: string, password: string) =>
    apiPublica.post('/clientes/auth/login', { email, password }).then(r => r.data.data),

  me: () =>
    apiCliente.get('/clientes/auth/me').then(r => r.data.data),
  actualizarMe: (data: Record<string, unknown>) =>
    apiCliente.patch('/clientes/auth/me', data).then(r => r.data.data),

  verificarEmail: (token: string) =>
    apiPublica.post('/clientes/auth/verificar-email', { token }).then(r => r.data),

  recuperarPassword: (email: string) =>
    apiPublica.post('/clientes/auth/recuperar-password', { email }).then(r => r.data),

  resetPassword: (token: string, password: string) =>
    apiPublica.post('/clientes/auth/reset-password', { token, password }).then(r => r.data),

  googleUrl: () => `${import.meta.env.VITE_API_URL || '/api/v1'}/clientes/auth/google`,

  // Para OAuth callback — pasar token manualmente porque aún no está en el store
  meConToken: async (token: string) => {
    const { data } = await apiPublica.get('/clientes/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return data.data
  },
}

/** Gestión de productos del catálogo. Búsqueda pública, CRUD para admin. */
export const productosService = {
  // Público — tienda web
  buscar: async (params: {
    q?: string; categoria?: string; marca?: string; rx?: boolean
    precioMin?: number; precioMax?: number; envio?: boolean; tienda?: boolean
    ordenar?: string; pagina?: number; limite?: number
  }) => {
    try {
      const response = await apiPublica.get('/productos/buscar', { params })
      return response.data
    } catch {
      return filtrarCatalogo(params)
    }
  },

  // Empleados — panel admin
  listar: (params?: Record<string, unknown>) =>
    api.get('/productos', { params }).then(r => r.data).catch(() => filtrarCatalogo()),

  obtener: (id: string) =>
    apiPublica.get(`/productos/${id}`).then(r => r.data.data).catch(() => filtrarCatalogo().data.find((producto) => producto.id === id)),

  crear: (data: Record<string, unknown>) =>
    api.post('/productos', data).then(r => r.data.data),

  actualizar: (id: string, data: Record<string, unknown>) =>
    api.patch(`/productos/${id}`, data).then(r => r.data.data),

  desactivar: (id: string) =>
    api.delete(`/productos/${id}`).then(r => r.data),
}

/** Categorías de productos. Consulta pública con fallback a datos mock. */
export const categoriasService = {
  listar: async () => {
    try {
      const response = await apiPublica.get('/categorias')
      return response.data.data
    } catch {
      return mockCategorias
    }
  },
}

/** Inventario y lotes FEFO. Gestión de lotes, ajustes de stock, movimientos, alertas. */
export const inventarioService = {
  listarLotes: (params?: Record<string, unknown>) =>
    api.get('/lotes', { params }).then(r => r.data),

  crearLote: (data: Record<string, unknown>) =>
    api.post('/lotes', data).then(r => r.data.data),

  ajustarStock: (loteId: string, data: { tipo: string; cantidad: number; motivo: string; descripcion?: string }) =>
    api.post(`/inventario/ajuste`, { loteId, ...data }).then(r => r.data),

  movimientos: (params?: Record<string, unknown>) =>
    api.get('/inventario/movimientos', { params }).then(r => r.data),

  alertas: (query = '') =>
    api.get(`/inventario/alertas${query}`).then(r => r.data.data),
}

/** Importación masiva de catálogo por CSV (solo ADMIN/AUXILIAR). */
export const importadorService = {
  productos: (csv: string) =>
    api.post('/importar/productos', { csv }).then(r => r.data.data),
}

/** Proveedores. CRUD completo para gestión de proveedores. */
export const proveedoresService = {
  listar: (params?: Record<string, unknown>) =>
    api.get('/proveedores', { params }).then(r => r.data),

  crear: (data: Record<string, unknown>) =>
    api.post('/proveedores', data).then(r => r.data.data),

  obtener: (id: string) =>
    api.get(`/proveedores/${id}`).then(r => r.data.data),

  actualizar: (id: string, data: Record<string, unknown>) =>
    api.patch(`/proveedores/${id}`, data).then(r => r.data.data),
}

/** Órdenes de compra. Creación, recepción de mercancía, listado. */
export const comprasService = {
  listarOrdenes: (params?: Record<string, unknown>) =>
    api.get('/compras', { params }).then(r => r.data),

  crearOrden: (data: Record<string, unknown>) =>
    api.post('/compras', data).then(r => r.data.data),

  obtenerOrden: (id: string) =>
    api.get(`/compras/${id}`).then(r => r.data.data),

  recibirMercancia: (ordenId: string, data: Record<string, unknown>) =>
    api.post(`/compras/${ordenId}/recibir`, data).then(r => r.data),
}

/** Ventas POS. Registro, listado, dashboard, devoluciones. */
export const ventasService = {
  registrar: (data: Record<string, unknown>) =>
    api.post('/ventas', data).then(r => r.data.data),

  listar: (params?: Record<string, unknown>) =>
    api.get('/ventas', { params }).then(r => r.data),

  dashboard: () =>
    api.get('/ventas/dashboard').then(r => r.data.data),

  devolucion: (ventaId: string, data: { motivo: string; reintegraStock: boolean }) =>
    api.post(`/ventas/${ventaId}/devolucion`, data).then(r => r.data),
}

/** Caja POS. Apertura/cierre, estado actual, historial. */
export const cajaService = {
  abrirCaja: (data: { sucursalId: number; montoApertura: number }) =>
    api.post('/caja/abrir', data).then(r => r.data.data),

  cerrarCaja: (cajaId: string, data: Record<string, unknown>) =>
    api.post(`/caja/${cajaId}/cerrar`, data).then(r => r.data.data),

  estadoActual: () =>
    api.get('/caja/actual').then(r => r.data.data),

  historial: (params?: Record<string, unknown>) =>
    api.get('/caja/historial', { params }).then(r => r.data.data),
}

/** Gestión de clientes (empleados) y perfil de cliente (B2C). Carrito, favoritos, pedidos, salud. */
export const clientesService = {
  listar: (params?: Record<string, unknown>) =>
    api.get('/clientes', { params }).then(r => r.data),

  obtener: (id: string) =>
    api.get(`/clientes/${id}`).then(r => r.data.data),

  historialCompras: (clienteId: string) =>
    api.get(`/clientes/${clienteId}/compras`).then(r => r.data.data),

  // Carrito y favoritos (cliente logueado en tienda)
  agregarCarrito: (productoId: string, cantidad: number) =>
    apiCliente.post('/clientes/carrito', { productoId, cantidad }).then(r => r.data),

  obtenerCarrito: () =>
    apiCliente.get('/clientes/carrito').then(r => r.data.data),

  toggleFavorito: (productoId: string) =>
    apiCliente.post('/clientes/auth/favoritos', { productoId }).then(r => r.data),

  obtenerFavoritos: () =>
    apiCliente.get('/clientes/auth/favoritos').then(r => r.data.data),

  misPedidos: () =>
    apiCliente.get('/clientes/auth/pedidos').then(r => r.data.data),
  solicitarDevolucion: (ventaId: string, motivo: string) =>
    apiCliente.post(`/clientes/auth/pedidos/${ventaId}/devolucion-request`, { motivo }).then(r => r.data),

  // ── Comprar B2C — Cliente autenticado realiza compra
  // Seguro por diseño: el cliente SOLO envía productoId+cantidad y el código
  // de cupón; precios, descuentos y totales los calcula el backend.
  comprar: (data: {
    metodoPago: string;
    items: { productoId: string; cantidad: number }[];
    codigoDescuento?: string;
    puntosUsados?: number;
    direccionEnvio?: string;
    ciudad?: string;
  }) =>
    apiCliente.post('/clientes/auth/comprar', data).then(r => r.data.data),

  // ── Perfil de Salud ─────────────────────────────────--
  obtenerSalud: () =>
    apiCliente.get('/clientes/auth/salud').then(r => r.data.data),
  actualizarSalud: (data: { alergenos?: string[]; condiciones?: string[] }) =>
    apiCliente.patch('/clientes/auth/salud', data).then(r => r.data.data),
}

/** Gestión de empleados. CRUD y cambio de estado activo/inactivo. */
export const empleadosService = {
  listar: (params?: Record<string, unknown>) =>
    api.get('/empleados', { params }).then(r => r.data),

  crear: (data: Record<string, unknown>) =>
    api.post('/empleados', data).then(r => r.data.data),

  actualizar: (id: string, data: Record<string, unknown>) =>
    api.patch(`/empleados/${id}`, data).then(r => r.data.data),

  cambiarEstado: (id: string, activo: boolean) =>
    api.patch(`/empleados/${id}/estado`, { activo }).then(r => r.data),
}

/** Sucursales físicas. Consulta pública con fallback a datos mock. */
export const sucursalesService = {
  listar: async () => {
    try {
      const response = await apiPublica.get('/sucursales')
      return response.data.data
    } catch {
      return mockSedes
    }
  },
}

/** Reportes de ventas, inventario, compras. Exportación CSV. */
export const reportesService = {
  ventas: (params: { desde: string; hasta: string; sucursalId?: number }) =>
    api.get('/reportes/ventas', { params }).then(r => r.data.data),

  inventario: () =>
    api.get('/reportes/inventario').then(r => r.data.data),

  compras: (params: { desde: string; hasta: string }) =>
    api.get('/reportes/compras', { params }).then(r => r.data.data),

  exportarCSV: (tipo: string, params: Record<string, unknown>) =>
    api.get(`/reportes/${tipo}/csv`, { params, responseType: 'blob' }).then(r => r.data),
}

/** Auditoría de acciones. Logs de actividad e historial de cambios en productos. */
export const auditoriaService = {
  listarLogs: (params?: Record<string, unknown>) =>
    api.get('/auditoria/logs-actividad', { params }).then(r => r.data),

  listarAcciones: () =>
    api.get('/auditoria/logs-actividad/acciones').then(r => r.data),

  historialCambios: (productoId: string, params?: Record<string, unknown>) =>
    api.get(`/auditoria/productos/${productoId}/historial-cambios`, { params }).then(r => r.data),
}

/** Chatbot FarmaBot. Envío de mensajes, verificación horario, interacciones medicamentosas. */
export const chatbotService = {
  enviarMensaje: (mensaje: string, sessionToken: string) =>
    apiPublica.post('/chatbot', { mensaje, sessionToken }).then(r => r.data.data),

  verificarHorario: () =>
    apiPublica.get('/chatbot/horario').then(r => r.data.data),

  verificarInteracciones: (productoIds: string[], alergenosCliente?: string[]) =>
    apiPublica.post('/chatbot/interacciones', { productoIds, alergenosCliente }).then(r => r.data.data),

  obtenerDetalleProducto: (productoId: string) =>
    apiPublica.get(`/chatbot/producto/${productoId}`).then(r => r.data.data),
}

/** Push notifications Web Push API. VAPID keys, suscripción, dispositivos. */
export const pushService = {
  getVapidKey: () =>
    api.get('/push/vapid-public-key').then(r => r.data.data.publicKey),

  subscribir: (subscription: Record<string, unknown>, userAgent?: string) =>
    api.post('/push/subscribir', { subscription, userAgent }).then(r => r.data),

  desubscribir: (endpoint?: string) =>
    api.delete('/push/subscribir', { data: { endpoint } }).then(r => r.data),

  listarDispositivos: () =>
    api.get('/push/dispositivos').then(r => r.data.data),

  eliminarDispositivo: (id: string) =>
    api.delete(`/push/subscribir/${id}`).then(r => r.data),
}

/** Pasarelas de pago. Wompi, Stripe, MercadoPago, efectivo. */
export const pagosService = {
  // El monto nunca viaja desde el cliente: el backend lo toma de la venta en DB
  crearWompi: (ventaId: string) =>
    apiCliente.post('/pagos/wompi/crear', { ventaId }).then(r => r.data.data),

  crearStripeIntent: (ventaId: string) =>
    apiCliente.post('/pagos/stripe/crear-intent', { ventaId }).then(r => r.data.data),

  crearMercadoPago: (data: { pedidoId?: string; ventaId?: string; clienteEmail?: string }) =>
    apiCliente.post('/pagos/mercadopago/crear', data).then(r => r.data.data),

  registrarEfectivo: (ventaId: string, monto: number) =>
    api.post('/pagos/efectivo/registrar', { ventaId, monto }).then(r => r.data),
}

/** Cupones de descuento. Validación y cálculo SIEMPRE server-side. */
export const cuponesService = {
  validar: (codigo: string, items: Array<{ productoId: string; cantidad: number }>) =>
    apiCliente.post('/cupones/validar', { codigo, items }).then(r => r.data.data),
}