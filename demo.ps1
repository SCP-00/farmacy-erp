<#
.SYNOPSIS
  FARMACY - Demo Launch Script
.DESCRIPTION
  Automates everything needed for a demo with ngrok:
  1. Ensures Docker + backend + frontend are running
  2. Starts ngrok tunnel on port 5173
  3. Detects the ngrok public URL
  4. Updates FRONTEND_URL in .env
  5. Restarts the backend with the new URL
  6. Opens the ngrok URL in the browser

  Run from PowerShell:  .\demo.ps1

.NOTES
  - Requires ngrok authtoken configured (run once: ngrok config add-authtoken YOUR_TOKEN)
  - Requires run.ps1 in the same directory (for full stack startup)
  - Tested on Windows with PowerShell 5.1+
#>

#requires -Version 5.1

# ============================================================
# CONFIGURACION
# ============================================================

$ROOT = $PSScriptRoot
if (-not $ROOT) { $ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $ROOT

$NGROK_PORT = 5173
$NGROK_MAX_WAIT = 30            # segundos max esperando al tunel
$HEALTHCHECK_TIMEOUT = 60       # segundos max esperando al backend
$HEALTHCHECK_INTERVAL = 2

# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

function Write-Step {
    param([int]$Num, [int]$Total, [string]$Message)
    Write-Host "`n[$Num/$Total]" -ForegroundColor Cyan -NoNewline
    Write-Host " $Message"
}

function Write-OK {
    param([string]$Message)
    Write-Host "   [v] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warn {
    param([string]$Message)
    Write-Host "   [!] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Err {
    param([string]$Message)
    Write-Host "   [x] " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

function Test-CommandAvailable {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-ProcessOnPort {
    param([int]$Port)
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($conn) { return $conn.OwningProcess }
    } catch {}
    return $null
}

function Wait-ForHealth {
    param([string]$Url, [int]$TimeoutSeconds, [int]$Interval)
    $maxAttempts = [math]::Floor($TimeoutSeconds / $Interval)
    for ($i = 1; $i -le $maxAttempts; $i++) {
        Start-Sleep -Seconds $Interval
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { return $true }
        } catch {}
        if ($i % 5 -eq 0) { Write-Host "   ...intento $i de $maxAttempts" -ForegroundColor DarkGray }
    }
    return $false
}

function Get-NgrokUrl {
    try {
        $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 3 -ErrorAction Stop
        if ($tunnels.tunnels -and $tunnels.tunnels.Count -gt 0) {
            $publicUrl = $tunnels.tunnels[0].public_url
            if ($publicUrl) { return $publicUrl }
        }
    } catch {}
    return $null
}

function Get-CurrentNgrokPid {
    try {
        $conn = Get-NetTCPConnection -LocalPort 4040 -ErrorAction SilentlyContinue
        if ($conn) { return $conn.OwningProcess }
    } catch {}
    return $null
}

function Stop-Ngrok {
    $pid = Get-CurrentNgrokPid
    if ($pid) {
        Write-Host "   Deteniendo ngrok existente (PID $pid)..." -ForegroundColor DarkGray
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# ============================================================
# BANNER
# ============================================================

Clear-Host
Write-Host ""
Write-Host "  +----------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |   FARMACY - Demo Launch Script               |" -ForegroundColor Cyan
Write-Host "  |   Inicio completo con ngrok                  |" -ForegroundColor Cyan
Write-Host "  +----------------------------------------------+" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# [1/6] VERIFICAR REQUISITOS
# ============================================================

Write-Step 1 6 "Verificando requisitos..."

# -- ngrok
if (-not (Test-CommandAvailable "ngrok")) {
    Write-Err "ngrok no encontrado. Instalalo con:  winget install ngrok"
    Write-Host "   O desde: https://ngrok.com/download"
    pause
    exit 1
}
Write-OK "ngrok detectado"

# -- Node.js
if (-not (Test-CommandAvailable "node")) {
    Write-Err "Node.js no instalado"
    pause
    exit 1
}
Write-OK "Node.js detectado: $(node --version)"

# -- pnpm
if (-not (Test-CommandAvailable "pnpm")) {
    Write-Warn "Activando pnpm via corepack..."
    corepack enable pnpm 2>$null
    if (-not (Test-CommandAvailable "pnpm")) {
        Write-Err "No se pudo activar pnpm"
        pause
        exit 1
    }
}
Write-OK "pnpm detectado: v$(pnpm --version)"

# -- Docker
if (-not (Test-CommandAvailable "docker")) {
    Write-Err "Docker no instalado"
    pause
    exit 1
}
try {
    $null = docker info --format '{{.OSType}}' 2>$null
    Write-OK "Docker funcionando"
} catch {
    Write-Err "Docker no esta corriendo. Abre Docker Desktop primero."
    pause
    exit 1
}

# ============================================================
# [2/6] VERIFICAR / INICIAR CONTENEDORES + SERVIDORES
# ============================================================

Write-Step 2 6 "Verificando servidores..."

# -- Verificar si backend y frontend ya estan corriendo
$backendRunning = $null -ne (Get-ProcessOnPort -Port 3000)
$frontendRunning = $null -ne (Get-ProcessOnPort -Port 5173)

if ($backendRunning -and $frontendRunning) {
    Write-OK "Backend (:3000) y Frontend (:5173) ya estan corriendo"
} else {
    Write-Warn "Servidores no detectados. Iniciando con run.ps1..."
    Write-Host "   Se abriran ventanas separadas para backend y frontend." -ForegroundColor DarkGray
    Write-Host "   Minimizalas o dejarlas detras de esta ventana." -ForegroundColor DarkGray
    Write-Host ""

    # Ejecutar run.ps1 en una ventana separada (para no bloquear este script)
    $runScript = Join-Path $ROOT "run.ps1"
    if (-not (Test-Path $runScript)) {
        Write-Err "No se encuentra run.ps1 en la raiz del proyecto"
        pause
        exit 1
    }

    Start-Process -FilePath "powershell.exe" `
        -ArgumentList "-NoExit", "-Command", "& '$runScript'" `
        -WindowStyle Normal

    Write-Host "   run.ps1 iniciado en ventana separada." -ForegroundColor DarkGray
    Write-Host "   Esperando a que el backend responda..." -ForegroundColor DarkGray

    $healthOk = Wait-ForHealth -Url "http://localhost:3000/api/v1/health" `
        -TimeoutSeconds $HEALTHCHECK_TIMEOUT -Interval $HEALTHCHECK_INTERVAL

    if (-not $healthOk) {
        Write-Err "El backend no respondio despues de $HEALTHCHECK_TIMEOUT segundos."
        Write-Host "   Revisa la ventana de run.ps1 para ver posibles errores."
        pause
        exit 1
    }
    Write-OK "Backend respondiendo en http://localhost:3000"
}

# ============================================================
# [3/6] INICIAR NGOK
# ============================================================

Write-Step 3 6 "Iniciando ngrok..."

# Detener ngrok previo si existe
Stop-Ngrok

# Iniciar ngrok en background (ventana oculta)
$ngrokProcess = Start-Process -FilePath "ngrok" `
    -ArgumentList "http", "$NGROK_PORT", "--log=stdout" `
    -WindowStyle Hidden -PassThru
Write-OK "ngrok iniciado (PID: $($ngrokProcess.Id))"

# Esperar a que el tunel este listo
Write-Host "   Esperando tunel ngrok..." -ForegroundColor DarkGray
$ngrokUrl = $null
for ($i = 1; $i -le $NGROK_MAX_WAIT; $i++) {
    Start-Sleep -Seconds 1
    $ngrokUrl = Get-NgrokUrl
    if ($ngrokUrl) { break }
}
if (-not $ngrokUrl) {
    Write-Err "ngrok no creo el tunel en $NGROK_MAX_WAIT segundos."
    Write-Host "   Verifica que ngrok tenga el authtoken configurado:"
    Write-Host "   ngrok config add-authtoken TU_TOKEN"
    Write-Host "   (consiguelo en https://dashboard.ngrok.com/get-started/your-authtoken)"
    pause
    exit 1
}
Write-OK "Tunel ngrok activo: $ngrokUrl"

# Verificar que ngrok redirige bien al frontend
try {
    $ngrokCheck = Invoke-WebRequest -Uri "$ngrokUrl" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    $ngrokStatus = $ngrokCheck.StatusCode
    Write-OK "ngrok respondiendo ($ngrokStatus) en $ngrokUrl"
} catch {
    Write-Warn "ngrok responde pero con codigo: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "   (puede ser normal si el frontend aun se esta cargando)" -ForegroundColor DarkGray
}

# ============================================================
# [4/6] ACTUALIZAR .env CON LA URL DE NGROK
# ============================================================

Write-Step 4 6 "Actualizando .env para modo ngrok..."

$envPath = Join-Path $ROOT ".env"
if (-not (Test-Path $envPath)) {
    Write-Err "No se encuentra .env en la raiz"
    pause
    exit 1
}

$envContent = Get-Content $envPath -Raw
$oldUrl = ""

# Extraer la URL actual para mostrarla
if ($envContent -match 'FRONTEND_URL=(.+)') {
    $oldUrl = $matches[1].Trim()
}

# ---- FRONTEND_URL ----
if ($envContent -match 'FRONTEND_URL=') {
    $envContent = $envContent -replace 'FRONTEND_URL=.*', "FRONTEND_URL=$ngrokUrl"
} else {
    $envContent += "`nFRONTEND_URL=$ngrokUrl`n"
}

# ---- VITE_API_URL: comentar para que use el proxy de Vite (relativo /api/v1)
# Si no se comenta, Chrome bloquea peticiones desde ngrok a localhost:3000
if ($envContent -match '^VITE_API_URL=') {
    $envContent = $envContent -replace '^VITE_API_URL=.*', "# VITE_API_URL=(comentado por demo.ps1 — usa proxy de Vite)"
    Write-OK "VITE_API_URL comentado (usa proxy de Vite)"
} elseif (-not ($envContent -match 'VITE_API_URL.*comentado')) {
    # Ya estaba comentado, no hacer nada
    Write-OK "VITE_API_URL ya estaba comentado"
}

Set-Content -Path $envPath -Value $envContent
Write-OK "FRONTEND_URL actualizado:"
Write-Host "   Anterior: $([string]$oldUrl)" -ForegroundColor DarkGray
Write-Host "   Nueva:    $ngrokUrl" -ForegroundColor Green

# ============================================================
# [5/6] REINICIAR BACKEND CON LA NUEVA URL
# ============================================================

Write-Step 5 6 "Reiniciando backend con nueva URL..."

$backendPid = Get-ProcessOnPort -Port 3000
if ($backendPid) {
    Write-Host "   Deteniendo backend (PID $backendPid)..." -ForegroundColor DarkGray
    Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}

# Iniciar backend con la nueva URL en ventana separada
$backendDir = Join-Path $ROOT "backend"
$backendProcess = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; pnpm run dev" `
    -WindowStyle Normal -PassThru
Write-OK "Backend reiniciado (PID: $($backendProcess.Id))"

# Esperar a que el backend este listo
$healthOk = Wait-ForHealth -Url "http://localhost:3000/api/v1/health" `
    -TimeoutSeconds $HEALTHCHECK_TIMEOUT -Interval $HEALTHCHECK_INTERVAL

if (-not $healthOk) {
    Write-Err "El backend no respondio tras el reinicio"
    pause
    exit 1
}
Write-OK "Backend listo con FRONTEND_URL=$ngrokUrl"



# ============================================================
# [6/6] RESUMEN + ABRIR NAVEGADOR
# ============================================================

Write-Step 6 6 "Demo lista!"

Write-Host ""
Write-Host "  +----------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |  FARMACY - Demo lista!                        |" -ForegroundColor Cyan
Write-Host "  +----------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |                                                " -ForegroundColor Cyan
Write-Host "  |  Tienda online (ngrok):" -ForegroundColor Cyan
Write-Host "  |    $ngrokUrl" -ForegroundColor Green
Write-Host "  |                                                " -ForegroundColor Cyan
Write-Host "  |  Local:" -ForegroundColor Cyan
Write-Host "  |    Frontend:  http://localhost:5173" -ForegroundColor Green
Write-Host "  |    Backend:   http://localhost:3000/api/v1" -ForegroundColor Green
Write-Host "  |    pgAdmin:   http://localhost:5050" -ForegroundColor Green
Write-Host "  |                                                " -ForegroundColor Cyan
Write-Host "  |  Wompi redirect: $ngrokUrl/pago/confirmacion" -ForegroundColor DarkGray
Write-Host "  |  Wompi webhook:  $ngrokUrl/api/v1/pagos/wompi/webhook" -ForegroundColor DarkGray
Write-Host "  |                                                " -ForegroundColor Cyan
Write-Host "  |  [!] La URL de ngrok expira en 1 hora." -ForegroundColor Yellow
Write-Host "  |  Si vence, ejecuta de nuevo .\demo.ps1" -ForegroundColor Yellow
Write-Host "  |                                                " -ForegroundColor Cyan
Write-Host "  +----------------------------------------------+" -ForegroundColor Cyan
Write-Host ""

# Abrir navegador con la URL de ngrok
try {
    Start-Process "msedge" -ArgumentList $ngrokUrl -ErrorAction Stop
    Write-OK "Microsoft Edge abierto en $ngrokUrl"
} catch {
    try {
        Start-Process $ngrokUrl
        Write-OK "Navegador abierto en $ngrokUrl"
    } catch {
        Write-Warn "Abrelo manualmente: $ngrokUrl"
    }
}

Write-Host ""
Write-Host "  [!] Cierra esta ventana con Ctrl+C cuando termines la demo." -ForegroundColor Yellow
Write-Host "      Las ventanas de backend y frontened seguiran abiertas." -ForegroundColor Yellow
Write-Host ""

# Mantener la ventana abierta
pause
