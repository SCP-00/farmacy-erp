#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════
#  FARMACY — Setup Universal (Linux / macOS)
#
#  Instala todas las dependencias del proyecto y prepara
#  la base de datos para desarrollo local.
#
#  Requisitos:
#    • Node.js 18+   (https://nodejs.org)
#    • Docker        (https://docs.docker.com/engine/install)
#
#  Uso:  chmod +x setup.sh && ./setup.sh
# ══════════════════════════════════════════════════════════

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║     FARMACY — Setup de Entorno Local         ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── 0. Verificar .env ───────────────────────────────────
echo "[0/7] Verificando archivo .env..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "    .env no existe. Creando desde .env.example..."
        cp .env.example .env
        echo "    [!] [AVISO] Se creo .env desde .env.example."
        echo "    Revisa los valores (especialmente JWT_SECRET, etc.)."
    else
        echo "  [ERROR] No se encuentra .env ni .env.example"
        exit 1
    fi
else
    echo "    .env encontrado."
fi
echo ""

# ── 1. Verificar Node.js ─────────────────────────────────
echo "[1/7] Verificando Node.js..."
if ! command -v node &>/dev/null; then
    echo ""
    echo "  [ERROR] Node.js no esta instalado."
    echo "  Descargalo en: https://nodejs.org"
    echo "  o usa el gestor de paquetes de tu distro."
    echo ""
    exit 1
fi
echo "    Node.js detectado: $(node --version)"

# Verificar pnpm — directo → corepack → fallback npm
# (la nueva API de corepack a veces no expone shims globales; el fallback
#  via npm siempre funciona)
if ! command -v pnpm &>/dev/null; then
    echo ""
    echo "  [INFO] pnpm no encontrado. Intentando via corepack..."
    corepack enable pnpm 2>/dev/null || true
    corepack prepare pnpm@11 --activate 2>/dev/null || true
    if ! command -v pnpm &>/dev/null; then
        echo "  [INFO] corepack no expuso pnpm. Instalando via npm (fallback)..."
        npm install -g pnpm@11 || {
            echo "  [ERROR] No se pudo instalar pnpm."
            echo "  Instalalo manualmente: npm i -g pnpm  o  https://pnpm.io/installation"
            exit 1
        }
    fi
fi
echo "    pnpm detectado:     v$(pnpm --version)"
echo ""

# ── 2. Verificar Docker ─────────────────────────────────
echo "[2/6] Verificando Docker..."
if ! command -v docker &>/dev/null; then
    echo ""
    echo "  [AVISO] Docker no esta instalado."
    echo "  El proyecto necesita PostgreSQL y Redis."
    echo "  Instala Docker: https://docs.docker.com/engine/install/"
    echo "  O usa PostgreSQL y Redis locales."
    echo ""
else
    echo "    $(docker --version)"
    if docker info &>/dev/null; then
        echo "    Docker daemon activo."
    else
        echo "  [AVISO] Docker instalado pero no corriendo."
        echo "  Inicia Docker antes de continuar."
    fi
fi
echo ""

# ── 3. Instalar dependencias ─────────────────────────────
echo "[3/6] Instalando dependencias del proyecto..."
echo ""
echo "    Instalando dependencias (raiz + backend + frontend)..."
pnpm install
echo ""

# ── 4. Generar Prisma Client ─────────────────────────────
echo "[4/6] Generando Prisma Client..."
cd "$ROOT/backend"
pnpm run db:generate && echo "    Prisma Client generado correctamente." \
    || echo "  [AVISO] No se pudo generar Prisma Client."
cd "$ROOT"
echo ""

# ── 5. Ejecutar migraciones de base de datos ────────────────
echo "[5/6] Ejecutando migraciones de base de datos..."
echo "    Asegurate de que PostgreSQL este corriendo."
echo "    Si no:  docker compose -f docker-compose.dev.yml up -d"
echo ""
cd "$ROOT/backend"
if pnpm run db:migrate:deploy 2>/dev/null; then
    echo "    Migraciones ejecutadas correctamente."
else
    echo "  [AVISO] No se pudieron ejecutar migraciones."
    echo "    Ejecutando prisma db push como fallback..."
    if pnpm run db:push 2>/dev/null; then
        echo "    Esquema aplicado correctamente via db push."
    else
        echo "  [AVISO] No se pudo aplicar el esquema."
        echo "  Verifica que PostgreSQL este corriendo y .env configurado."
    fi
fi
cd "$ROOT"
echo ""

# ── 6. Poblar base de datos con seeds ────────────────────
echo "[6/6] Poblando base de datos con datos semilla..."
cd "$ROOT/backend"
if pnpm run db:seed; then
    echo "    Datos semilla cargados correctamente."
else
    echo "  [AVISO] No se pudieron cargar los seeds."
fi
cd "$ROOT"
echo ""

# ── Fin ──────────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   Setup completado exitosamente!             ║"
echo "  ║                                              ║"
echo "  ║   Siguiente paso:                            ║"
echo "  ║   Ejecuta los servidores:                    ║"
echo "  ║                                              ║"
echo "  ║   Terminal 1:  cd farmacy/backend && pnpm run dev  ║"
echo "  ║   Terminal 2:  cd farmacy/frontend && pnpm run dev ║"
echo "  ║                                              ║"
echo "  ║   O usa tmux / screen para ambas.            ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
