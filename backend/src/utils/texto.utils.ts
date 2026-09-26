// ══════════════════════════════════════════════════════════
//  texto.utils.ts — Normalización de texto para búsquedas
//
//  Resuelve el hallazgo E2E: "Acetaminofen" (sin tilde) no
//  encontraba "Acetaminofén" porque ILIKE es insensible a
//  mayúsculas pero SENSIBLE a acentos. Toda búsqueda de texto
//  libre contra DB debe usar estos helpers (migración 0005:
//  columna productos.nombre_normalizado + índice trigram).
// ══════════════════════════════════════════════════════════

/** Escapa los comodines de ILIKE (%, _) para búsquedas literales. */
export function escaparLike(termino: string): string {
  return termino.replace(/[\\%_]/g, '\\$&')
}

/**
 * Fragmento `LIKE %q%` ya normalizado, para columnas generadas con
 * inm_lower_unaccent() (migración 0005). La query también se normaliza
 * con unaccent, así que "Acetaminofen" encuentra "Acetaminofén".
 * Uso con las expresiones de `exprNombreNormalizado`.
 */
export function qLike(q: string): string {
  return `%${escaparLike(unacentuar(q).toLowerCase().trim())}%`
}

/**
 * Expresión SQL `unaccent(lower(columna))` para columnas SIN columna
 * generada (principioActivo, laboratorio, etc.). Para `nombre` preferir
 * la columna generada nombre_normalizado (usa el índice trigram).
 */
export function exprNormalizada(columna: string): string {
  // Solo identificadores SQL simples: letras, dígitos, guión bajo y puntos.
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(columna)) {
    throw new Error(`Nombre de columna inválido para exprNormalizada: ${columna}`)
  }
  return `unaccent(lower(${columna}))`
}

/** unaccent en JS — para cachés en memoria y filtros client-side. NFD: separa el diacrítico y lo elimina. */
export function unacentuar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
