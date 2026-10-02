// ══════════════════════════════════════════════════════════
//  actualizacion.ts — Aviso de nueva versión del desktop
//
//  El instalador (Tauri/Electron) no puede auto-actualizarse sin firma de
//  código, pero sí puede AVISAR cuando hay una versión nueva publicada y
//  ofrecer la descarga. Esto cubre PWA, Tauri y Electron por igual.
//
//  Por defecto consulta la última release de GitHub. Configurable con
//  VITE_UPDATE_URL (por si se usa otro servidor de versiones).
// ══════════════════════════════════════════════════════════

export const VERSION_ACTUAL: string = (import.meta.env.VITE_APP_VERSION as string) || '1.0.0'

export const URL_ACTUALIZACIONES: string =
  (import.meta.env.VITE_UPDATE_URL as string) ||
  'https://api.github.com/repos/SCP-00/farmacy-erp/releases/latest'

export interface InfoActualizacion {
  version: string
  url?: string
  notas?: string
  hayNueva: boolean
}

/** Compara dos versiones semver-ish: >0 si `a` es más nueva que `b`. */
export function compararVersiones(a: string, b: string): number {
  const partes = (v: string) =>
    String(v ?? '')
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0)
  const pa = partes(a)
  const pb = partes(b)
  const largo = Math.max(pa.length, pb.length)
  for (let i = 0; i < largo; i++) {
    const diferencia = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diferencia !== 0) return diferencia
  }
  return 0
}

/** Extrae la info de versión de una release de GitHub (u objeto equivalente). */
export function interpretarRelease(json: unknown): Omit<InfoActualizacion, 'hayNueva'> | null {
  const j = json as Record<string, unknown> | null
  const tag = (j?.tag_name as string) ?? (j?.version as string)
  if (!tag) return null
  return {
    version: String(tag).replace(/^v/i, ''),
    url: (j?.html_url as string) ?? (j?.url as string) ?? undefined,
    notas: typeof j?.body === 'string' ? (j.body as string).slice(0, 600) : undefined,
  }
}

/**
 * Consulta la última versión publicada y decide si hay una nueva.
 * Nunca lanza: devuelve null si no se pudo consultar (sin red, etc.).
 */
export async function verificarActualizacion(url = URL_ACTUALIZACIONES): Promise<InfoActualizacion | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const info = interpretarRelease(await res.json())
    if (!info) return null
    return { ...info, hayNueva: compararVersiones(info.version, VERSION_ACTUAL) > 0 }
  } catch {
    return null
  }
}
