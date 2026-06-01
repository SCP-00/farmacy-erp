<#
.SYNOPSIS
  FARMACY - Inicio de Aplicacion (PowerShell)
.DESCRIPTION
  Script principal para iniciar el entorno de desarrollo de Farmacy.
  - Verifica Node.js, pnpm y Docker
  - Levanta PostgreSQL + Redis con docker compose
  - Inicia backend (Express :3000) y frontend (Vite :5173)
  - Healthcheck automatico hasta que el backend responda
  - Abre el navegador en la app

.NOTES
  Ejecutar desde PowerShell:  .\run.ps1
  Recomendado: .\run.ps1 (PowerShell)

  ⚠️  NO ejecutes este script desde Git Bash ni otras shells MSYS/Cygwin.
      MSYS traduce rutas que empiezan con / (como /api/v1) a rutas
      de Windows (C:/Program Files/Git/api/v1), lo que rompe todas
      las rutas de la API. Usa PowerShell nativo.
#>

#requires -Version 5.1

# ============================================================
# CONFIGURACION
# ============================================================

# Cambia a $true si ejecutas en SSH/WSL/Codespaces (sin GUI)
$HEADLESS = $false

# Duracion maxima del healthcheck del backend (segundos)
$HEALTHCHECK_TIMEOUT = 90
# Intervalo entre intentos del healthcheck (segundos)
$HEALTHCHECK_INTERVAL = 2
# Tiempo maximo de espera para que Docker (PostgreSQL+Redis) este saludable
$DOCKER_HEALTH_TIMEOUT = 30

# Ruta raiz del proyecto
$ROOT = $PSScriptRoot
if (-not $ROOT) { $ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $ROOT

# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

function Write-Step {
    param(
        [int]$Num,
        [int]$Total,
        [string]$Message
    )
    Write-Host " " -NoNewline
    Write-Host "[$Num/$Total]" -ForegroundColor Cyan -NoNewline
    Write-Host " $Message"
}

function Write-StepLabel {
    param([string]$Label, [string]$Message)
    Write-Host " " -NoNewline
    Write-Host "[$Label]" -ForegroundColor DarkGray -NoNewline
    Write-Host " $Message"
}

function Write-OK {
    param([string]$Message)
    Write-Host "   [v] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Skip {
    param([string]$Message)
    Write-Host "   [!!] " -ForegroundColor Yellow -NoNewline
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

function Write-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  +----------------------------------------------+" -ForegroundColor Cyan
    Write-Host "  |     FARMACY - Inicio de Aplicacion           |" -ForegroundColor Cyan
    Write-Host "  +----------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""
}

function Test-CommandAvailable {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-ProcessOnPort {
    param([int]$Port)
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($conn) {
            return $conn.OwningProcess
        }
    } catch {
        # No admin rights or other issue
    }
    return $null
}

# Procesos que NUNCA deben ser terminados (Codebuff / freebuff)
$script:SAFE_PROCESS_NAMES = @('freebuff', 'codebuff')

function Stop-ProcessOnPort {
    <#
    .SYNOPSIS
      Mata procesos zombies en un puerto especifico.
    .DESCRIPTION
      Verifica que el proceso NO sea Codebuff/freebuff antes de matarlo.
      Si el proceso sobrevive al SIGTERM, espera y reintenta una vez.
    #>
    param(
        [int]$Port,
        [string]$Label = ''
    )

    $pids = @()
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conns) { $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique }
    } catch {}

    if (-not $pids -or $pids.Count -eq 0) {
        return $true
    }

    foreach ($pid in $pids) {
        # Obtener nombre del proceso para seguridad
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if (-not $proc) { continue }

        $procName = $proc.ProcessName.ToLower()
        $isProtected = $false
        foreach ($safe in $script:SAFE_PROCESS_NAMES) {
            if ($procName -like "*$safe*") {
                $isProtected = $true
                break
            }
        }

        if ($isProtected) {
            Write-Warn "PID $pid ($($proc.ProcessName)) es Codebuff/freebuff — NO se termina."
            return $false
        }

        # Intentar terminar
        $labelInfo = if ($Label) { " ($Label)" } else { '' }
        Write-Warn "Terminando proceso zombie PID $pid ($($proc.ProcessName))$labelInfo en puerto $Port..."
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
        } catch {
            Write-Err "No se pudo terminar PID $pid: $_"
            return $false
        }
    }

    # Esperar a que el puerto se libere
    Start-Sleep -Seconds 2

    # Verificar
    $stillOccupied = Get-ProcessOnPort -Port $Port
    if ($stillOccupied) {
        Write-Warn "Puerto $Port sigue ocupado tras 2s, esperando mas..."
        Start-Sleep -Seconds 3
        $stillOccupied = Get-ProcessOnPort -Port $Port
        if ($stillOccupied) {
            Write-Err "Puerto $Port no se pudo liberar (PID $stillOccupied persiste)"
            return $false
        }
    }

    return $true
}

function Start-HealthcheckLoop {
    $maxAttempts = [math]::Floor($HEALTHCHECK_TIMEOUT / $HEALTHCHECK_INTERVAL)
    $attempt = 0
    Write-Host "   Esperando a que el backend responda en http://localhost:3000/api/v1/health ..."

    while ($attempt -lt $maxAttempts) {
        $attempt++
        Start-Sleep -Seconds $HEALTHCHECK_INTERVAL

        try {
            $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/v1/health' `
                -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-OK "Backend respondiendo en http://localhost:3000"
                return $true
            }
        } catch {
            # Still starting, try again
        }

        if ($attempt % 5 -eq 0) {
            Write-Host "   ...intento $attempt de $maxAttempts" -ForegroundColor DarkGray
        }
    }

    return $false
}

# ============================================================
# MANEJO DE CIERRE (Ctrl+C)
# ============================================================

$script:BackendPID = $null
$script:FrontendPID = $null

function Cleanup {
    Write-Host ""
    Write-Host "  Cerrando servidores..." -ForegroundColor Yellow
    if ($script:BackendPID) {
        if ($HEADLESS) {
            Get-Job -Id $script:BackendPID -ErrorAction SilentlyContinue | Stop-Job -ErrorAction SilentlyContinue
            Get-Job -Id $script:BackendPID -ErrorAction SilentlyContinue | Remove-Job -ErrorAction SilentlyContinue
        } else {
            Stop-Process -Id $script:BackendPID -Force -ErrorAction SilentlyContinue
        }
        Write-Host "   [x] Backend detenido"
    }
    if ($script:FrontendPID) {
        if ($HEADLESS) {
            Get-Job -Id $script:FrontendPID -ErrorAction SilentlyContinue | Stop-Job -ErrorAction SilentlyContinue
            Get-Job -Id $script:FrontendPID -ErrorAction SilentlyContinue | Remove-Job -ErrorAction SilentlyContinue
        } else {
            Stop-Process -Id $script:FrontendPID -Force -ErrorAction SilentlyContinue
        }
        Write-Host "   [x] Frontend detenido"
    }
    Write-Host "  Procesos limpiados." -ForegroundColor Green
}

# Registrar el cleanup para Ctrl+C
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    $isHeadless = $false
    try { $isHeadless = [bool](Get-Variable -Name HEADLESS -Scope Script -ValueOnly -ErrorAction Stop) } catch {}
    if ($script:BackendPID) {
        if ($isHeadless) {
            Get-Job -Id $script:BackendPID -ErrorAction SilentlyContinue | Stop-Job -ErrorAction SilentlyContinue
            Get-Job -Id $script:BackendPID -ErrorAction SilentlyContinue | Remove-Job -ErrorAction SilentlyContinue
        } else {
            Stop-Process -Id $script:BackendPID -Force -ErrorAction SilentlyContinue
        }
    }
    if ($script:FrontendPID) {
        if ($isHeadless) {
            Get-Job -Id $script:FrontendPID -ErrorAction SilentlyContinue | Stop-Job -ErrorAction SilentlyContinue
            Get-Job -Id $script:FrontendPID -ErrorAction SilentlyContinue | Remove-Job -ErrorAction SilentlyContinue
        } else {
            Stop-Process -Id $script:FrontendPID -Force -ErrorAction SilentlyContinue
        }
    }
}

# ============================================================
# EJECUCION PRINCIPAL
# ============================================================

try {
    Write-Banner

    # -- [1/10] Verificar Node.js -------------------------------
    Write-Step 1 10 "Verificando Node.js..."
    if (-not (Test-CommandAvailable "node")) {
        Write-Err "Node.js no esta instalado."
        Write-Host "   Descargalo en: https://nodejs.org (version LTS)"
        Write-Host ""
        pause
        exit 1
    }
    $nodeVer = node --version
    Write-OK "Node.js detectado: $nodeVer"

    # -- [2/10] Verificar / Instalar pnpm -----------------------
    Write-Step 2 10 "Verificando pnpm..."
    if (-not (Test-CommandAvailable "pnpm")) {
        Write-Warn "pnpm no encontrado. Activando corepack para pnpm..."
        try {
            corepack enable pnpm
            if ($LASTEXITCODE -ne 0) { throw "corepack enable pnpm fallo" }
            Write-OK "pnpm activado via corepack"
        } catch {
            Write-Err "No se pudo activar pnpm. Instalalo manualmente:"
            Write-Host "   PowerShell: iwr https://get.pnpm.io/install.ps1 -useb | iex"
            Write-Host "   Web: https://pnpm.io/installation"
            pause
            exit 1
        }
    }
    $pnpmVer = pnpm --version
    Write-OK "pnpm detectado: v$pnpmVer"

    # -- [3/10] Verificar Docker ---------------------------------
    Write-Step 3 10 "Verificando Docker..."
    if (-not (Test-CommandAvailable "docker")) {
        Write-Err "Docker no esta instalado o no esta en el PATH."
        Write-Host "   Instala Docker Desktop: https://www.docker.com/products/docker-desktop"
        pause
        exit 1
    }
    try {
        $dockerInfo = docker info --format '{{.OSType}}' 2>$null
        if (-not $dockerInfo) { throw "Docker daemon no responde" }
        Write-OK "Docker detectado y funcionando"
    } catch {
        Write-Err "Docker esta instalado pero no esta corriendo."
        Write-Host "   Abre Docker Desktop y espera a que este listo."
        pause
        exit 1
    }

    # -- [4/10] Verificar y liberar puertos ---------------------
    Write-Step 4 10 "Verificando y liberando puertos 3000 y 5173..."

    # --- Puerto 3000 (Backend) ---
    $port3000 = Get-ProcessOnPort -Port 3000
    if ($port3000) {
        $killed = Stop-ProcessOnPort -Port 3000 -Label 'backend'
        if ($killed) {
            Write-OK "Puerto 3000 liberado (proceso zombie eliminado)"
        } else {
            Write-Warn "Puerto 3000 puede seguir ocupado — el backend podria fallar al iniciar"
            Write-Host "   Para liberarlo manualmente:  Stop-Process -Id $port3000 -Force"
        }
    }

    # --- Puerto 5173 (Frontend) ---
    $port5173 = Get-ProcessOnPort -Port 5173
    if ($port5173) {
        $killed = Stop-ProcessOnPort -Port 5173 -Label 'frontend'
        if ($killed) {
            Write-OK "Puerto 5173 liberado (proceso zombie eliminado)"
        } else {
            Write-Warn "Puerto 5173 puede seguir ocupado — el frontend podria fallar al iniciar"
            Write-Host "   Para liberarlo manualmente:  Stop-Process -Id $port5173 -Force"
        }
    }

    # --- Verificacion final ---
    $port3000 = Get-ProcessOnPort -Port 3000
    $port5173 = Get-ProcessOnPort -Port 5173
    if (-not $port3000 -and -not $port5173) {
        Write-OK "Puertos 3000 y 5173 disponibles"
    }

    # Advertencia MSYS: verificar si el backend se ejecuto desde Git Bash
    # (La variable MSYSTEM solo existe en shells MSYS)
    if ($env:MSYSTEM) {
        Write-Warn "Estas ejecutando este script desde un shell MSYS ($($env:MSYSTEM))"
        Write-Host "   run.ps1 inicia los servidores via PowerShell nativo, asi que no hay problema."
        Write-Host "   Pero si ejecutas comandos directamente (pnpm run dev) desde esta terminal,"
        Write-Host "   MSYS traduce /api/v1 -> C:/Program Files/Git/api/v1 y rompe las rutas API."
        Write-Host "   Para evitarlo:  MSYS2_ARG_CONV_EXCL='*' pnpm run dev"
        Write-Host "   O mejor:  .\run.ps1 desde PowerShell nativo."
    }

    # -- [5/10] Verificar .env -----------------------------------
    Write-Step 5 10 "Verificando archivo .env..."
    $envPath = Join-Path $ROOT ".env"
    $envExamplePath = Join-Path $ROOT ".env.example"

    if (-not (Test-Path $envPath)) {
        if (Test-Path $envExamplePath) {
            Write-Warn ".env no existe. Creando desde .env.example..."
            Copy-Item $envExamplePath $envPath
            Write-OK ".env creado desde .env.example"
            Write-Host ""
            Write-Host "  [!] [AVISO] Se creo .env desde .env.example." -ForegroundColor Yellow
            Write-Host "  Revisa y ajusta los valores antes de continuar." -ForegroundColor Yellow
            Write-Host "  (especialmente JWT_SECRET, JWT_CLIENTE_SECRET, etc.)" -ForegroundColor Yellow
            Write-Host ""
            pause
        } else {
            Write-Err "No se encuentra .env ni .env.example"
            pause
            exit 1
        }
    } else {
        Write-OK ".env encontrado"
    }

    # -- [6/10] Instalar dependencias si faltan -----------------
    Write-Step 6 10 "Verificando dependencias..."
    $rootModules = Join-Path $ROOT "node_modules"

    # En pnpm workspaces, si existe node_modules raiz, las dependencias
    # de backend/frontend estan resueltas por el monorepo.
    if (-not (Test-Path $rootModules)) {
        Write-Skip "node_modules no encontrado. Instalando dependencias..."
        try {
            Push-Location $ROOT
            pnpm install
            if ($LASTEXITCODE -ne 0) { throw "pnpm install fallo" }
            Write-OK "Dependencias instaladas"
        } catch {
            Write-Err "Fallo pnpm install: $_"
            pause
            exit 1
        } finally {
            Pop-Location
        }
    } else {
        Write-OK "Dependencias listas"
    }

    # -- Generar Prisma Client ---------------------------------
    Write-StepLabel "6a" "Generando Prisma Client..."
    try {
        Push-Location (Join-Path $ROOT "backend")
        $prismaSchema = Join-Path (Join-Path (Join-Path $ROOT "database") "prisma") "schema.prisma"
        npx prisma generate --schema=$prismaSchema 2>&1 | Out-Null
        if (-not $?) { throw "prisma generate fallo" }
        Write-OK "Prisma Client generado"
    } catch {
        Write-Err "Fallo prisma generate: $_"
        Write-Warn "Puedes ejecutarlo manualmente: cd backend && pnpm run db:generate"
    } finally {
        Pop-Location
    }

    # -- [7/10] Levantar Docker (PostgreSQL + Redis) ------------
    Write-Step 7 10 "Levantando contenedores Docker..."
    $composeFile = Join-Path $ROOT "docker-compose.dev.yml"
    try {
        Push-Location $ROOT
        docker compose -f $composeFile up -d
        if ($LASTEXITCODE -ne 0) { throw "docker compose fallo" }
        Write-OK "Contenedores iniciados"
    } catch {
        Write-Err "Fallo al levantar contenedores Docker: $_"
        pause
        exit 1
    } finally {
        Pop-Location
    }

    # -- [7a] Esperar a que PostgreSQL y Redis esten saludables --
    Write-StepLabel "7a" "Esperando a que PostgreSQL y Redis esten listos..."
    $dbReady = $false
    $redisReady = $false
    $dockerAttempts = 0
    $maxDockerAttempts = [math]::Floor($DOCKER_HEALTH_TIMEOUT / 2)

    while ((-not $dbReady -or -not $redisReady) -and $dockerAttempts -lt $maxDockerAttempts) {
        $dockerAttempts++
        Start-Sleep -Seconds 2

        if (-not $dbReady) {
            try {
                $pgCheck = docker exec farmacy_postgres_dev pg_isready -U farmacy_user -d farmacy_db 2>$null
                if ($LASTEXITCODE -eq 0) { $dbReady = $true }
            } catch {}
        }
        if (-not $redisReady) {
            try {
                $redisCheck = docker exec farmacy_redis_dev redis-cli ping 2>$null
                if ($redisCheck -match 'PONG') { $redisReady = $true }
            } catch {}
        }

        if ($dockerAttempts % 5 -eq 0) {
            $status = @()
            if (-not $dbReady) { $status += 'PostgreSQL' }
            if (-not $redisReady) { $status += 'Redis' }
            Write-Host "   ...esperando $($status -join ', ') (intento $dockerAttempts de $maxDockerAttempts)" -ForegroundColor DarkGray
        }
    }

    if (-not $dbReady) {
        Write-Err "PostgreSQL no se pudo conectar despues de $DOCKER_HEALTH_TIMEOUT segundos."
        Write-Host "   Verifica: docker logs farmacy_postgres_dev" -ForegroundColor Yellow
        pause
        exit 1
    }
    if (-not $redisReady) {
        Write-Err "Redis no se pudo conectar despues de $DOCKER_HEALTH_TIMEOUT segundos."
        Write-Host "   Verifica: docker logs farmacy_redis_dev" -ForegroundColor Yellow
        pause
        exit 1
    }
    Write-OK "PostgreSQL y Redis listos"

    # -- [7b] Ejecutar migraciones de Prisma -----------------
    Write-StepLabel "7b" "Ejecutando migraciones de base de datos..."
    try {
        Push-Location (Join-Path $ROOT "backend")
        $prevDbUrl = $env:DATABASE_URL
        $env:DATABASE_URL = 'postgresql://farmacy_user:farmacy_pass@localhost:5432/farmacy_db'
        npx prisma migrate deploy --schema=../database/prisma/schema.prisma 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Migraciones ejecutadas"
        } else {
            Write-Warn "migrate deploy fallo, intentando db push..."
            npx prisma db push --schema=../database/prisma/schema.prisma 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-OK "Esquema aplicado via db push"
            } else {
                Write-Warn "No se pudo aplicar el esquema - el backend podria fallar"
            }
        }
        $env:DATABASE_URL = $prevDbUrl
    } catch {
        Write-Warn "Error en migraciones: $_"
    } finally {
        Pop-Location
    }

    # -- [7c] Cargar seeds (datos iniciales) -----------------
    Write-StepLabel "7c" "Cargando seeds de la base de datos..."
    try {
        Push-Location (Join-Path $ROOT "backend")
        pnpm run db:seed 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Seeds ejecutados"
        } else {
            Write-Warn "Seeds fallaron (puede ser normal si la DB ya tiene datos)"
        }
    } catch {
        Write-Warn "Error al ejecutar seeds: $_"
    } finally {
        Pop-Location
    }

    # -- [8/10] Verificar dependencias de sub-paquetes -----------
    Write-Step 8 10 "Verificando dependencias de backend/frontend..."
    foreach ($pkg in @('backend', 'frontend')) {
        $pkgDir = Join-Path $ROOT $pkg
        $pkgModules = Join-Path $pkgDir 'node_modules'
        if (-not (Test-Path $pkgModules)) {
            Write-Skip "$pkg/node_modules no encontrado. Ejecutando pnpm install..."
            try {
                Push-Location $pkgDir
                pnpm install
                if ($LASTEXITCODE -ne 0) { throw "pnpm install fallo en $pkg" }
                Write-OK "Dependencias de $pkg instaladas"
            } catch {
                Write-Err "Fallo pnpm install en $pkg: $_"
            } finally {
                Pop-Location
            }
        } else {
            Write-OK "$pkg dependencias listas"
        }
    }

    # -- [9/10] Iniciar servidores -------------------------------
    Write-Step 9 10 "Iniciando servidores..."
    Write-Host ""

    # Configurar variables de entorno para los procesos hijos
    $backendDir = Join-Path $ROOT "backend"
    $frontendDir = Join-Path $ROOT "frontend"

    if ($HEADLESS) {
        # Modo headless: procesos ocultos
        $backendJob = Start-Job -ScriptBlock {
            param($dir) Set-Location $dir; pnpm run dev
        } -ArgumentList $backendDir
        $frontendJob = Start-Job -ScriptBlock {
            param($dir) Set-Location $dir; pnpm run dev
        } -ArgumentList $frontendDir
        $script:BackendPID = $backendJob.Id
        $script:FrontendPID = $frontendJob.Id
        Write-OK "  [Headless] Backend Job ID: $($backendJob.Id)"
        Write-OK "  [Headless] Frontend Job ID: $($frontendJob.Id)"
    } else {
        # Modo normal: ventanas separadas
        # Intentar con pwsh.exe primero, fallback a powershell.exe
        $shellExe = "powershell.exe"
        if (Get-Command "pwsh.exe" -ErrorAction SilentlyContinue) {
            $shellExe = "pwsh.exe"
        }

        $backendProcess = Start-Process -FilePath $shellExe `
            -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; pnpm run dev" `
            -WindowStyle Normal -PassThru
        $script:BackendPID = $backendProcess.Id

        $frontendProcess = Start-Process -FilePath $shellExe `
            -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; pnpm run dev" `
            -WindowStyle Normal -PassThru
        $script:FrontendPID = $frontendProcess.Id

        Write-Host "   Backend  -> PID: $($backendProcess.Id)" -ForegroundColor Green
        Write-Host "   Frontend -> PID: $($frontendProcess.Id)" -ForegroundColor Green
        Write-Host "   (Shell: $shellExe)" -ForegroundColor DarkGray
    }

    # -- [10/10] Healthcheck --------------------------------------------
    Write-Host ""
    Write-StepLabel "10/10" "Verificando salud del backend..."
    $healthOK = Start-HealthcheckLoop

    if (-not $healthOK) {
        Write-Err "El backend no respondio despues de $HEALTHCHECK_TIMEOUT segundos."
        Write-Host "   Verifica que no haya errores en la ventana del backend."
        Write-Host "   Timeout configurable en `$HEALTHCHECK_TIMEOUT en run.ps1"
        Write-Host ""
        pause
        exit 1
    }

    # -- Abrir navegador ----------------------------------------
    Write-StepLabel "--" "Abriendo navegador..."
    Start-Sleep -Seconds 1
    try {
        Start-Process "msedge" -ArgumentList "http://localhost:5173"
        Write-OK "Microsoft Edge abierto en http://localhost:5173"
    } catch {
        try {
            # Fallback al navegador predeterminado si Edge no esta disponible
            Start-Process "http://localhost:5173"
            Write-OK "Navegador predeterminado abierto en http://localhost:5173"
        } catch {
            Write-Warn "No se pudo abrir el navegador automaticamente"
            Write-Host "   Abrelo manualmente: http://localhost:5173"
        }
    }

    # -- Exito --------------------------------------------------
    Write-Host ""
    Write-Host "  +----------------------------------------------+" -ForegroundColor Cyan
    Write-Host "  |  Farmacy iniciado correctamente!             |" -ForegroundColor Cyan
    Write-Host "  |                                              |" -ForegroundColor Cyan
    Write-Host "  |  Frontend: http://localhost:5173              |" -ForegroundColor Green
    Write-Host "  |  Backend:  http://localhost:3000/api/v1      |" -ForegroundColor Green
    Write-Host "  |  pgAdmin:  http://localhost:5050              |" -ForegroundColor Green
    Write-Host "  |                                              |" -ForegroundColor Cyan
    Write-Host "  |  Presiona Ctrl+C en esta ventana             |" -ForegroundColor Yellow
    Write-Host "  |  para detener todo limpiamente.              |" -ForegroundColor Yellow
    Write-Host "  +----------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""

    # Mantener la ventana abierta
    if ($HEADLESS) {
        # Modo headless: esperar a que los jobs terminen o reciban senal
        Write-Host "  [Headless] Monitoreando servidores (Ctrl+C para detener)..."
        Write-Host ""
        while ($true) {
            Start-Sleep -Seconds 5
            $backendAlive = Get-Job -Id $script:BackendPID -ErrorAction SilentlyContinue
            $frontendAlive = Get-Job -Id $script:FrontendPID -ErrorAction SilentlyContinue
            if (-not $backendAlive -and -not $frontendAlive) {
                Write-Host "  Ambos servidores se detuvieron. Saliendo..." -ForegroundColor Yellow
                break
            }
            $backendState = "running"
            $frontendState = "running"
            if ($backendAlive) { $backendState = $backendAlive.State }
            if ($frontendAlive) { $frontendState = $frontendAlive.State }
            if ($backendState -ne "Running" -and $frontendState -ne "Running") {
                Write-Host "  Ambos jobs finalizaron ($backendState / $frontendState). Saliendo..." -ForegroundColor Yellow
                break
            }
        }
    } else {
        Write-Host "  Esta ventana muestra logs del proceso principal."
        Write-Host "  Puedes cerrarla con Ctrl+C cuando termines."
        Write-Host ""

        # Esperar a que el usuario presione Ctrl+C o las ventanas se cierren
        while ($true) {
            Start-Sleep -Seconds 5
            $backendAlive = Get-Process -Id $script:BackendPID -ErrorAction SilentlyContinue
            $frontendAlive = Get-Process -Id $script:FrontendPID -ErrorAction SilentlyContinue
            if (-not $backendAlive -and -not $frontendAlive) {
                Write-Host "  Ambos servidores se detuvieron. Saliendo..." -ForegroundColor Yellow
                break
            }
            if (-not $backendAlive) {
                Write-Host "  Backend detenido. Frontend sigue corriendo..." -ForegroundColor Yellow
            }
            if (-not $frontendAlive) {
                Write-Host "  Frontend detenido. Backend sigue corriendo..." -ForegroundColor Yellow
            }
        }
    }

} catch {
    Write-Host ""
    Write-Err "Error inesperado: $_"
    Write-Host ""
    pause
    exit 1

} finally {
    Cleanup
}
