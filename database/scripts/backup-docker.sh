#!/bin/sh
# ══════════════════════════════════════════════════════════
#  Backup automático de PostgreSQL — Farmacy (Docker)
#  Diseñado para ejecutarse como sidecar en docker-compose
#
#  Uso en Docker:
#    docker exec farmacy_db_backup backup
#    docker exec farmacy_db_backup restore backup_file.sql.gz
#    docker exec farmacy_db_backup list
#
#  Variables de entorno:
#    DB_HOST         (default: postgres)
#    DB_PORT         (default: 5432)
#    DB_NAME         (default: farmacy_db)
#    DB_USER         (default: farmacy_user)
#    DB_PASS         (requerida)
#    BACKUP_DIR      (default: /backups)
#    RETENTION_DAYS  (default: 30)
#    BACKUP_INTERVAL (default: 86400 = 24h)
# ══════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuración ──────────────────────────────────────────
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-farmacy_db}"
DB_USER="${DB_USER:-farmacy_user}"
DB_PASS="${DB_PASS:?DB_PASS es requerida}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_INTERVAL="${BACKUP_INTERVAL:-86400}"

TIMESTAMP=$(date +'%Y-%m-%d_%H-%M-%S')
FILENAME="farmacy_backup_${TIMESTAMP}.sql.gz"
BACKUP_FILE="${BACKUP_DIR}/${FILENAME}"
LOG_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.log"

# ── Función: hacer backup ──────────────────────────────────
do_backup() {
  echo "📦 Iniciando backup de ${DB_NAME} en ${DB_HOST}:${DB_PORT}..."
  echo "   Destino: ${BACKUP_FILE}"

  export PGPASSWORD="${DB_PASS}"
  pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --no-owner \
    --no-acl \
    --verbose \
    2>"${LOG_FILE}" \
    | gzip > "${BACKUP_FILE}"
  unset PGPASSWORD

  # Verificar integridad
  if [ -f "${BACKUP_FILE}" ]; then
    SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "✅ Backup completado: ${SIZE}"
  else
    echo "❌ Error: no se generó el archivo de backup"
    return 1
  fi

  # Limpiar backups antiguos
  find "${BACKUP_DIR}" -name "farmacy_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
  find "${BACKUP_DIR}" -name "backup_*.log" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
  echo "🧹 Backups anteriores a ${RETENTION_DAYS} días eliminados"

  # Resumen
  echo ""
  echo "═══ RESUMEN ═══════════════════════════════════════════"
  echo "  Base de datos: ${DB_NAME}"
  echo "  Archivo:       ${BACKUP_FILE}"
  echo "  Log:           ${LOG_FILE}"
  echo "  Retención:     ${RETENTION_DAYS} días"
  echo "════════════════════════════════════════════════════════"
}

# ── Función: listar backups ────────────────────────────────
do_list() {
  echo "📋 Backups disponibles en ${BACKUP_DIR}:"
  echo ""
  if [ -d "${BACKUP_DIR}" ]; then
    ls -lhS "${BACKUP_DIR}"/*.sql.gz 2>/dev/null || echo "  (no hay backups)"
  else
    echo "  (directorio ${BACKUP_DIR} no existe)"
  fi
}

# ── Función: restaurar backup ──────────────────────────────
do_restore() {
  RESTORE_FILE="${1:-}"
  if [ -z "${RESTORE_FILE}" ]; then
    # Usar el backup más reciente
    RESTORE_FILE=$(ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -1)
    if [ -z "${RESTORE_FILE}" ]; then
      echo "❌ No hay backups para restaurar"
      exit 1
    fi
    echo "   Usando backup más reciente: ${RESTORE_FILE}"
  fi

  if [ ! -f "${RESTORE_FILE}" ]; then
    echo "❌ Archivo no encontrado: ${RESTORE_FILE}"
    exit 1
  fi

  echo "⚠️  RESTAURANDO ${DB_NAME} desde ${RESTORE_FILE}"
  echo "   Esto SOBREESCRIBIRÁ todos los datos actuales."
  echo "   Presiona Ctrl+C para cancelar (5s)..."
  sleep 5

  export PGPASSWORD="${DB_PASS}"
  gunzip -c "${RESTORE_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"
  unset PGPASSWORD

  echo "✅ Restauración completada"
}

# ── Función: loop de backup programado ─────────────────────
do_loop() {
  echo "🔄 Backup loop iniciado — intervalo: ${BACKUP_INTERVAL}s"
  echo "   Ejecutando primer backup inmediato..."
  do_backup
  while true; do
    sleep "${BACKUP_INTERVAL}"
    do_backup
    echo ""
    echo "   Próximo backup en ${BACKUP_INTERVAL}s"
  done
}

# ── Entrypoint ─────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

case "${1:-loop}" in
  backup)
    do_backup
    ;;
  restore)
    do_restore "${2:-}"
    ;;
  list)
    do_list
    ;;
  loop)
    do_loop
    ;;
  *)
    echo "Uso: $0 {backup|restore [file]|list|loop}"
    echo ""
    echo "  backup              Ejecuta backup inmediato"
    echo "  restore [file]      Restaura desde backup (default: más reciente)"
    echo "  list                Lista backups disponibles"
    echo "  loop                Loop infinito con intervalo BACKUP_INTERVAL (default)"
    exit 1
    ;;
esac
