import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ═══════════════════════════════════════════════════════════
//  Hoisted: env vars + mocks antes de cualquier import
// ═══════════════════════════════════════════════════════════
vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET = 'a'.repeat(32)
  process.env.JWT_REFRESH_SECRET = 'a'.repeat(32)
  process.env.HORARIO_DIAS = '1,2,3,4,5'
  process.env.HORARIO_INICIO = '08:00'
  process.env.HORARIO_FIN = '18:00'
  process.env.HORARIO_TIMEZONE = 'America/Bogota'
  process.env.NODE_ENV = 'test'
})

// ── Mocks ──────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
  chatbotSesion: { findUnique: vi.fn(), upsert: vi.fn() },
  producto: { findMany: vi.fn(), findUnique: vi.fn() },
}))

vi.mock('../config/database', () => ({ prisma: mockPrisma }))

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockInteracciones = vi.hoisted(() => ({
  verificarInteracciones: vi.fn(),
  recomendarSimilares: vi.fn(),
}))

vi.mock('../services/interacciones.service', () => mockInteracciones)

// ── App de prueba ─────────────────────────────────────────
import { chatbotRouter } from '../modules/chatbot/chatbot.routes'

const app = express()
app.use(express.json())
app.use(chatbotRouter)

// ── Helpers ────────────────────────────────────────────────
function mockSesionBase(overrides: Record<string, unknown> = {}) {
  return {
    estado: 'menu',
    contexto: {},
    mensajes: [],
    productosConsultados: [],
    ultimoMensaje: '',
    ...overrides,
  }
}

function mockProducto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    nombre: 'Ibuprofeno',
    concentracion: '400mg',
    presentacion: 'Tabletas x 30',
    laboratorio: 'Tecnoquímicas',
    precioVenta: 8500,
    requiereRx: false,
    principioActivo: 'Ibuprofeno',
    slug: 'ibuprofeno-400mg',
    stockTotal: 50,
    tieneStock: true,
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════
//  POST / — Mensaje principal
// ═══════════════════════════════════════════════════════════
describe('POST /', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Sesión por defecto: no existe, crear nueva
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue(null)
    mockPrisma.chatbotSesion.upsert.mockResolvedValue({})
    mockPrisma.producto.findMany.mockResolvedValue([])
  })

  it('retorna 400 si el mensaje está vacío', async () => {
    const res = await request(app).post('/').send({ mensaje: '  ' })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })

  it('responde con el menú principal al decir "hola"', async () => {
    const res = await request(app).post('/').send({ mensaje: 'hola' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const data = res.body.data
    expect(data.respuesta).toContain('Menú Principal')
    expect(data.menuActivo).toBe('menu')
    expect(data.productos).toEqual([])
    expect(data.alertas).toEqual([])

    // Verificar persistencia
    expect(mockPrisma.chatbotSesion.upsert).toHaveBeenCalledTimes(1)
  })

  it('acepta sessionToken y lo usa', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-test-123',
      mensajes: JSON.stringify(mockSesionBase({ estado: 'buscar' })),
      escalaHumano: false,
    })

    const res = await request(app).post('/').send({
      mensaje: 'ibuprofeno',
      sessionToken: 'session-test-123',
    })
    expect(res.status).toBe(200)
    expect(mockPrisma.chatbotSesion.findUnique).toHaveBeenCalledWith({
      where: { sessionToken: 'session-test-123' },
    })
  })

  it('opción "1" cambia estado a buscar', async () => {
    const res = await request(app).post('/').send({ mensaje: '1' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Buscar medicamentos')
    expect(res.body.data.menuActivo).toBe('buscar')
  })

  it('opción "2" cambia estado a interacciones', async () => {
    const res = await request(app).post('/').send({ mensaje: '2' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('interacciones medicamentosas')
    expect(res.body.data.menuActivo).toBe('interacciones')
  })

  it('opción "3" muestra horarios y sedes', async () => {
    const res = await request(app).post('/').send({ mensaje: '3' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Sedes')
    expect(res.body.data.menuActivo).toBe('menu')
  })

  it('opción "4" muestra domicilios', async () => {
    const res = await request(app).post('/').send({ mensaje: '4' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Domicilios')
  })

  it('opción "5" cambia estado a alternativas', async () => {
    const res = await request(app).post('/').send({ mensaje: '5' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Alternativas')
    expect(res.body.data.menuActivo).toBe('alternativas')
  })

  it('opción "6" cambia estado a info', async () => {
    const res = await request(app).post('/').send({ mensaje: '6' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Información detallada')
    expect(res.body.data.menuActivo).toBe('info')
  })

  it('opción "7" muestra el sub-menú FAQ', async () => {
    const res = await request(app).post('/').send({ mensaje: '7' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Preguntas Frecuentes')
    expect(res.body.data.menuActivo).toBe('faq')
  })

  it('opción "8" muestra contacto con asesor', async () => {
    const res = await request(app).post('/').send({ mensaje: '8' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('asesor humano')
    expect(res.body.data.menuActivo).toBe('menu')
  })

  it('detecta intención por palabra clave "buscar"', async () => {
    const res = await request(app).post('/').send({ mensaje: 'quiero buscar medicamentos' })
    expect(res.status).toBe(200)
    expect(res.body.data.menuActivo).toBe('buscar')
  })

  it('detecta intención por palabra clave "horario"', async () => {
    const res = await request(app).post('/').send({ mensaje: 'cuál es el horario' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Sedes')
  })

  it('detecta intención por palabra clave "domicilio"', async () => {
    const res = await request(app).post('/').send({ mensaje: 'hacen domicilios' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Domicilios')
  })

  it('detecta intención por palabra clave "asesor"', async () => {
    const res = await request(app).post('/').send({ mensaje: 'quiero hablar con un asesor' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('asesor humano')
  })

  it('vuelve al menú con "volver"', async () => {
    const res = await request(app).post('/').send({ mensaje: 'volver' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Menú Principal')
    expect(res.body.data.menuActivo).toBe('menu')
  })

  it('entrada desconocida sin palabra clave sugiere el menú', async () => {
    const res = await request(app).post('/').send({ mensaje: 'xyzzy' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Menú Principal')
  })

  it('entrada >= 3 letras sin coincidencia en menú busca en BD', async () => {
    // La función manejarMenu, al no reconocer keyword, llama buscarProductos
    // Mock para simular que el producto existe en BD
    mockPrisma.producto.findMany.mockResolvedValue([
      { ...mockProducto(), lotes: [{ cantidadActual: 10 }] },
    ])

    const res = await request(app).post('/').send({ mensaje: 'ibuprofeno' })
    expect(res.status).toBe(200)
    expect(res.body.data.productos.length).toBeGreaterThan(0)
    expect(mockPrisma.producto.findMany).toHaveBeenCalled()
  })

  it('responde correctamente aunque el guardado de sesión falle', async () => {
    // El guardado de sesión falla, pero la respuesta debe ser exitosa
    mockPrisma.chatbotSesion.upsert.mockRejectedValue(new Error('Error de escritura'))

    const res = await request(app).post('/').send({ mensaje: 'hola' })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Menú Principal')
    expect(res.body.data.menuActivo).toBe('menu')
  })

  it('no se cae si la sesión previa falla y la respuesta se construye correctamente', async () => {
    // findUnique lanza error (catchado internamente por obtenerSesion)
    mockPrisma.chatbotSesion.findUnique.mockRejectedValue(new Error('Error de lectura'))

    const res = await request(app).post('/').send({ mensaje: 'hola' })
    // obtenerSesion catcha el error y devuelve sesión default → menú se muestra
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Menú Principal')
    expect(res.body.data.menuActivo).toBe('menu')
  })
})

// ═══════════════════════════════════════════════════════════
//  POST / — Estados avanzados de menú
// ═══════════════════════════════════════════════════════════
describe('POST / — flujo de estados', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue(null)
    mockPrisma.chatbotSesion.upsert.mockResolvedValue({})
  })

  it('estado buscar: "atrás" vuelve al menú', async () => {
    // Simular sesión ya en estado 'buscar'
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-buscar',
      mensajes: mockSesionBase({ estado: 'buscar' }),
      escalaHumano: false,
    })

    const res = await request(app).post('/').send({
      mensaje: 'atrás',
      sessionToken: 'session-buscar',
    })
    expect(res.body.data.menuActivo).toBe('menu')
    expect(res.body.data.respuesta).toContain('Menú Principal')
  })

  it('estado buscar: procesa búsqueda en BD', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-buscar2',
      mensajes: mockSesionBase({ estado: 'buscar' }),
      escalaHumano: false,
    })

    mockPrisma.producto.findMany.mockResolvedValue([
      {
        id: 'prod-1', nombre: 'Ibuprofeno', concentracion: '400mg',
        presentacion: 'Tabletas', laboratorio: 'Tecnoquímicas',
        precioVenta: 8500, requiereRx: false,
        principioActivo: 'Ibuprofeno', slug: 'ibuprofeno-400mg',
        indicaciones: 'Antiinflamatorio y analgésico.',
        lotes: [{ cantidadActual: 15 }],
      },
      {
        id: 'prod-2', nombre: 'Ibuprofeno MK', concentracion: '800mg',
        presentacion: 'Tabletas', laboratorio: 'MK',
        precioVenta: 12000, requiereRx: false,
        principioActivo: 'Ibuprofeno', slug: 'ibuprofeno-mk-800mg',
        indicaciones: 'Antiinflamatorio.',
        lotes: [{ cantidadActual: 8 }],
      },
    ])

    const res = await request(app).post('/').send({
      mensaje: 'ibuprofeno',
      sessionToken: 'session-buscar2',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.productos).toHaveLength(2)
    expect(res.body.data.menuActivo).toBe('buscar')
    expect(res.body.data.respuesta).toContain('Ibuprofeno')
    expect(res.body.data.respuesta).toContain('$8.500')
  })

  it('estado buscar: muestra detalle cuando solo hay 1 resultado', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-detalle',
      mensajes: mockSesionBase({ estado: 'buscar' }),
      escalaHumano: false,
    })

    mockPrisma.producto.findMany.mockResolvedValue([
      {
        id: 'prod-1', nombre: 'Omeprazol', concentracion: '20mg',
        presentacion: 'Cápsulas x 30', laboratorio: 'Genfar',
        precioVenta: 15000, requiereRx: false,
        principioActivo: 'Omeprazol', slug: 'omeprazol-20mg',
        indicaciones: 'Tratamiento de reflujo.',
        lotes: [{ cantidadActual: 20 }],
      },
    ])

    const res = await request(app).post('/').send({
      mensaje: 'omeprazol',
      sessionToken: 'session-detalle',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.productos).toHaveLength(1)
    expect(res.body.data.respuesta).toContain('Precio')
    expect(res.body.data.respuesta).toContain('Genfar')
  })

  it('estado buscar: mensaje sin resultados', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-nada',
      mensajes: mockSesionBase({ estado: 'buscar' }),
      escalaHumano: false,
    })
    mockPrisma.producto.findMany.mockResolvedValue([])

    const res = await request(app).post('/').send({
      mensaje: 'xyzzy',
      sessionToken: 'session-nada',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.productos).toEqual([])
    expect(res.body.data.respuesta).toContain('No encontré')
  })

  it('estado faq: seleccion 1 responde primera pregunta', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-faq',
      mensajes: mockSesionBase({ estado: 'faq' }),
      escalaHumano: false,
    })

    const res = await request(app).post('/').send({
      mensaje: '1',
      sessionToken: 'session-faq',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('fórmulas')
    expect(res.body.data.menuActivo).toBe('faq')
  })

  it('estado faq: opción 7 vuelve al menú', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-faq2',
      mensajes: mockSesionBase({ estado: 'faq' }),
      escalaHumano: false,
    })

    const res = await request(app).post('/').send({
      mensaje: '7',
      sessionToken: 'session-faq2',
    })
    expect(res.body.data.menuActivo).toBe('menu')
  })

  it('estado faq: pregunta por palabra clave encuentra respuesta', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-faq3',
      mensajes: mockSesionBase({ estado: 'faq' }),
      escalaHumano: false,
    })

    const res = await request(app).post('/').send({
      mensaje: 'aceptan tarjeta de crédito',
      sessionToken: 'session-faq3',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('aceptamos múltiples formas de pago')
  })

  it('estado faq: mensaje no reconocido muestra submenú', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-faq4',
      mensajes: mockSesionBase({ estado: 'faq' }),
      escalaHumano: false,
    })

    const res = await request(app).post('/').send({
      mensaje: 'zzz',
      sessionToken: 'session-faq4',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Preguntas Frecuentes')
  })

  it('estado alternativas: "atrás" vuelve al menú', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-alt',
      mensajes: mockSesionBase({ estado: 'alternativas' }),
      escalaHumano: false,
    })
    const res = await request(app).post('/').send({
      mensaje: 'atrás',
      sessionToken: 'session-alt',
    })
    expect(res.body.data.menuActivo).toBe('menu')
  })

  it('estado alternativas: sin resultados pide nombre', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-alt2',
      mensajes: mockSesionBase({ estado: 'alternativas' }),
      escalaHumano: false,
    })
    mockPrisma.producto.findMany.mockResolvedValue([])
    const res = await request(app).post('/').send({
      mensaje: 'zzz',
      sessionToken: 'session-alt2',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('alternativas')
  })

  it('estado alternativas: múltiples productos muestra lista', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-alt3',
      mensajes: mockSesionBase({ estado: 'alternativas' }),
      escalaHumano: false,
    })
    mockPrisma.producto.findMany.mockResolvedValue([
      { ...mockProducto({ id: 'p1', nombre: 'Ibuprofeno' }), lotes: [{ cantidadActual: 5 }] },
      { ...mockProducto({ id: 'p2', nombre: 'Ibuprofeno MK' }), lotes: [{ cantidadActual: 3 }] },
    ])
    const res = await request(app).post('/').send({
      mensaje: 'ibuprofeno',
      sessionToken: 'session-alt3',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('¿Para cuál deseas alternativas?')
  })

  it('estado alternativas: un producto busca similares', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-alt4',
      mensajes: mockSesionBase({ estado: 'alternativas' }),
      escalaHumano: false,
    })
    mockPrisma.producto.findMany.mockResolvedValue([
      { ...mockProducto({ id: 'p1' }), lotes: [{ cantidadActual: 5 }] },
    ])
    mockInteracciones.recomendarSimilares.mockResolvedValue([
      { id: 's1', nombre: 'Naproxeno', concentracion: '500mg', precioVenta: 12000, laboratorio: 'Genfar' },
      { id: 's2', nombre: 'Diclofenaco', concentracion: '50mg', precioVenta: 8000, laboratorio: 'La Sante' },
    ])
    const res = await request(app).post('/').send({
      mensaje: 'ibuprofeno',
      sessionToken: 'session-alt4',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Alternativas')
    expect(res.body.data.productos.length).toBeGreaterThan(1)
  })

  it('estado info: "atrás" vuelve al menú', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-info',
      mensajes: mockSesionBase({ estado: 'info' }),
      escalaHumano: false,
    })
    const res = await request(app).post('/').send({
      mensaje: 'atrás',
      sessionToken: 'session-info',
    })
    expect(res.body.data.menuActivo).toBe('menu')
  })

  it('estado info: sin resultados', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-info2',
      mensajes: mockSesionBase({ estado: 'info' }),
      escalaHumano: false,
    })
    mockPrisma.producto.findMany.mockResolvedValue([])
    const res = await request(app).post('/').send({
      mensaje: 'xyz',
      sessionToken: 'session-info2',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('qué producto')
  })

  it('estado info: múltiples productos muestra lista para elegir', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-info3',
      mensajes: mockSesionBase({ estado: 'info' }),
      escalaHumano: false,
    })
    mockPrisma.producto.findMany.mockResolvedValue([
      { ...mockProducto({ id: 'p1' }), lotes: [{ cantidadActual: 5 }] },
      { ...mockProducto({ id: 'p2', nombre: 'Ibuprofeno MK' }), lotes: [{ cantidadActual: 3 }] },
    ])
    const res = await request(app).post('/').send({
      mensaje: 'ibuprofeno',
      sessionToken: 'session-info3',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Varios productos')
  })

  it('estado info: un producto muestra detalle completo', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-info4',
      mensajes: mockSesionBase({ estado: 'info' }),
      escalaHumano: false,
    })
    mockPrisma.producto.findMany.mockResolvedValue([
      { ...mockProducto({ id: 'p1' }), lotes: [{ cantidadActual: 10 }] },
    ])
    mockPrisma.producto.findUnique.mockResolvedValue({
      id: 'p1', nombre: 'Ibuprofeno', concentracion: '400mg',
      presentacion: 'Tabletas x 30', laboratorio: 'Tecnoquímicas',
      precioVenta: 8500, requiereRx: false,
      principioActivo: 'Ibuprofeno', atc: 'M01AE01',
      descripcionAtc: 'Antiinflamatorios', formaFarmaceutica: 'Tableta',
      viaAdministracion: 'Oral', indicaciones: 'Dolor e inflamación',
      contraindicaciones: 'Úlcera péptica', reaccionesAdversas: 'Náuseas',
      interacciones: 'Anticoagulantes', modoUso: '1 cada 8h',
      alergenos: 'Lactosa', advertencias: 'No exceder',
      registroInvima: 'INVIMA 2023M-001234', cum: '1234567890',
      estadoCum: 'VIGENTE', titular: 'Tecnoquímicas S.A.',
    })
    const res = await request(app).post('/').send({
      mensaje: 'ibuprofeno',
      sessionToken: 'session-info4',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('Ficha completa')
    expect(res.body.data.respuesta).toContain('Registro INVIMA')
    expect(res.body.data.respuesta).toContain('INVIMA 2023M-001234')
  })

  it('estado interacciones: "atrás" vuelve al menú', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-inter',
      mensajes: mockSesionBase({ estado: 'interacciones' }),
      escalaHumano: false,
    })
    mockPrisma.producto.findMany.mockResolvedValue([])
    const res = await request(app).post('/').send({
      mensaje: 'atrás',
      sessionToken: 'session-inter',
    })
    expect(res.body.data.menuActivo).toBe('menu')
  })

  it('estado interacciones: menos de 2 medicamentos pide más', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-inter2',
      mensajes: mockSesionBase({ estado: 'interacciones', productosConsultados: [] }),
      escalaHumano: false,
    })
    mockPrisma.producto.findMany.mockResolvedValue([
      { ...mockProducto({ id: 'p1' }), lotes: [{ cantidadActual: 5 }] },
    ])
    const res = await request(app).post('/').send({
      mensaje: 'ibuprofeno',
      sessionToken: 'session-inter2',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.respuesta).toContain('dos medicamentos')
  })

  it('estado interacciones: detecta alertas', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-inter3',
      mensajes: mockSesionBase({ estado: 'interacciones', productosConsultados: ['existing-id'] }),
      escalaHumano: false,
    })
    mockPrisma.producto.findMany.mockResolvedValue([
      { ...mockProducto({ id: 'p1' }), lotes: [{ cantidadActual: 5 }] },
      { ...mockProducto({ id: 'p2', nombre: 'Warfarina' }), lotes: [{ cantidadActual: 10 }] },
    ])
    mockInteracciones.verificarInteracciones.mockResolvedValue({
      tieneAlertas: true,
      alertas: [{ tipo: 'INTERACCION', productoA: 'Ibuprofeno', productoB: 'Warfarina', descripcion: 'Riesgo de sangrado', severidad: 'ALTA' }],
    })
    const res = await request(app).post('/').send({
      mensaje: 'ibuprofeno y warfarina',
      sessionToken: 'session-inter3',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.alertas).toHaveLength(1)
    expect(res.body.data.alertas[0].severidad).toBe('ALTA')
  })

  it('estado interacciones: sin alertas retorna ok', async () => {
    mockPrisma.chatbotSesion.findUnique.mockResolvedValue({
      sessionToken: 'session-inter4',
      mensajes: mockSesionBase({ estado: 'interacciones', productosConsultados: ['existing-id'] }),
      escalaHumano: false,
    })
    mockPrisma.producto.findMany.mockResolvedValue([
      { ...mockProducto({ id: 'p1' }), lotes: [{ cantidadActual: 5 }] },
      { ...mockProducto({ id: 'p2', nombre: 'Vitamina C' }), lotes: [{ cantidadActual: 10 }] },
    ])
    mockInteracciones.verificarInteracciones.mockResolvedValue({
      tieneAlertas: false,
      alertas: [],
    })
    const res = await request(app).post('/').send({
      mensaje: 'ibuprofeno vitamina c',
      sessionToken: 'session-inter4',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.alertas).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════
//  POST /interacciones
// ═══════════════════════════════════════════════════════════
describe('POST /interacciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 400 si no se envían productoIds', async () => {
    const res = await request(app).post('/interacciones').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('dos productos')
  })

  it('retorna 400 si productoIds es array vacío', async () => {
    const res = await request(app).post('/interacciones').send({ productoIds: [] })
    expect(res.status).toBe(400)
  })

  it('retorna alertas de interacciones encontradas', async () => {
    mockInteracciones.verificarInteracciones.mockResolvedValue({
      tieneAlertas: true,
      alertas: [
        {
          tipo: 'INTERACCION_MEDICAMENTOSA',
          productoA: 'Warfarina',
          productoB: 'Ibuprofeno',
          descripcion: 'Riesgo de sangrado',
          severidad: 'ALTA',
        },
      ],
    })

    const res = await request(app).post('/interacciones').send({
      productoIds: ['prod-1', 'prod-2'],
    })
    expect(res.status).toBe(200)
    expect(res.body.data.tieneAlertas).toBe(true)
    expect(res.body.data.alertas).toHaveLength(1)
    expect(res.body.data.alertas[0].severidad).toBe('ALTA')
    // Ahora pasa también los alérgenos del perfil (undefined si no se envían)
    expect(mockInteracciones.verificarInteracciones).toHaveBeenCalledWith(['prod-1', 'prod-2'], undefined)
  })

  it('retorna sin alertas si no hay interacciones', async () => {
    mockInteracciones.verificarInteracciones.mockResolvedValue({
      tieneAlertas: false,
      alertas: [],
    })

    const res = await request(app).post('/interacciones').send({
      productoIds: ['prod-3', 'prod-4'],
    })
    expect(res.status).toBe(200)
    expect(res.body.data.tieneAlertas).toBe(false)
    expect(res.body.data.alertas).toEqual([])
  })

  it('maneja error del servicio con 500', async () => {
    mockInteracciones.verificarInteracciones.mockRejectedValue(new Error('Error interno'))

    const res = await request(app).post('/interacciones').send({
      productoIds: ['prod-1', 'prod-2'],
    })
    expect(res.status).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════
//  GET /producto/:id
// ═══════════════════════════════════════════════════════════
describe('GET /producto/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna producto encontrado con stock total', async () => {
    mockPrisma.producto.findUnique.mockResolvedValue({
      id: 'prod-1',
      nombre: 'Ibuprofeno',
      concentracion: '400mg',
      presentacion: 'Tabletas x 30',
      laboratorio: 'Tecnoquímicas',
      precioVenta: 8500,
      requiereRx: false,
      principioActivo: 'Ibuprofeno',
      atc: 'M01AE01',
      descripcionAtc: 'Antiinflamatorio',
      formaFarmaceutica: 'Tableta',
      viaAdministracion: 'Oral',
      indicaciones: 'Dolor e inflamación',
      contraindicaciones: 'Insuficiencia renal',
      reaccionesAdversas: 'Náuseas',
      interacciones: 'Evitar con anticoagulantes',
      modoUso: '1 tableta cada 8 horas',
      alergenos: 'Lactosa',
      advertencias: 'No exceder 3 tabletas al día',
      registroInvima: 'INVIMA 2023M-001234',
      cum: '1234567890',
      estadoCum: 'VIGENTE',
      titular: 'Tecnoquímicas S.A.',
      slug: 'ibuprofeno-400mg',
      lotes: [
        { cantidadActual: 15 },
        { cantidadActual: 10 },
        { cantidadActual: 5 },
      ],
    })

    const res = await request(app).get('/producto/prod-1')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const data = res.body.data
    expect(data.nombre).toBe('Ibuprofeno')
    expect(data.precioVenta).toBe(8500)
    expect(data.stockTotal).toBe(30) // 15 + 10 + 5
    expect(data.registroInvima).toBe('INVIMA 2023M-001234')
    expect(data.cum).toBe('1234567890')
  })

  it('retorna 404 si el producto no existe', async () => {
    mockPrisma.producto.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/producto/inexistente')
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('Producto')
  })

  it('maneja error interno con 500', async () => {
    mockPrisma.producto.findUnique.mockRejectedValue(new Error('DB error'))

    const res = await request(app).get('/producto/prod-1')
    expect(res.status).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════
//  GET /horario
// ═══════════════════════════════════════════════════════════
describe('GET /horario', () => {
  it('retorna objeto con disponible y mensaje', async () => {
    const res = await request(app).get('/horario')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('disponible')
    expect(res.body.data).toHaveProperty('mensaje')
    // El valor de disponible depende de la hora actual, solo verificamos estructura
    expect(typeof res.body.data.disponible).toBe('boolean')
    expect(typeof res.body.data.mensaje).toBe('string')
  })
})
