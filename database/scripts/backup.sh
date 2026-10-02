#!/bin/bash
# ══════════════════════════════════════════════════════════
#  Backup automático de PostgreSQL — Farmacy
#  Uso: chmod +x database/scripts/backup.sh && ./database/scripts/backup.sh
#
#  Para automatizar con cron (diario a las 3 AM):
#    crontab -e
#    0 3 * * * /ruta/al/proyecto/database/scripts/backup.sh
# ══════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuración ──────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/database/backups"
TIMESTAMP=$(date +'%Y-%m-%d_%H-%M-%S')
FILENAME="farmacy_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

# Credenciales (usar .env o vars de entorno)
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-farmacy_db}"
DB_USER="${PGUSER:-farmacy_user}"
DB_PASS="${PGPASSWORD:-farmacy_pass}"

# ── Crear directorio si no existe ──────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Ejecutar backup ────────────────────────────────────────
echo "📦 Iniciando backup de ${DB_NAME} en ${DB_HOST}:${DB_PORT}..."
echo "   Destino: ${BACKUP_DIR}/${FILENAME}"

# ── Binarios de PostgreSQL (PATH o instalación típica) ─────
if command -v pg_dump >/dev/null 2>&1; then PG=""
elif [ -x "/c/Program Files/PostgreSQL/15/bin/pg_dump" ]; then PG="/c/Program Files/PostgreSQL/15/bin/"
elif [ -x "/usr/lib/postgresql/15/bin/pg_dump" ]; then PG="/usr/lib/postgresql/15/bin/"
else echo "❌ pg_dump no encontrado. Definí PG_BIN=/ruta/bin"; exit 1; fi
PG_DUMP="${PG_BIN:-$PG}pg_dump"

export PGPASSWORD="$DB_PASS"
"$PG_DUMP" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  --verbose \
  2>"${BACKUP_DIR}/backup_${TIMESTAMP}.log" \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

unset PGPASSWORD

# ── Verificar integridad ───────────────────────────────────
if [ -f "${BACKUP_DIR}/${FILENAME}" ]; then
  SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
  echo "✅ Backup completado: ${SIZE}"
else
  echo "❌ Error: no se generó el archivo de backup"
  exit 1
fi

# ── Limpiar backups antiguos (> RETENTION_DAYS días) ───────
find "$BACKUP_DIR" -name "farmacy_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "$BACKUP_DIR" -name "backup_*.log" -mtime +${RETENTION_DAYS} -delete
echo "🧹 Backups anteriores a ${RETENTION_DAYS} días eliminados"

# ── Copia FUERA DEL SITIO (opcional pero recomendada) ──────
# Un backup en el mismo equipo no protege contra fallo del disco.
# BACKUP_REMOTE_TARGET ejemplos:
#   s3:bucket-farmacy/backups        (rclone)
#   b2:bucket-farmacy                (rclone)
#   /mnt/nas/backups                 (NAS montado)
if [ -n "${BACKUP_REMOTE_TARGET:-}" ]; then
  echo "☁️  Copiando fuera del sitio → ${BACKUP_REMOTE_TARGET}"
  if command -v rclone >/dev/null 2>&1 && [[ "$BACKUP_REMOTE_TARGET" == *:* ]]; then
    rclone copy "${BACKUP_DIR}/${FILENAME}" "${BACKUP_REMOTE_TARGET}" && echo "   ✅ Copiado con rclone"
  else
    cp "${BACKUP_DIR}/${FILENAME}" "${BACKUP_REMOTE_TARGET}/" && echo "   ✅ Copiado a ${BACKUP_REMOTE_TARGET}"
  fi
else
  echo "ℹ️  BACKUP_REMOTE_TARGET no definido - el backup queda SOLO en este equipo."
  echo "   Definilo (p. ej. s3:bucket-farmacy) para tener copia fuera del sitio."
fi

# ── Resumen ────────────────────────────────────────────────
echo ""
echo "═══ RESUMEN ═══════════════════════════════════════════"
echo "  Base de datos: ${DB_NAME}"
echo "  Archivo:       ${BACKUP_DIR}/${FILENAME}"
echo "  Log:           ${BACKUP_DIR}/backup_${TIMESTAMP}.log"
echo "  Retención:     ${RETENTION_DAYS} días"
echo "════════════════════════════════════════════════════════"
