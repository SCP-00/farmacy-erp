// ══════════════════════════════════════════════════════════
//  interacciones.service.ts
//  Alertas de interacciones medicamentosas y excipientes
//  alérgenos usando los campos INVIMA de la BD.
// ══════════════════════════════════════════════════════════

import { prisma } from '../config/database'
import { logger } from '../utils/logger'

export interface AlertaInteraccion {
  tipo: 'INTERACCION_MEDICAMENTOSA' | 'ALERGENO' | 'CONTRAINDICACION' | 'REACCION'
  productoA: string
  productoB?: string
  descripcion: string
  severidad: 'ALTA' | 'MEDIA' | 'BAJA' | 'INFO'
}

export interface ResultadoVerificacion {
  tieneAlertas: boolean
  alertas: AlertaInteraccion[]
}

// ── Verificar interacciones entre múltiples productos ────
export async function verificarInteracciones(
  productoIds: string[],
  alergenosCliente?: string[]
): Promise<ResultadoVerificacion> {
  if (productoIds.length < 2) return { tieneAlertas: false, alertas: [] }

  const alertas: AlertaInteraccion[] = []
  const yaVistos = new Set<string>()

  try {
    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: {
        id: true, nombre: true, principioActivo: true,
        interacciones: true, contraindicaciones: true,
        reaccionesAdversas: true, alergenos: true,
      },
    })

    // Revisar cada par de productos
    for (let i = 0; i < productos.length; i++) {
      for (let j = i + 1; j < productos.length; j++) {
        const a = productos[i]
        const b = productos[j]
        const parClave = [a.id, b.id].sort().join('|')
        if (yaVistos.has(parClave)) continue
        yaVistos.add(parClave)

        const interaccionesA = (a.interacciones ?? '').toLowerCase()
        const interaccionesB = (b.interacciones ?? '').toLowerCase()
        const nombreB = b.nombre.toLowerCase()
        const nombreA = a.nombre.toLowerCase()
        const activoB = (b.principioActivo ?? '').toLowerCase()
        const activoA = (a.principioActivo ?? '').toLowerCase()

        // ¿A menciona a B o su principio activo?
        if (
          interaccionesA.includes(nombreB) ||
          interaccionesA.includes(activoB)
        ) {
          alertas.push({
            tipo: 'INTERACCION_MEDICAMENTOSA',
            productoA: a.nombre,
            productoB: b.nombre,
            descripcion: `${a.nombre} presenta interacción documentada con ${b.nombre}. ${a.interacciones ?? ''}`,
            severidad: 'ALTA',
          })
        }

        if (
          interaccionesB.includes(nombreA) ||
          interaccionesB.includes(activoA)
        ) {
          alertas.push({
            tipo: 'INTERACCION_MEDICAMENTOSA',
            productoA: b.nombre,
            productoB: a.nombre,
            descripcion: `${b.nombre} presenta interacción documentada con ${a.nombre}. ${b.interacciones ?? ''}`,
            severidad: 'ALTA',
          })
        }

        // Contraindicaciones cruzadas
        const contraA = (a.contraindicaciones ?? '').toLowerCase()
        const contraB = (b.contraindicaciones ?? '').toLowerCase()
        if (contraA.includes(activoB) || contraA.includes(nombreB)) {
          alertas.push({
            tipo: 'CONTRAINDICACION',
            productoA: a.nombre,
            productoB: b.nombre,
            descripcion: `${a.nombre} está contraindicado si se usa junto con ${b.nombre}.`,
            severidad: 'MEDIA',
          })
        }
        if (contraB.includes(activoA) || contraB.includes(nombreA)) {
          alertas.push({
            tipo: 'CONTRAINDICACION',
            productoA: b.nombre,
            productoB: a.nombre,
            descripcion: `${b.nombre} está contraindicado si se usa junto con ${a.nombre}.`,
            severidad: 'MEDIA',
          })
        }
      }
    }

    // Reacciones adversas relevantes por producto individual
    for (const p of productos) {
      if (p.reaccionesAdversas) {
        alertas.push({
          tipo: 'REACCION',
          productoA: p.nombre,
          descripcion: `${p.nombre}: ${p.reaccionesAdversas}`,
          severidad: 'INFO',
        })
      }
    }

    // Alérgenos del perfil de salud del cliente vs composición de cada producto
    // (usa verificarAlergenos: misma lógica, campo alergenos ya incluido en el select)
    if (alergenosCliente?.length) {
      for (const p of productos) {
        const resAlergeno = await verificarAlergenos(p.id, alergenosCliente)
        alertas.push(...resAlergeno.alertas)
      }
    }

    return { tieneAlertas: alertas.length > 0, alertas }

  } catch (err) {
    logger.error('[Interacciones] Error al verificar interacciones:', err)
    return { tieneAlertas: false, alertas: [] }
  }
}

// ── Verificar alérgenos de un producto contra lista del usuario ──
export async function verificarAlergenos(
  productoId: string,
  alergenosCliente: string[]
): Promise<ResultadoVerificacion> {
  if (!alergenosCliente.length) return { tieneAlertas: false, alertas: [] }

  const alertas: AlertaInteraccion[] = []

  try {
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true, nombre: true, alergenos: true },
    })

    if (!producto?.alergenos) return { tieneAlertas: false, alertas: [] }

    const alergenosProducto = producto.alergenos.toLowerCase()
    const alergiasUsuario = alergenosCliente.map(a => a.toLowerCase().trim())

    for (const alergia of alergiasUsuario) {
      if (alergenosProducto.includes(alergia)) {
        alertas.push({
          tipo: 'ALERGENO',
          productoA: producto.nombre,
          descripcion: `⚠️ ${producto.nombre} contiene **${alergia}** (en su composición: "${producto.alergenos}"). Consulta con tu médico antes de usarlo.`,
          severidad: 'ALTA',
        })
      }
    }

    return { tieneAlertas: alertas.length > 0, alertas }

  } catch (err) {
    logger.error('[Interacciones] Error al verificar alérgenos:', err)
    return { tieneAlertas: false, alertas: [] }
  }
}

// ── Obtener principios activos de productos en sesión ────
export async function obtenerPrincipiosActivos(
  productoIds: string[]
): Promise<{ id: string; nombre: string; principioActivo: string; atc: string | null }[]> {
  if (!productoIds.length) return []
  try {
    return await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, nombre: true, principioActivo: true, atc: true },
    })
  } catch {
    return []
  }
}

// ── Recomendaciones cruzadas: productos del mismo ATC ────
export async function recomendarSimilares(
  productoId: string,
  limite = 3
): Promise<{ id: string; nombre: string; concentracion: string | null; laboratorio: string | null; precioVenta: number }[]> {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { atc: true, principioActivo: true, categoriaId: true },
    })
    if (!producto?.atc && !producto?.principioActivo) return []

    const where: any = {
      id: { not: productoId },
      activo: true,
      esMuestraMedica: false,
      OR: [
        ...(producto.atc ? [{ atc: producto.atc }] : []),
        ...(producto.principioActivo ? [{ principioActivo: { contains: producto.principioActivo, mode: 'insensitive' as const } }] : []),
      ],
    }

    const similares = await prisma.producto.findMany({
      where,
      take: limite,
      select: {
        id: true, nombre: true, concentracion: true,
        laboratorio: true, precioVenta: true,
      },
      orderBy: { nombre: 'asc' },
    })

    return similares.map((p: any) => ({
      ...p,
      precioVenta: Number(p.precioVenta),
    }))

  } catch (err) {
    logger.error('[Interacciones] Error al recomendar similares:', err)
    return []
  }
}
