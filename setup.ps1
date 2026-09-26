<#
.SYNOPSIS
  FARMACY — Setup automatico (Windows PowerShell)

.DESCRIPTION
  Instala dependencias, genera Prisma Client, aplica migraciones y
  carga seeds. Pensado para primer arranque o reset de entorno.

  Uso:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
  (Los scripts de la raiz deben ejecutarse en PowerShell nativo,
  nunca desde Git Bash/MSYS — ver nota en run.ps1.)

.NOTES
  Complementa a setup.bat (cmd) y setup.sh (Linux/macOS).
  Requiere Node.js 18+ y Docker Desktop para la DB.
#>

#requires -Version 5.1

$ROOT = $PSScriptRoot
if (-not $ROOT) { $ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $ROOT

function Write-Step { param([string]$m) Write-Host "`n[$(Get-Date -Format HH:mm:ss)] $m" -ForegroundColor Cyan }
function Write-OK   { param([string]$m) Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-Warn2{ param([string]$m) Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Write-Err2 { param([string]$m) Write-Host "  [X]  $m" -ForegroundColor Red }

Write-Host ""
Write-Host "  +------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |   FARMACY - Setup de Entorno (Windows)   |" -ForegroundColor Cyan
Write-Host "  +------------------------------------------+" -ForegroundColor Cyan

# ── 0. .env ──────────────────────────────────────────────
Write-Step "0/7 Verificando .env..."
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item .env.example .env
        Write-Warn2 ".env creado desde .env.example - REVISALO antes de continuar"
        Write-Warn2 "Requeridos: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, JWT_CLIENTE_SECRET (min 32 chars)"
    } else {
        Write-Err2 "No existe .env ni .env.example"
        exit 1
    }
} else {
    Write-OK ".env encontrado"
}

# ── 1. Node.js + pnpm ────────────────────────────────────
Write-Step "1/7 Verificando Node.js y pnpm..."
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Err2 "Node.js no esta instalado. Descargalo en https://nodejs.org"
    exit 1
}
$nodeVersion = (node --version) -replace 'v',''
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 18) {
    Write-Err2 "Node.js $nodeVersion detectado - se requiere 18+"
    exit 1
}
Write-OK "Node.js $nodeVersion"

# pnpm: directo → corepack → fallback npm (nueva API de corepack ya no
# expone shims globales en algunos setups; npm i -g pnpm siempre funciona)
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-OK "pnpm $(pnpm --version) detectado"
} else {
    Write-Warn2 "pnpm no encontrado - intentando corepack..."
    try {
        corepack enable pnpm 2>$null
        corepack prepare pnpm@11 --activate 2>$null
    } catch { }
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        Write-OK "pnpm $(pnpm --version) activado via corepack"
    } else {
        Write-Warn2 "corepack no expuso pnpm - instalando via npm (fallback)"
        npm install -g pnpm@11
        if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
            Write-Err2 "No se pudo instalar pnpm. Instalalo manualmente: npm i -g pnpm"
            exit 1
        }
        Write-OK "pnpm $(pnpm --version) instalado via npm"
    }
}

# ── 2. Docker ────────────────────────────────────────────
Write-Step "2/7 Verificando Docker..."
$docker = Get-Command docker -ErrorAction SilentlyContinue
$skipInfra = $false
if (-not $docker) {
    Write-Warn2 "Docker no encontrado - se omiten DB/Redis via contenedores"
    Write-Warn2 "Necesitaras PostgreSQL y Redis propios o instala Docker Desktop"
    $skipInfra = $true
} elseif (-not (docker info 2>$null)) {
    Write-Warn2 "Docker instalado pero el daemon no responde"
    Write-Warn2 "Abre Docker Desktop y vuelve a ejecutar este script"
    $skipInfra = $true
} else {
    Write-OK "Docker activo: $((docker --version).Trim())"
}

# ── 3. Dependencias ─────────────────────────────────────
Write-Step "3/7 Instalando dependencias (pnpm install)..."
pnpm install
if ($LASTEXITCODE -ne 0) { Write-Err2 "pnpm install fallo"; exit 1 }
Write-OK "Dependencias instaladas"

# ── 4. Prisma Client ────────────────────────────────────
Write-Step "4/7 Generando Prisma Client..."
Push-Location backend
try {
    pnpm run db:generate
    if ($LASTEXITCODE -eq 0) { Write-OK "Prisma Client generado" }
    else { Write-Warn2 "No se pudo generar Prisma Client (revisa errores arriba)" }
} finally { Pop-Location }

# ── 5-6. DB: migraciones + seeds (solo si hay infra) ────
if (-not $skipInfra) {
    Write-Step "5/7 Levantando PostgreSQL + Redis (docker compose dev)..."
    docker compose -f docker-compose.dev.yml up -d
    if ($LASTEXITCODE -eq 0) {
        # Esperar a que Postgres acepte conexiones
        Write-Step "   Esperando salud de PostgreSQL..."
        $tries = 0
        while ($tries -lt 30) {
            docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U farmacy_user -d farmacy_db 2>$null
            if ($LASTCONTEXITCODE -eq 0) { break }
            Start-Sleep -Seconds 2
            $tries++
        }
        Write-OK "Infra levantada"
    } else {
        Write-Warn2 "No se pudo levantar la infra - migraciones se intentaran igual"
    }

    Write-Step "6/7 Aplicando migraciones + seeds..."
    Push-Location backend
    try {
        if (pnpm run db:migrate:deploy) { Write-OK "Migraciones aplicadas" }
        elseif (pnpm run db:push)       { Write-Warn2 "Esquema aplicado via db push (fallback)" }
        else { Write-Warn2 "No se pudo aplicar el esquema - revisa DATABASE_URL" }

        if (pnpm run db:seed) { Write-OK "Seeds cargados (admin@farmacy.co / Admin@1234)" }
        else { Write-Warn2 "Seeds fallaron (no bloquea el arranque)" }
    } finally { Pop-Location }
} else {
    Write-Warn2 "Pasos 5-6 omitidos (sin Docker). Levanta la DB y corre de nuevo."
}

# ── 7. Resumen ──────────────────────────────────────────
Write-Step "7/7 Resumen"
Write-Host ""
Write-Host "  Setup completado. Para iniciar:" -ForegroundColor Green
Write-Host "    .\run.ps1                          (todo en uno)"
Write-Host "    o manual:"
Write-Host "      docker compose -f docker-compose.dev.yml up -d"
Write-Host "      cd backend ; pnpm run dev        # API :3000"
Write-Host "      cd frontend ; pnpm run dev       # Tienda :5173"
Write-Host ""
Write-Host "  Credenciales demo (seeds):"
Write-Host "    admin@farmacy.co / Admin@1234"
Write-Host "    farmaceuta@farmacy.co / Farm@1234"
Write-Host ""
