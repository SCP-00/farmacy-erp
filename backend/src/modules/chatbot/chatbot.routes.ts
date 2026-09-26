// ══════════════════════════════════════════════════════════
//  MODULO CHATBOT — FarmaBot Asistente Virtual
//  Sistema de menú inteligente multicapa.
//  Sin LLM — respuestas predefinidas + búsqueda SQL.
//
//  POST /api/v1/chatbot              Enviar mensaje
//  GET  /api/v1/chatbot/horario      Horario asesor
//  POST /api/v1/chatbot/interacciones Verificar interacciones
//  GET  /api/v1/chatbot/producto/:id  Detalle producto
// ══════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { responder } from '../../utils/respuesta.utils'
import { env } from '../../config/env'
import { logger } from '../../utils/logger'
import { verificarInteracciones, recomendarSimilares } from '../../services/interacciones.service'
import { validarCuerpo } from '../../middlewares/index'

export const chatbotRouter: Router = Router()

// ── Schemas de validación Zod ──────────────────────────
// Protegen contra NoSQL injection (objetos inyectados como strings)
// y aseguran types correctos antes de llegar a Prisma

const mensajeChatbotSchema = z.object({
  mensaje: z.string().max(500).default(''), // Permite vacío; el handler retorna 400 custom
  sessionToken: z.string().max(128).optional(),
})

const interaccionesSchema = z.object({
  productoIds: z.array(z.string().min(1)).max(20).optional().default([]), // Default vacío; handler retorna 400 custom
  alergenosCliente: z.array(z.string().min(1)).max(20).optional(),
})

// ── Sanitización de inputs ──────────────────────────────
const MAX_MENSAJE_LENGTH = 500
const MAX_SESSION_TOKEN_LENGTH = 128

/**
 * Limpia un string de entrada:
 * - Elimina etiquetas HTML/XML
 * - Limita la longitud
 * - Elimina caracteres de control (excepto saltos de línea básicos)
 * - Seguridad: fuerza typeof === 'string' para prevenir NoSQL injection
 */
function sanitizarInput(input: unknown, maxLength: number = MAX_MENSAJE_LENGTH): string {
  // Defense-in-depth: rechazar no-strings (evita inyección de objetos)
  if (typeof input !== 'string') return ''
  let limpio = input
    // Eliminar etiquetas HTML/XML completas con contenido
    .replace(/<[^>]*>/g, '')
    // Eliminar caracteres de control excepto \n, \r, \t
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Limitar a maxLength
    .trim()
    .slice(0, maxLength)
  return limpio
}

/**
 * Valida que un sessionToken sea seguro para usar como clave de BD.
 * Solo permite caracteres alfanuméricos, guiones y puntos.
 * Seguridad: fuerza typeof === 'string' para prevenir NoSQL injection.
 */
function sanitizarSessionToken(token: unknown): string {
  if (typeof token !== 'string') return ''
  return token
    .replace(/[^a-zA-Z0-9\-_.]/g, '')
    .slice(0, MAX_SESSION_TOKEN_LENGTH)
}

// ── Tipos ─────────────────────────────────────────────────
type EstadoMenu = 'menu' | 'buscar' | 'interacciones' | 'alternativas' | 'info' | 'faq'

interface SesionData {
  estado: EstadoMenu
  contexto: Record<string, unknown>
  mensajes: { role: string; text: string; timestamp: string }[]
  productosConsultados: string[]
  ultimoMensaje: string
}

// ── MENÚ PRINCIPAL ────────────────────────────────────────
const MENU_PRINCIPAL = `
╔══════════════════════════════════╗
║     🏪 FarmaBot — Menú Principal ║
╚══════════════════════════════════╝

Elige una opción:

[1] 🔍 Buscar medicamentos
    Revisa disponibilidad, precio y stock.

[2] ⚠️ Verificar interacciones
    Cruza medicamentos y detecta contraindicaciones.

[3] 🏪 Horarios y sedes
    Conoce nuestras sucursales y horarios.

[4] 🚚 Domicilios y envíos
    Información sobre entregas a domicilio.

[5] 💊 Alternativas y genéricos
    Busca opciones similares a un medicamento.

[6] 📋 Información detallada
    Indicaciones, contraindicaciones, modo de uso.

[7] ❓ Preguntas frecuentes
    Responde dudas comunes.

[8] 💬 Hablar con un asesor
    Conéctate con atención humana.
`.trim()

// ── SUB-MENÚ FAQ ──────────────────────────────────────────
const SUBMENU_FAQ = `
╔══════════════════════════════════╗
║     ❓ Preguntas Frecuentes      ║
╚══════════════════════════════════╝

[1] ¿Aceptan fórmulas médicas electrónicas?
[2] ¿Puedo comprar sin receta?
[3] ¿Cómo sé si un medicamento requiere RX?
[4] ¿Aceptan tarjetas de crédito?
[5] ¿Cuánto tardan los domicilios?
[6] ¿Hacen envíos a otras ciudades?
[7] Volver al menú principal
`.trim()

const FAQ_RESPUESTAS: Record<string, string> = {
  '1': `✅ Sí, aceptamos fórmulas médicas electrónicas válidas.

Las recetas electrónicas deben cumplir con la normativa colombiana:
- Fecha de expedición no mayor a 30 días
- Datos completos del médico y paciente
- Firma digital válida

Puedes presentarlas en cualquiera de nuestras sedes físicas.`,

  '2': `ℹ️ Depende del tipo de medicamento:

✅ Venta libre: Paracetamol, ibuprofeno, vitaminas, etc.
❌ Requieren RX: Antibióticos, antihipertensivos, antidepresivos, etc.

En la tienda online, los productos con RX muestran un distintivo ⚠️.
Para comprarlos necesitas presentar la fórmula médica en sede.`,

  '3': `🔍 Los medicamentos que requieren fórmula médica (RX) tienen estas características:

• Antimicrobianos (antibióticos, antivirales)
• Cardiovasculares (antihipertensivos, antiarrítmicos)
• Sistema nervioso (ansiolíticos, antidepresivos)
• Hormonales (anticonceptivos, tiroideos)
• Oncológicos
• Control especial (opioides, benzodiacepinas)

En nuestra tienda online, cada producto indica claramente si requiere RX.`,

  '4': `💳 Sí, aceptamos múltiples formas de pago:

• Tarjetas de crédito (Visa, Mastercard, Amex)
• Tarjetas débito
• Transferencias bancarias (Nequi, Daviplata)
• Efectivo (en sede)
• PSE (próximamente)

Pagos online procesados de forma segura.`,

  '5': `🚚 Tiempos de entrega estimados:

• Pereira y Dosquebradas: 30-45 minutos
• La Virginia, Marsella: 60-90 minutos
• Resto del eje cafetero: 2-4 horas (previa coordinación)

💰 Costo de domicilio: $7,000 - $10,000 según la zona.
Pedido mínimo: $20,000.`,

  '6': `📦 Actualmente realizamos domicilios principalmente en:

🏙️ Pereira
🏙️ Dosquebradas
🏙️ La Virginia

Para envíos a otras ciudades del país, contáctanos directamente y te asesoramos con empresas de mensajería aliadas.

Los productos con fórmula médica (RX) no pueden enviarse fuera del área metropolitana.`,

  '7': 'VOLVER_MENU',
}

// ── INFO SEDES ────────────────────────────────────────────
const INFO_SEDES = `
🏪 **Nuestras Sedes**

📍 Sede Centro
   Carrera 8 #22-45, Pereira
   🕐 Lun-Sáb: 7:00 AM - 9:00 PM
   🕐 Dom/Fest: 8:00 AM - 6:00 PM

📍 Sede El Lago
   Calle 15 #11-20, Pereira
   🕐 Lun-Sáb: 7:00 AM - 8:00 PM
   🕐 Dom/Fest: 9:00 AM - 5:00 PM

📍 Sede Circunvalar (próximamente)
   Avenida Circunvalar #33-45, Pereira

📞 Línea de atención: (606) 333 33 33
📱 WhatsApp: 310 123 45 67
`.trim()

const INFO_DOMICILIOS = `
🚚 **Servicio de Domicilios**

🕐 Horario de domicilios: Mismo horario de las sedes
💰 Costo: $7,000 - $10,000 según zona
📦 Pedido mínimo: $20,000
⏱️ Tiempo estimado: 30-45 min (Pereira)
📍 Cobertura: Pereira y Dosquebradas

📱 Solicitudes por:
• Tienda online (recomendado)
• WhatsApp: 310 123 45 67
• Teléfono: (606) 333 33 33
`.trim()

// ── Formateo pesos ───────────────────────────────────────
const formatearPesos = (n: number): string =>
  '$' + Math.round(n).toLocaleString('es-CO')

// ── Obtener sesión ────────────────────────────────────────
async function obtenerSesion(sessionToken: string): Promise<SesionData> {
  try {
    const s = await prisma.chatbotSesion.findUnique({ where: { sessionToken } })
    if (s?.mensajes) {
      const data = s.mensajes as unknown as SesionData
      return {
        estado: data.estado || 'menu',
        contexto: data.contexto || {},
        mensajes: data.mensajes || [],
        productosConsultados: data.productosConsultados || [],
        ultimoMensaje: data.ultimoMensaje || '',
      }
    }
  } catch { /* silencioso */ }
  return { estado: 'menu', contexto: {}, mensajes: [], productosConsultados: [], ultimoMensaje: '' }
}

async function guardarSesion(sessionToken: string, data: SesionData): Promise<void> {
  try {
    await prisma.chatbotSesion.upsert({
      where: { sessionToken },
      update: { mensajes: data as unknown as any },
      create: { sessionToken, mensajes: data as unknown as any },
    })
  } catch { /* silencioso */ }
}

// ── Buscar productos en BD ────────────────────────────────
async function buscarProductos(query: string) {
  // Defense-in-depth: garantizar que query sea string (no objeto inyectado)
  if (typeof query !== 'string') return []

  const palabras = query
    .split(/[,\s]+/)
    .filter((p: unknown) => typeof p === 'string' && p.length >= 2)
    .slice(0, 5) as string[]

  if (palabras.length === 0) return []

  // Intentar búsqueda por nombre o principio activo
  const productos = await prisma.producto.findMany({
    where: {
      activo: true,
      esMuestraMedica: false,
      OR: palabras.flatMap((p: string) => [
        { nombre: { contains: p, mode: 'insensitive' as const } },
        { principioActivo: { contains: p, mode: 'insensitive' as const } },
        { concentracion: { contains: p, mode: 'insensitive' as const } },
        { laboratorio: { contains: p, mode: 'insensitive' as const } },
        { presentacion: { contains: p, mode: 'insensitive' as const } },
        { atc: { contains: p, mode: 'insensitive' as const } },
      ]),
    },
    take: 6,
    select: {
      id: true, nombre: true, concentracion: true,
      presentacion: true, laboratorio: true,
      precioVenta: true, requiereRx: true,
      principioActivo: true, slug: true,
      indicaciones: true,
      lotes: {
        where: { cantidadActual: { gt: 0 }, fechaVencimiento: { gt: new Date() } },
        select: { cantidadActual: true },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  return productos.map((p: any) => ({
    id: p.id, nombre: p.nombre, concentracion: p.concentracion,
    presentacion: p.presentacion, laboratorio: p.laboratorio,
    precioVenta: Number(p.precioVenta), requiereRx: p.requiereRx,
    principioActivo: p.principioActivo, slug: p.slug,
    indicaciones: p.indicaciones,
    stockTotal: p.lotes.reduce((s: number, l: any) => s + l.cantidadActual, 0),
    tieneStock: p.lotes.some((l: any) => l.cantidadActual > 0),
  }))
}

// ── Formatear resultados de búsqueda ──────────────────────
function formatearResultadosBusqueda(productos: Awaited<ReturnType<typeof buscarProductos>>): string {
  if (productos.length === 0) {
    return `❌ No encontré productos con ese nombre.

💡 Sugerencias:
• Verifica la ortografía del medicamento
• Busca por el principio activo (ej: "acetaminofén" en vez de "Dolex")
• Prueba con el nombre genérico

¿Qué deseas hacer?
[1] Intentar otra búsqueda
[2] Ver alternativas
[3] Volver al menú principal`
  }

  let respuesta = `🔍 **Resultados de búsqueda:**\n\n`

  for (const p of productos) {
    const stockIcono = p.tieneStock ? '✅' : '❌'
    const rxIcono = p.requiereRx ? '⚠️ RX' : '💊 Venta libre'
    respuesta +=
      `**${p.nombre}${p.concentracion ? ' ' + p.concentracion : ''}**\n` +
      `   ${stockIcono} ${formatearPesos(p.precioVenta)} · ${p.laboratorio ?? 'G.L. S.A.S.'} · ${rxIcono}\n`
    if (p.indicaciones) {
      const indicacion = p.indicaciones.length > 100 ? p.indicaciones.substring(0, 100) + '...' : p.indicaciones
      respuesta += `   📋 ${indicacion}\n`
    }
    respuesta += '\n'
  }

  respuesta += `📌 Para más detalles sobre un producto, responde con su nombre exacto o escribe [6] en el menú.\n\n`
  respuesta += `[1] 🔍 Nueva búsqueda     [3] Volver al menú`

  return respuesta
}

// ── Formatear resultado detallado INVIMA ─────────────────
function formatearDetalleProducto(p: Awaited<ReturnType<typeof buscarProductos>>[0]): string {
  return [
    `📋 **${p.nombre}${p.concentracion ? ' ' + p.concentracion : ''}**`,
    ``,
    `💲 Precio: ${formatearPesos(p.precioVenta)}`,
    `🏭 Laboratorio: ${p.laboratorio ?? 'No especificado'}`,
    `🧪 Principio activo: ${p.principioActivo ?? 'N/A'}`,
    `📦 Presentación: ${p.presentacion ?? 'No especificada'}`,
    `${p.requiereRx ? '⚠️ Requiere fórmula médica' : '✅ Venta libre'}`,
    `${p.tieneStock ? `✅ Stock disponible: ${p.stockTotal} unidades` : '❌ Agotado'}`,
    ``,
    `¿Necesitas información más específica?`,
    `[1] Alternativas similares    [3] Volver al menú`,
  ].join('\n')
}

// ── Responder con menú + acciones ─────────────────────────
function responderConMenu(
  res: Response, texto: string, productos: any[] = [],
  alertas: any[] = [], estadoSesion?: string
) {
  return responder.ok(res, {
    respuesta: texto,
    productos: productos.map((p: any) => ({
      id: p.id, nombre: p.nombre, concentracion: p.concentracion,
      presentacion: p.presentacion, laboratorio: p.laboratorio,
      precioVenta: p.precioVenta, requiereRx: p.requiereRx,
      principioActivo: p.principioActivo,
      stockTotal: p.stockTotal, slug: p.slug,
    })),
    alertas: alertas.map(a => ({
      tipo: a.tipo, productoA: a.productoA, productoB: a.productoB,
      descripcion: a.descripcion, severidad: a.severidad,
    })),
    alertasVisibles: alertas.length > 0,
    menuActivo: estadoSesion ?? 'menu',
  })
}

// ── Procesar búsqueda de productos ───────────────────────
async function procesarBusqueda(mensaje: string): Promise<{
  respuesta: string; productos: any[]; alertas: any[]
}> {
  const productos = await buscarProductos(mensaje)
  if (productos.length === 0) {
    return {
      respuesta: `❌ No encontré "${mensaje}" en nuestro inventario.

💡 Consejos:
• Revisa la ortografía
• Busca por principio activo (ej: "acetaminofén")
• Pregunta por alternativas similares

[1] Intentar otra búsqueda    [3] Menú principal`,
      productos: [],
      alertas: [],
    }
  }

  // Si hay 1 solo producto, mostrar detalle completo
  if (productos.length === 1) {
    const p = productos[0]
    let respuesta = formatearDetalleProducto(p)
    return { respuesta, productos, alertas: [] }
  }

  const respuesta = formatearResultadosBusqueda(productos)
  return { respuesta, productos, alertas: [] }
}

// ── Procesar verificación de interacciones ────────────────
async function procesarInteracciones(mensaje: string, sesion: SesionData): Promise<{
  respuesta: string; productos: any[]; alertas: any[]
}> {
  // Buscar productos que coincidan
  const encontrados = await buscarProductos(mensaje)
  const ids = encontrados.map(p => p.id)
  const todosIds = [...new Set([...sesion.productosConsultados, ...ids])]

  if (todosIds.length < 2) {
    return {
      respuesta: `Para verificar interacciones necesito al menos dos medicamentos.

Puedes escribir algo como:
• "ibuprofeno y acetaminofén"
• "Losartán, metformina, omeprazol"
• "Verifica interacciones de mis medicamentos"

[1] Volver a intentar    [3] Menú principal`,
      productos: encontrados,
      alertas: [],
    }
  }

  const resultado = await verificarInteracciones(todosIds)

  if (!resultado.tieneAlertas) {
    return {
      respuesta: `✅ No se encontraron interacciones documentadas entre los medicamentos consultados.

Recuerda que esta información es orientativa. Siempre consulta con tu médico o farmacéutico de confianza.

[3] Volver al menú principal`,
      productos: encontrados,
      alertas: [],
    }
  }

  // Formatear alertas
  let respuesta = `⚠️ **Alertas de interacciones detectadas:**\n\n`
  for (const a of resultado.alertas) {
    const icono = a.severidad === 'ALTA' ? '🔴' : a.severidad === 'MEDIA' ? '🟡' : '🔵'
    const sevLabel = a.severidad === 'ALTA' ? 'ALTA PRIORIDAD' : a.severidad === 'MEDIA' ? 'Precaución' : 'Informativo'
    respuesta += `${icono} [${sevLabel}] ${a.descripcion}\n\n`
  }
  respuesta += `⚕️ *Consulta siempre con un profesional de la salud antes de tomar cualquier decisión.*

[3] Volver al menú`

  return { respuesta, productos: encontrados, alertas: resultado.alertas }
}

// ── Procesar alternativas (mismo principio activo o ATC) ─
async function procesarAlternativas(mensaje: string): Promise<{
  respuesta: string; productos: any[]
}> {
  const productos = await buscarProductos(mensaje)
  if (productos.length === 0) {
    return {
      respuesta: `Dime el nombre del medicamento para buscar alternativas similares.

Ejemplos: "alternativas para ibuprofeno", "genéricos de omeprazol"

[3] Volver al menú principal`,
      productos: [],
    }
  }

  // Si encontró varios, pedir especificar uno
  if (productos.length > 1) {
    const lista = productos.map((p: any, i: number) =>
      `[${i + 1}] ${p.nombre}${p.concentracion ? ' ' + p.concentracion : ''}`
    ).join('\n')

    return {
      respuesta: `Encontré varios productos. ¿Para cuál deseas alternativas?\n\n${lista}\n\nResponde con el número o nombre exacto.\n\n[3] Volver al menú`,
      productos,
    }
  }

  // Buscar alternativas por principio activo
  const p = productos[0]
  const similares = await recomendarSimilares(p.id, 5)

  if (similares.length === 0) {
    return {
      respuesta: `No encontré alternativas similares para "${p.nombre}" en nuestro inventario actual.

💡 Puedes consultar con tu médico sobre opciones genéricas.

[3] Volver al menú principal`,
      productos: [p],
    }
  }

  let respuesta = `💊 **Alternativas para ${p.nombre}**\n\n`
  respuesta += similares.map(s =>
    `• **${s.nombre}${s.concentracion ? ' ' + s.concentracion : ''}** — ${formatearPesos(Number(s.precioVenta))} (${s.laboratorio ?? 'G.L. S.A.S.'})`
  ).join('\n')

  respuesta += `\n\n¿Te interesa alguna? Escribe su nombre para ver detalles.\n\n[3] Volver al menú`

  return { respuesta, productos: [p, ...similares] }
}

// ── Procesar información detallada ────────────────────────
async function procesarInfoDetallada(mensaje: string): Promise<{
  respuesta: string; productos: any[]
}> {
  const productos = await buscarProductos(mensaje)
  if (productos.length === 0) {
    return {
      respuesta: `¿De qué producto necesitas información detallada?

Puedo mostrarte:
• Indicaciones y modo de uso
• Contraindicaciones
• Reacciones adversas
• Interacciones medicamentosas
• Alérgenos y excipientes
• Registro INVIMA

[3] Volver al menú principal`,
      productos: [],
    }
  }

  if (productos.length > 1) {
    const lista = productos.map((p: any, i: number) =>
      `[${i + 1}] ${p.nombre}${p.concentracion ? ' ' + p.concentracion : ''}`
    ).join('\n')
    return {
      respuesta: `Varios productos coinciden. ¿Cuál te interesa?\n\n${lista}\n\n[3] Volver al menú`,
      productos,
    }
  }

  // Obtener detalle completo de la BD
  const detalle = await prisma.producto.findUnique({
    where: { id: productos[0].id },
    select: {
      nombre: true, concentracion: true, presentacion: true,
      laboratorio: true, precioVenta: true, requiereRx: true,
      principioActivo: true, atc: true, descripcionAtc: true,
      formaFarmaceutica: true, viaAdministracion: true,
      indicaciones: true, contraindicaciones: true,
      reaccionesAdversas: true, interacciones: true, modoUso: true,
      alergenos: true, advertencias: true,
      registroInvima: true, cum: true, estadoCum: true,
      titular: true,
    },
  })

  if (!detalle) {
    return {
      respuesta: `No pude obtener información detallada para este producto. Intenta de nuevo más tarde.\n\n[3] Volver al menú`,
      productos,
    }
  }

  const campos = [
    ['💊 Nombre', `${detalle.nombre}${detalle.concentracion ? ' ' + detalle.concentracion : ''}`],
    ['📦 Presentación', detalle.presentacion],
    ['🏭 Laboratorio', detalle.laboratorio ?? detalle.titular ?? 'N/E'],
    ['🧪 Principio activo', detalle.principioActivo],
    ['🔬 Código ATC', detalle.atc ? `${detalle.atc} - ${detalle.descripcionAtc ?? ''}` : 'N/E'],
    ['💲 Precio', formatearPesos(Number(detalle.precioVenta))],
    ['📋 Indicaciones', detalle.indicaciones],
    ['💊 Modo de uso', detalle.modoUso],
    ['⚠️ Contraindicaciones', detalle.contraindicaciones],
    ['⚡ Reacciones adversas', detalle.reaccionesAdversas],
    ['🔗 Interacciones', detalle.interacciones],
    ['🥜 Alérgenos/excipientes', detalle.alergenos],
    ['📢 Advertencias', detalle.advertencias],
    ['📜 Registro INVIMA', detalle.registroInvima],
    ['🔑 CUM', detalle.cum],
    ['📊 Estado CUM', detalle.estadoCum],
    [detalle.requiereRx ? '⚠️ Requiere fórmula médica' : '✅ Venta libre', ''],
  ]

  let respuesta = `📋 **Ficha completa — ${detalle.nombre}**\n\n`
  for (const [label, valor] of campos) {
    if (valor) {
      respuesta += `**${label}:** ${valor}\n`
    }
  }

  respuesta += `\n[1] Alternativas    [3] Volver al menú`

  return { respuesta, productos }
}

// ── Manejar selección de menú ────────────────────────────
async function manejarMenu(message: string, sesion: SesionData): Promise<{
  respuesta: string; productos: any[]; alertas: any[]; nuevoEstado: EstadoMenu
}> {
  const msg = message.trim().toLowerCase()
  const opcion = parseInt(message.trim())

  // Opción principal por número
  switch (opcion) {
    case 1:
      return {
        respuesta: `🔍 **Buscar medicamentos**

Escribe el nombre del medicamento que buscas.
Puedes buscar por:
• Nombre comercial (ej: "Dolex", "Ibuprofeno MK")
• Principio activo (ej: "acetaminofén")
• Laboratorio (ej: "Tecnoquímicas")

O escribe "atrás" para volver al menú.`,
        productos: [],
        alertas: [],
        nuevoEstado: 'buscar',
      }

    case 2:
      return {
        respuesta: `⚠️ **Verificar interacciones medicamentosas**

Dime los medicamentos que estás tomando o planeas tomar.
Puedes separarlos con comas.

Ejemplo: "Losartán, metformina, omeprazol"
O simplemente: "ibuprofeno y acetaminofén"

O escribe "atrás" para volver al menú.`,
        productos: [],
        alertas: [],
        nuevoEstado: 'interacciones',
      }

    case 3:
      return {
        respuesta: INFO_SEDES + `\n\n[3] Volver al menú`,
        productos: [],
        alertas: [],
        nuevoEstado: 'menu',
      }

    case 4:
      return {
        respuesta: INFO_DOMICILIOS + `\n\n[3] Volver al menú`,
        productos: [],
        alertas: [],
        nuevoEstado: 'menu',
      }

    case 5:
      return {
        respuesta: `💊 **Alternativas y genéricos**

Dime el nombre del medicamento para buscar opciones similares.

Puedo encontrar alternativas con el mismo principio activo o de la misma familia terapéutica.

Ejemplo: "alternativas para ibuprofeno"
O simplemente el nombre: "atorvastatina"

O escribe "atrás" para volver al menú.`,
        productos: [],
        alertas: [],
        nuevoEstado: 'alternativas',
      }

    case 6:
      return {
        respuesta: `📋 **Información detallada de producto**

Dime el nombre del medicamento para mostrarte su ficha completa:
• Indicaciones y modo de uso
• Contraindicaciones y advertencias
• Reacciones adversas
• Interacciones y alérgenos
• Registro INVIMA y datos regulatorios

Ejemplo: "información del ibuprofeno"
O simplemente: "omeprazol"

O escribe "atrás" para volver al menú.`,
        productos: [],
        alertas: [],
        nuevoEstado: 'info',
      }

    case 7:
      return {
        respuesta: SUBMENU_FAQ,
        productos: [],
        alertas: [],
        nuevoEstado: 'faq',
      }

    case 8:
      return {
        respuesta: `💬 **Hablar con un asesor humano**

Actualmente nuestra atención humana está disponible en horario laboral.
Puedes contactarnos por:

📞 Teléfono: (606) 333 33 33
📱 WhatsApp: 310 123 45 67
🏪 Visítanos en carrera 8 #22-45, Pereira

¿Necesitas algo más mientras tanto?

[3] Volver al menú principal`,
        productos: [],
        alertas: [],
        nuevoEstado: 'menu',
      }

    default:
      break
  }

  // Si no es número, detectar intención por palabras clave
  if (msg.includes('buscar') || msg.includes('busc') || msg.includes('encuentra') || msg.includes('tienen') || msg.includes('hay ') || msg.includes('consulta')) {
    return manejarMenu('1', sesion)
  }
  if (msg.includes('interacci') || msg.includes('interact') || msg.includes('mezclar') || msg.includes('combinar') || msg.includes('alergia') || msg.includes('contraindic')) {
    return manejarMenu('2', sesion)
  }
  if (msg.includes('horario') || msg.includes('sede') || msg.includes('sucursal') || msg.includes('direccion') || msg.includes('ubicacion') || msg.includes('abierto') || msg.includes('donde')) {
    return {
      respuesta: INFO_SEDES + `\n\n[3] Volver al menú`,
      productos: [], alertas: [], nuevoEstado: 'menu',
    }
  }
  if (msg.includes('domicilio') || msg.includes('envio') || msg.includes('delivery') || msg.includes('despacho') || msg.includes('entregar')) {
    return {
      respuesta: INFO_DOMICILIOS + `\n\n[3] Volver al menú`,
      productos: [], alertas: [], nuevoEstado: 'menu',
    }
  }
  if (msg.includes('alternativa') || msg.includes('similar') || msg.includes('generico') || msg.includes('reemplazo') || msg.includes('parecido') || msg.includes('otra opcion')) {
    return manejarMenu('5', sesion)
  }
  if (msg.includes('informacion') || msg.includes('detalle') || msg.includes('indicacion') || msg.includes('ficha') || msg.includes('composicion') || msg.includes('componente')) {
    return manejarMenu('6', sesion)
  }
  if (msg.includes('pregunta') || msg.includes('faq') || msg.includes('duda') || msg.includes('frecuente') || msg.includes('como ') || msg.includes('que ') || msg.includes('cuanto ') || msg.includes('aceptan ')) {
    return manejarMenu('7', sesion)
  }
  if (msg.includes('asesor') || msg.includes('humano') || msg.includes('persona') || msg.includes('hablar ') || msg.includes('ayuda') || msg.includes('atencion humana')) {
    return manejarMenu('8', sesion)
  }
  if (msg.includes('hola') || msg.includes('buenas') || msg.includes('menu') || msg.includes('inicio') || msg.includes('atras') || msg.includes('volver') || msg === '0') {
    return {
      respuesta: MENU_PRINCIPAL,
      productos: [], alertas: [], nuevoEstado: 'menu',
    }
  }

  // Búsqueda directa (detectar si parece nombre de medicamento)
  if (msg.length >= 3) {
    const productos = await buscarProductos(message)
    if (productos.length > 0) {
      return {
        respuesta: formatearResultadosBusqueda(productos),
        productos,
        alertas: [],
        nuevoEstado: 'buscar',
      }
    }
  }

  return {
    respuesta: `No entendí tu selección. Por favor elige una opción del menú:\n\n${MENU_PRINCIPAL}`,
    productos: [], alertas: [], nuevoEstado: 'menu',
  }
}

// ── Manejar estado 'buscar' ───────────────────────────────
async function manejarBusqueda(message: string, sesion: SesionData): Promise<{
  respuesta: string; productos: any[]; alertas: any[]; nuevoEstado: EstadoMenu
}> {
  const msg = message.trim().toLowerCase()

  if (msg === 'atrás' || msg === 'atras' || msg === '3' || msg === 'volver' || msg === 'menu') {
    return { respuesta: MENU_PRINCIPAL, productos: [], alertas: [], nuevoEstado: 'menu' }
  }
  if (msg === '1') {
    return { respuesta: `🔍 Escribe el nombre del medicamento que buscas:`, productos: [], alertas: [], nuevoEstado: 'buscar' }
  }
  if (msg === '2') {
    return await manejarMenu('5', sesion) as any
  }

  const result = await procesarBusqueda(message)
  return { ...result, nuevoEstado: 'buscar' }
}

// ── Manejar estado 'interacciones' ────────────────────────
async function manejarInteracciones(message: string, _sesion: SesionData): Promise<{
  respuesta: string; productos: any[]; alertas: any[]; nuevoEstado: EstadoMenu
}> {
  const msg = message.trim().toLowerCase()

  if (msg === 'atrás' || msg === 'atras' || msg === '3' || msg === 'volver' || msg === 'menu') {
    return { respuesta: MENU_PRINCIPAL, productos: [], alertas: [], nuevoEstado: 'menu' }
  }

  const result = await procesarInteracciones(message, _sesion)
  return { ...result, nuevoEstado: 'interacciones' }
}

// ── Manejar estado 'alternativas' ─────────────────────────
async function manejarAlternativas(message: string, _sesion: SesionData): Promise<{
  respuesta: string; productos: any[]; alertas: any[]; nuevoEstado: EstadoMenu
}> {
  const msg = message.trim().toLowerCase()

  if (msg === 'atrás' || msg === 'atras' || msg === '3' || msg === 'volver' || msg === 'menu') {
    return { respuesta: MENU_PRINCIPAL, productos: [], alertas: [], nuevoEstado: 'menu' }
  }

  const result = await procesarAlternativas(message)
  return { ...result, alertas: [], nuevoEstado: 'alternativas' }
}

// ── Manejar estado 'info' ─────────────────────────────────
async function manejarInfo(message: string, _sesion: SesionData): Promise<{
  respuesta: string; productos: any[]; alertas: any[]; nuevoEstado: EstadoMenu
}> {
  const msg = message.trim().toLowerCase()

  if (msg === 'atrás' || msg === 'atras' || msg === '3' || msg === 'volver' || msg === 'menu') {
    return { respuesta: MENU_PRINCIPAL, productos: [], alertas: [], nuevoEstado: 'menu' }
  }

  const result = await procesarInfoDetallada(message)
  return { ...result, alertas: [], nuevoEstado: 'info' }
}

// ── Manejar estado 'faq' ──────────────────────────────────
async function manejarFAQ(message: string, _sesion: SesionData): Promise<{
  respuesta: string; productos: any[]; alertas: any[]; nuevoEstado: EstadoMenu
}> {
  const msg = message.trim().toLowerCase()
  const opcion = parseInt(message.trim())

  if (msg === 'atrás' || msg === 'atras' || msg === '3' || msg === 'volver' || msg === 'menu' || opcion === 7) {
    return { respuesta: MENU_PRINCIPAL, productos: [], alertas: [], nuevoEstado: 'menu' }
  }

  const respuesta = FAQ_RESPUESTAS[String(opcion)]
  if (respuesta) {
    if (respuesta === 'VOLVER_MENU') {
      return { respuesta: MENU_PRINCIPAL, productos: [], alertas: [], nuevoEstado: 'menu' }
    }
    return {
      respuesta: respuesta + `\n\n[7] Volver al menú`,
      productos: [], alertas: [], nuevoEstado: 'faq',
    }
  }

  // Si no es número, buscar si la pregunta coincide con alguna FAQ
  const faqKeys = Object.keys(FAQ_RESPUESTAS)
  for (const key of faqKeys) {
    const texto = FAQ_RESPUESTAS[key]
    if (texto === 'VOLVER_MENU') continue
    // Simple match por palabras clave
    if (
      (key === '1' && (msg.includes('electrónica') || msg.includes('electronica') || msg.includes('digital') || msg.includes('receta en linea'))) ||
      (key === '2' && (msg.includes('sin receta') || msg.includes('sin formula') || msg.includes('comprar') || msg.includes('necesito receta'))) ||
      (key === '3' && (msg.includes('como sé') || msg.includes('saber si') || msg.includes('requiere') || msg.includes('rx'))) ||
      (key === '4' && (msg.includes('tarjeta') || msg.includes('pago') || msg.includes('credito') || msg.includes('nequi') || msg.includes('transferencia'))) ||
      (key === '5' && (msg.includes('tardan') || msg.includes('tiempo') || msg.includes('demora') || msg.includes('cuanto'))) ||
      (key === '6' && (msg.includes('otra ciudad') || msg.includes('envio') || msg.includes('fuera') || msg.includes('otro municipio')))
    ) {
      return {
        respuesta: texto + `\n\n[7] Volver al menú`,
        productos: [], alertas: [], nuevoEstado: 'faq',
      }
    }
  }

  return {
    respuesta: `No encontré respuesta para esa pregunta. Elige una opción:\n\n${SUBMENU_FAQ}`,
    productos: [], alertas: [], nuevoEstado: 'faq',
  }
}

// ── Procesador principal de mensajes ──────────────────────
export async function procesarMensaje(
  mensaje: string, sessionToken: string
): Promise<{
  respuesta: string; productos: any[]; alertas: any[];
  nuevoEstado: EstadoMenu
}> {
  const sesion = await obtenerSesion(sessionToken)
  const msg = mensaje.trim()

  // Actualizar último mensaje
  sesion.ultimoMensaje = msg
  sesion.mensajes.push({ role: 'user', text: msg, timestamp: new Date().toISOString() })

  let resultado: {
    respuesta: string; productos: any[]; alertas: any[]; nuevoEstado: EstadoMenu
  }

  switch (sesion.estado) {
    case 'buscar':
      resultado = await manejarBusqueda(msg, sesion)
      break
    case 'interacciones':
      resultado = await manejarInteracciones(msg, sesion)
      break
    case 'alternativas':
      resultado = await manejarAlternativas(msg, sesion)
      break
    case 'info':
      resultado = await manejarInfo(msg, sesion)
      break
    case 'faq':
      resultado = await manejarFAQ(msg, sesion)
      break
    default:
      resultado = await manejarMenu(msg, sesion)
      break
  }

  // Actualizar sesión
  sesion.estado = resultado.nuevoEstado
  if (resultado.productos.length > 0) {
    for (const p of resultado.productos) {
      if (p.id && !sesion.productosConsultados.includes(p.id)) {
        sesion.productosConsultados.push(p.id)
      }
    }
  }

  sesion.mensajes.push({ role: 'bot', text: resultado.respuesta, timestamp: new Date().toISOString() })
  await guardarSesion(sessionToken, sesion)

  return resultado
}

// ── GET /horario ──────────────────────────────────────────
chatbotRouter.get('/horario', (_req: Request, res: Response) => {
  const tz = env.HORARIO_TIMEZONE
  const diasConf = env.HORARIO_DIAS.split(',').map(Number)
  const [hIni, mIni] = env.HORARIO_INICIO.split(':').map(Number)
  const [hFin, mFin] = env.HORARIO_FIN.split(':').map(Number)

  const ahora = new Date()
  const enBogota = new Date(ahora.toLocaleString('en-US', { timeZone: tz }))
  const diaSemana = enBogota.getDay() === 0 ? 7 : enBogota.getDay()
  const minutosDia = enBogota.getHours() * 60 + enBogota.getMinutes()
  const minInicio = hIni * 60 + mIni
  const minFin = hFin * 60 + mFin

  const disponible = diasConf.includes(diaSemana) && minutosDia >= minInicio && minutosDia < minFin

  return responder.ok(res, {
    disponible,
    mensaje: disponible
      ? 'Un asesor está disponible ahora'
      : `Atención humana disponible de Lun-Vie ${env.HORARIO_INICIO} a ${env.HORARIO_FIN}`,
  })
})

// ── POST /interacciones ───────────────────────────────────
chatbotRouter.post('/interacciones', validarCuerpo(interaccionesSchema), async (req: Request, res: Response) => {
  const { productoIds, alergenosCliente } = req.body as z.infer<typeof interaccionesSchema>
  // Los alérgenos del perfil de salud ahora se verifican contra los productos
  // Sanitizar productoIds (defense-in-depth: asegurar formato UUID)
  const idsLimpios = productoIds
    .map((id: string) => id.replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 36))
    .filter((id: string) => id.length > 0)
  if (idsLimpios.length < 2) {
    return responder.error(res, 'Se requieren al menos dos productos para verificar interacciones')
  }
  try {
    const resultado = await verificarInteracciones(idsLimpios, alergenosCliente)
    return responder.ok(res, {
      alertas: resultado.alertas,
      tieneAlertas: resultado.tieneAlertas,
    })
  } catch (err) {
    logger.error('[Chatbot] Error verificando interacciones:', err)
    return responder.serverError(res, err)
  }
})

// ── GET /producto/:id ─────────────────────────────────────
chatbotRouter.get('/producto/:id', async (req: Request, res: Response) => {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, nombre: true, concentracion: true, presentacion: true,
        laboratorio: true, precioVenta: true, requiereRx: true,
        principioActivo: true, atc: true, descripcionAtc: true,
        formaFarmaceutica: true, viaAdministracion: true,
        indicaciones: true, contraindicaciones: true,
        reaccionesAdversas: true, interacciones: true, modoUso: true,
        alergenos: true, advertencias: true,
        registroInvima: true, cum: true, estadoCum: true,
        titular: true, slug: true,
        lotes: {
          where: { cantidadActual: { gt: 0 }, fechaVencimiento: { gt: new Date() } },
          select: { cantidadActual: true },
        },
      },
    })
    if (!producto) return responder.noEncontrado(res, 'Producto')

    const stockTotal = producto.lotes.reduce((s, l) => s + l.cantidadActual, 0)

    return responder.ok(res, {
      ...producto,
      precioVenta: Number(producto.precioVenta),
      stockTotal,
    })
  } catch (err) {
    logger.error('[Chatbot] Error obteniendo detalle:', err)
    return responder.serverError(res, err)
  }
})

// ── POST / — Mensaje principal ──────────────────────────
chatbotRouter.post('/', validarCuerpo(mensajeChatbotSchema), async (req: Request, res: Response) => {
  const { mensaje, sessionToken } = req.body as z.infer<typeof mensajeChatbotSchema>
  // Sanitizar entrada del usuario (defense-in-depth: incluso con Zod, sanitizar)
  const msg = sanitizarInput(mensaje, MAX_MENSAJE_LENGTH)
  if (!msg) return responder.error(res, 'Mensaje vacío')

  const token = sessionToken
    ? sanitizarSessionToken(sessionToken)
    : `session-${Date.now()}`
  if (!token) return responder.error(res, 'Token de sesión inválido')

  try {
    const resultado = await procesarMensaje(msg, token)
    return responderConMenu(res, resultado.respuesta, resultado.productos, resultado.alertas, resultado.nuevoEstado)
  } catch (err) {
    logger.error('[Chatbot] Error:', err)
    return responder.ok(res, {
      respuesta: `Tuve un problema al procesar tu mensaje. Por favor intenta de nuevo.\n\n${MENU_PRINCIPAL}`,
      productos: [],
      alertas: [],
      menuActivo: 'menu',
    })
  }
})
