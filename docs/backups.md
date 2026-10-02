# Backups, verificación y restore

> **Regla de oro:** un backup que nunca se restauró **no es un backup**.

## Scripts

| Script | Qué hace |
|---|---|
| `database/scripts/backup.sh` | `pg_dump` + gzip → `database/backups/farmacy_backup_<fecha>.sql.gz` (retención 30 días) |
| `database/scripts/verificar-backup.sh` | Genera un backup, **lo restaura de verdad** en un esquema temporal y compara los datos |
| `database/scripts/restore.sh` | Restaura un backup en una base destino (con guardas) |
| `database/scripts/backup.ps1` / `backup-docker.sh` | Equivalentes para Windows y para el contenedor `db-backup` |

Requisitos: `pg_dump`/`psql` en el `PATH` **o** definir `PG_BIN=/ruta/al/bin`.
En Windows suele ser `C:\Program Files\PostgreSQL\15\bin`.

## ⚠️ Bug corregido: doble compresión

Los scripts pasaban `pg_dump --compress=9` **y** además `| gzip`. En PostgreSQL
reciente esto produce un archivo **doble-gzipped** que **no se puede restaurar**
con `gunzip -c file | psql` (psql recibiría bytes comprimidos). Se quitó
`--compress=9`; ahora un solo `gunzip` devuelve SQL plano. Si tenías backups
viejos, **no son restaurables** con el comando documentado.

## Verificación automática (recomendado semanal)

```bash
PGPASSWORD=... bash database/scripts/verificar-backup.sh
# exit 0 = OK, exit 1 = FALLÓ (apto para monitoreo/alertas)
```

Qué hace:

1. Genera un backup fresco.
2. Crea un **esquema temporal** (no necesita privilegio `CREATEDB`, funciona con
   el usuario de la aplicación) y **restaura ahí** el dump, reescribiendo la
   calificación `public.` → `verify_xxx.`.
3. Compara **conteos y huellas de datos** (suma de ventas, stock) entre el origen
   y lo restaurado.
4. Elimina el esquema temporal.
5. Registra el resultado en `config_param` (clave `BACKUP_ULTIMO_OK`).

Cron sugerido:

```cron
0 3 * * *   /ruta/database/scripts/backup.sh
0 4 * * 0   /ruta/database/scripts/verificar-backup.sh
```

## Copia FUERA del sitio

Un backup en el mismo equipo no protege contra fallo de disco. Definí
`BACKUP_REMOTE_TARGET` para copiarlo fuera:

```bash
export BACKUP_REMOTE_TARGET="s3:bucket-farmacy/backups"   # rclone
export BACKUP_REMOTE_TARGET="/mnt/nas/backups"            # NAS montado
```

## Restore

```bash
# Base destino VACÍA:
PGDATABASE=farmacy_restore bash database/scripts/restore.sh backup.sql.gz

# Sobrescribir una base existente (DESTRUCTIVO):
PGDATABASE=farmacy_db bash database/scripts/restore.sh backup.sql.gz --force
```

## Alertas de respaldo

- `GET /api/v1/health/backup` → estado de frescura (`vencido`, `horasDesde`).
- El job diario (`backend/src/jobs/alertas.ts`) avisa por email a los
  administradores si el respaldo falló o tiene más de **`BACKUP_MAX_HORAS`**
  (por defecto 26 h).
