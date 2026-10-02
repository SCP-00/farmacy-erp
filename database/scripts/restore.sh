#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════
#  restore.sh — Restaura un backup .sql.gz
#
#  Uso:
#    ./restore.sh <archivo.sql.gz>            # exige base destino VACÍA
#    ./restore.sh <archivo.sql.gz> --force    # DROPea y recrea el esquema public
#
#  Variables: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
#
#  ⚠️  RESTAURAR SOBRE UNA BASE CON DATOS ES DESTRUCTIVO. Sin --force el
#      script se niega si la base ya tiene tablas.
# ══════════════════════════════════════════════════════════
set -euo pipefail

FILE="${1:-}"
FORCE="${2:-}"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "❌ Uso: ./restore.sh <archivo.sql.gz> [--force]"
  exit 1
fi

DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-farmacy_db}"
DB_USER="${PGUSER:-farmacy_user}"
DB_PASS="${PGPASSWORD:-farmacy_pass}"

if command -v psql >/dev/null 2>&1; then PG=""
elif [ -x "/c/Program Files/PostgreSQL/15/bin/psql" ]; then PG="/c/Program Files/PostgreSQL/15/bin/"
elif [ -x "/usr/lib/postgresql/15/bin/psql" ]; then PG="/usr/lib/postgresql/15/bin/"
else echo "❌ psql no encontrado. Definí PG_BIN=/ruta/bin"; exit 1; fi
PG="${PG_BIN:-$PG}"
PSQL="${PG}psql"

export PGPASSWORD="$DB_PASS"
run() { "$PSQL" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q -v ON_ERROR_STOP=1 "$@"; }

TABLAS=$(run -tA -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
echo "🎯 Destino: ${DB_NAME} en ${DB_HOST}:${DB_PORT} (tablas en public: ${TABLAS})"
echo "📦 Backup:  ${FILE}"

if [ "$FORCE" = "--force" ]; then
  echo "⚠️  --force: se borrará el esquema public y se recreará."
  run -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
elif [ "$TABLAS" -gt 0 ]; then
  echo "❌ La base destino NO está vacía. Usá --force si querés sobrescribirla."
  exit 1
fi

echo "📥 Restaurando..."
gunzip -c "$FILE" | "$PSQL" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -q -v ON_ERROR_STOP=1 >/dev/null

echo "🔍 Verificando tablas clave..."
for t in productos ventas empleados lotes; do
  N=$("$PSQL" -tA -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT count(*) FROM public.$t" 2>/dev/null || echo "ERROR")
  printf "   %-12s %s\n" "$t" "$N"
done

echo "✅ Restauración completada. Reiniciá el backend y corré las migraciones pendientes si corresponde."
