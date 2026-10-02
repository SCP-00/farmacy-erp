// ══════════════════════════════════════════════════════════
//  respaldo.utils.ts — Frescura del último respaldo
//
//  Lee el estado que escribe database/scripts/verificar-backup.sh
//  en config_param (clave BACKUP_ULTIMO_OK) y decide si el respaldo
//  está vencido o falló. Función PURA para poder testearla.
// ══════════════════════════════════════════════════════════

export interface EstadoRespaldo {
  /** La última verificación terminó bien. */
  ok: boolean
  /** El respaldo está ausente, falló o es más viejo que el límite. */
  vencido: boolean
  /** Horas transcurridas desde la última verificación (null si no hay fecha). */
  horasDesde: number | null
  /** Fecha ISO de la última verificación. */
  fecha: string | null
  /** Motivo legible cuando hay problema. */
  motivo?: string
}

const MAX_HORAS_DEFECTO = 26

/**
 * Evalúa el estado del respaldo.
 * @param valorCrudo  JSON de config_param BACKUP_ULTIMO_OK (o null).
 * @param maxHoras    Antigüedad máxima aceptable (por defecto 26 h).
 * @param ahora       Inyectable para tests.
 */
export function evaluarRespaldo(
  valorCrudo: string | null | undefined,
  maxHoras: number = MAX_HORAS_DEFECTO,
  ahora: Date = new Date(),
): EstadoRespaldo {
  const limite = Number.isFinite(maxHoras) && maxHoras > 0 ? maxHoras : MAX_HORAS_DEFECTO

  if (!valorCrudo) {
    return { ok: false, vencido: true, horasDesde: null, fecha: null, motivo: 'Sin registro de verificación de respaldo' }
  }

  let datos: { ok?: boolean; fecha?: string } | null = null
  try {
    datos = JSON.parse(valorCrudo)
  } catch {
    return { ok: false, vencido: true, horasDesde: null, fecha: null, motivo: 'Registro de respaldo ilegible' }
  }

  const fecha = typeof datos?.fecha === 'string' ? datos.fecha : null
  let horasDesde: number | null = null
  if (fecha) {
    const t = Date.parse(fecha)
    if (!Number.isNaN(t)) {
      horasDesde = Math.max(0, Math.round(((ahora.getTime() - t) / 3_600_000) * 10) / 10)
    }
  }

  const ok = datos?.ok === true
  let vencido = false
  let motivo: string | undefined

  if (!ok) {
    vencido = true
    motivo = 'La última verificación de respaldo FALLÓ'
  } else if (horasDesde === null) {
    vencido = true
    motivo = 'El respaldo no tiene una fecha válida'
  } else if (horasDesde > limite) {
    vencido = true
    motivo = `El último respaldo tiene ${horasDesde} h (límite ${limite} h)`
  }

  return { ok, vencido, horasDesde, fecha, motivo }
}
