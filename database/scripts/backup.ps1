# ══════════════════════════════════════════════════════════
#  Backup automático de PostgreSQL — Farmacy (Windows)
#  Uso: .\database\scripts\backup.ps1
#
#  Para automatizar con Task Scheduler:
#    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -File C:\ruta\database\scripts\backup.ps1"
#    $trigger = New-ScheduledTaskTrigger -Daily -At 03:00AM
#    Register-ScheduledTask -TaskName "Farmacy Backup" -Action $action -Trigger $trigger
# ══════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

# ── Configuración ──────────────────────────────────────────
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSCommandPath))
$BackupDir = Join-Path $ProjectRoot "database\backups"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$Filename = "farmacy_backup_$Timestamp.sql.gz"
$RetentionDays = 30

# Credenciales (usar .env o vars de entorno)
$Env:PGHOST = $Env:PGHOST ?? "localhost"
$Env:PGPORT = $Env:PGPORT ?? "5432"
$Env:PGDATABASE = $Env:PGDATABASE ?? "farmacy_db"
$Env:PGUSER = $Env:PGUSER ?? "farmacy_user"
$Env:PGPASSWORD = $Env:PGPASSWORD ?? "farmacy_pass"

# ── Crear directorio si no existe ──────────────────────────
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# ── Verificar pg_dump disponible ───────────────────────────
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Host "❌ pg_dump no encontrado. Instalá PostgreSQL o agregalo al PATH."
    Write-Host "   pg_dump suele estar en: C:\Program Files\PostgreSQL\15\bin\"
    exit 1
}

# ── Ejecutar backup ────────────────────────────────────────
Write-Host "📦 Iniciando backup de $($Env:PGDATABASE) en $($Env:PGHOST):$($Env:PGPORT)..."
$BackupFile = Join-Path $BackupDir $Filename
$LogFile = Join-Path $BackupDir "backup_$Timestamp.log"

$arguments = @(
    "-h", $Env:PGHOST
    "-p", $Env:PGPORT
    "-U", $Env:PGUSER
    "-d", $Env:PGDATABASE
    "--no-owner"
    "--no-acl"
    # NOTA: sin --compress — el flujo se comprime con gzip abajo.
    # Pasar --compress Y gzip produce un archivo DOBLEMENTE comprimido que
    # NO se puede restaurar con `gunzip -c file | psql`.
    "--verbose"
)

$env:PGPASSWORD = $Env:PGPASSWORD
& "pg_dump" $arguments 2>$LogFile | gzip > $BackupFile
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

# ── Verificar integridad ───────────────────────────────────
if (Test-Path $BackupFile) {
    $Size = (Get-Item $BackupFile).Length / 1MB
    Write-Host "✅ Backup completado: $([math]::Round($Size, 2)) MB"
} else {
    Write-Host "❌ Error: no se generó el archivo de backup"
    exit 1
}

# ── Limpiar backups antiguos ───────────────────────────────
Get-ChildItem -Path $BackupDir -Filter "farmacy_backup_*.sql.gz" | 
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | 
    Remove-Item -Force

Get-ChildItem -Path $BackupDir -Filter "backup_*.log" | 
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | 
    Remove-Item -Force

Write-Host "🧹 Backups anteriores a ${RetentionDays} días eliminados"

# ── Resumen ────────────────────────────────────────────────
Write-Host ""
Write-Host "═══ RESUMEN ═══════════════════════════════════════════"
Write-Host "  Base de datos: $($Env:PGDATABASE)"
Write-Host "  Archivo:       $BackupFile"
Write-Host "  Log:           $LogFile"
Write-Host "  Retención:     ${RetentionDays} días"
Write-Host "════════════════════════════════════════════════════════"
