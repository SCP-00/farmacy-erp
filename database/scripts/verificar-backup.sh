#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════
#  verificar-backup.sh — Un backup que no se restaura NO es un backup
#
#  1) Genera un backup fresco de la base de datos.
#  2) Lo RESTAURA de verdad en un ESQUEMA temporal de la misma base
#     (no requiere privilegio CREATEDB, así funciona con el usuario
#     de la aplicación).
#  3) Compara conteos y huellas de datos (sumas) origen vs. restaurado.
#  4) Elimina el esquema temporal.
#  5) Registra el resultado en config_param (BACKUP_ULTIMO_OK) para que
#     la app alerte si el respaldo falla o se atrasa.
#
#  Uso:  ./verificar-backup.sh [archivo.sql.gz]
#  Cron sugerido (semanal):  0 4 * * 0 /ruta/database/scripts/verificar-backup.sh
#  Código de salida: 0 = OK, 1 = FALLÓ (apto para monitoreo/alertas).
# ══════════════════════════════════════════════════════════
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/database/backups}"

DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-farmacy_db}"
DB_USER="${PGUSER:-farmacy_user}"
DB_PASS="${PGPASSWORD:-farmacy_pass}"

# ── Binarios de PostgreSQL (PATH o instalación típica) ─────
if command -v pg_dump >/dev/null 2>&1; then PG=""
elif [ -x "/c/Program Files/PostgreSQL/15/bin/pg_dump" ]; then PG="/c/Program Files/PostgreSQL/15/bin/"
elif [ -x "/usr/lib/postgresql/15/bin/pg_dump" ]; then PG="/usr/lib/postgresql/15/bin/"
else echo "❌ pg_dump no encontrado. Definí PG_BIN=/ruta/bin"; exit 1; fi
PG="${PG_BIN:-$PG}"
PG_DUMP="${PG}pg_dump"; PSQL="${PG}psql"

VERIFY_SCHEMA="verify_$(date +%s)"
TIMESTAMP=$(date +'%Y-%m-%d_%H-%M-%S')
FILE="${1:-$BACKUP_DIR/farmacy_backup_${TIMESTAMP}.sql.gz}"

export PGPASSWORD="$DB_PASS"
mkdir -p "$BACKUP_DIR"

# Huellas: conteo + suma de dinero/stock (__S__ = prefijo de esquema)
CHECKS=(
  "SELECT count(*) FROM __S__productos"
  "SELECT count(*) FROM __S__clientes"
  "SELECT count(*) FROM __S__empleados"
  "SELECT count(*) FROM __S__cajas"
  "SELECT count(*) FROM __S__caja_movimientos"
  "SELECT count(*), coalesce(sum(total),0) FROM __S__ventas"
  "SELECT count(*), coalesce(sum(cantidad_actual),0) FROM __S__lotes"
)

limpiar() { "$PSQL" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q \
  -c "DROP SCHEMA IF EXISTS \"$VERIFY_SCHEMA\" CASCADE;" >/dev/null 2>&1 || true; }
trap limpiar EXIT

echo "📦 1/6 Generando backup fresco de ${DB_NAME}..."
"$PG_DUMP" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-acl | gzip -9 > "$FILE"
[ -s "$FILE" ] || { echo "❌ El backup quedó vacío"; exit 1; }
echo "   ✅ Archivo: $(du -h "$FILE" | cut -f1)"

echo "🗄️  2/6 Creando esquema temporal ${VERIFY_SCHEMA}..."
"$PSQL" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q \
  -c "CREATE SCHEMA \"$VERIFY_SCHEMA\";"

echo "📥 3/6 Restaurando el backup en el esquema temporal..."
# Reescribimos la calificación de esquema public. → verify_xxx. y dejamos
# fuera las extensiones (ya existen en la base; no son parte del respaldo).
gunzip -c "$FILE" \
  | sed -e "s/public\./${VERIFY_SCHEMA}./g" \
        -e "s/${VERIFY_SCHEMA}\.gin_trgm_ops/public.gin_trgm_ops/g" \
        -e "s/${VERIFY_SCHEMA}\.gist_trgm_ops/public.gist_trgm_ops/g" \
        -e "s/set_config('search_path', '', false)/set_config('search_path', 'public', false)/" \
        -e "/^CREATE EXTENSION/d" \
        -e "/^COMMENT ON EXTENSION/d" \
  | "$PSQL" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      -q -v ON_ERROR_STOP=1 >/dev/null
echo "   ✅ Restaurado sin errores"

echo "🔍 4/6 Comparando datos (origen vs. restaurado)..."
FALLOS=0
DETALLE=""
for q in "${CHECKS[@]}"; do
  ORIGEN=$("$PSQL" -tA -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "${q//__S__/public.}" 2>/dev/null || echo "ERROR")
  RESTAURADO=$("$PSQL" -tA -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "${q//__S__/${VERIFY_SCHEMA}.}" 2>/dev/null || echo "ERROR")
  TABLA=$(printf '%s' "$q" | grep -o '__S__[a-z_]*' | sed 's/__S__//')
  ESTADO="OK"
  if [ "$ORIGEN" != "$RESTAURADO" ]; then ESTADO="FALLO"; FALLOS=$((FALLOS + 1)); fi
  DETALLE="${DETALLE}${TABLA}(${ORIGEN}=${RESTAURADO}) "
  printf "   %-18s origen=%-16s restaurado=%-16s %s\n" "$TABLA" "$ORIGEN" "$RESTAURADO" "$ESTADO"
done

echo "📝 5/6 Registrando el resultado en config_param..."
OK=$([ "$FALLOS" -eq 0 ] && echo true || echo false)
VALOR="{\"ok\":$OK,\"fecha\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"archivo\":\"$(basename "$FILE")\",\"fallos\":$FALLOS}"
# El valor es JSON sin comillas simples; se escapa por seguridad de todos modos.
VALOR_SQL=$(printf '%s' "$VALOR" | sed "s/'/''/g")
"$PSQL" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q -v ON_ERROR_STOP=1 \
  -c "INSERT INTO config_param (clave, valor, descripcion) VALUES ('BACKUP_ULTIMO_OK', '$VALOR_SQL', 'Ultima verificacion de backup (backup->restore)') ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now();" >/dev/null

echo "🧹 6/6 Eliminando esquema temporal..."
limpiar

echo ""
echo "   ${DETALLE% }"
if [ "$FALLOS" -eq 0 ]; then
  echo "✅ VERIFICACIÓN OK — el backup se restaura y los datos coinciden"
  exit 0
fi
echo "❌ VERIFICACIÓN FALLÓ — ${FALLOS} comprobación(es) con diferencias"
exit 1
