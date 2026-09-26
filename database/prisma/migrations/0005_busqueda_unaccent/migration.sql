-- ══════════════════════════════════════════════════════════
--  MIGRACIÓN 0005 — Búsqueda insensible a acentos
--
--  Hallazgo E2E real: q=Acetaminofen (sin tilde) → 0 resultados.
--  ILIKE es insensible a mayúsculas PERO sensible a acentos: el cajero
--  que escribe sin tilde no encuentra el medicamento.
--
--  Solución: wrapper IMMUTABLE de unaccent (con diccionario fijo),
--  columna generada nombre_normalizado = inm_lower_unaccent(nombre)
--  e índice GIN trigram. El backend genera la columna en INSERT/UPDATE
--  (Prisma no soporta GENERATED ... AS), de ahí el DEFAULT y el trigger.
-- ══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Wrapper IMMUTABLE requerido para columnas generadas / índices.
-- El diccionario se fija como literal para determinismo total.
CREATE OR REPLACE FUNCTION inm_lower_unaccent(text)
RETURNS text
AS $$
  SELECT lower(unaccent('unaccent', $1))
$$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE;

-- Columna normalizada. Prisma no la conoce y no la envía: el trigger
-- BEFORE INSERT de abajo la llena siempre (cualquier origen de escritura,
-- importador CSV incluido).
ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "nombre_normalizado" text;
CREATE OR REPLACE FUNCTION productos_normaliza_nombre()
RETURNS trigger AS $$
BEGIN
  NEW."nombre_normalizado" := inm_lower_unaccent(NEW."nombre");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_productos_normaliza ON "productos";
CREATE TRIGGER trg_productos_normaliza
  BEFORE INSERT OR UPDATE OF "nombre" ON "productos"
  FOR EACH ROW EXECUTE FUNCTION productos_normaliza_nombre();

-- Backfill de filas existentes
UPDATE "productos" SET "nombre_normalizado" = inm_lower_unaccent("nombre")
WHERE "nombre_normalizado" IS NULL OR "nombre_normalizado" <> inm_lower_unaccent("nombre");

-- Índice trigram para búsquedas parciales rápidas (ILIKE '%...%')
CREATE INDEX IF NOT EXISTS idx_productos_nombre_normalizado_trgm
  ON "productos" USING gin ("nombre_normalizado" gin_trgm_ops);

-- Índice de soporte para el ORDER BY nombre del catálogo
CREATE INDEX IF NOT EXISTS idx_productos_nombre
  ON "productos" ("nombre");
