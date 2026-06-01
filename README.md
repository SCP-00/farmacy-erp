# 🌿 Farmacy — Sistema de Gestión de Farmacias (SGF)

> 🚨 **Este proyecto SOLO usa `pnpm` como gestor de paquetes.** No uses `npm` ni `yarn` — los lockfiles no existen, los scripts fallarán, y el workspace monorepo no funcionará. Todo está configurado y verificado con `pnpm`. Si no lo tienes instalado: `corepack enable pnpm`.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11.2-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-green)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-purple)](https://www.prisma.io/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-546%20%E2%9C%85-brightgreen)](backend/src/__tests__/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

**Farmacy** es un sistema de gestión farmacéutica completo con tienda B2C integrada, panel administrativo POS, control de inventario FEFO (*First Expired, First Out*), programa de fidelidad con puntos, y múltiples pasarelas de pago (Wompi, Stripe, MercadoPago, Efectivo). Desarrollado como proyecto académico para la **Universidad Tecnológica de Pereira (UTP)**.

---

## ✨ Características principales

### 🏪 Tienda B2C (pública)
- Catálogo de productos con filtros por categoría, laboratorio, precio y receta médica
- Carrito de compras con verificación FEFO + alertas de alérgenos
- Autenticación por email + **Google OAuth**
- **Programa de puntos / fidelidad** — 1 punto por cada $100 COP gastados
- **Chatbot** de atención al cliente con horario configurable
- **SSR/SSG** — Pre-renderizado de top 100 productos + categorías populares
- Perfil de salud del cliente (alérgenos, condiciones preexistentes)

### 🏥 Panel Administrativo (POS)
- **Punto de Venta (POS)** con búsqueda y escaneo de productos
- **Control de Caja**: apertura/cierre con arqueo y descuadres
- **Inventario FEFO**: gestión de lotes con fechas de vencimiento
- **Compras y Proveedores**: órdenes de compra y recepción de mercancía
- **Clientes**: historial de compras, fidelidad, devoluciones
- **Empleados**: gestión de usuarios con **RBAC** (ADMINISTRADOR / FARMACEUTA / AUXILIAR)
- **Reportes**: ventas, inventario, compras, exportación CSV
- **Tiempo real**: WebSocket + SSE para dashboard en vivo + POS concurrente
- **Notificaciones Push**: alertas de inventario en tiempo real multi-dispositivo

### 💳 Pagos (4 pasarelas)

| Pasarela | Sandbox | Estado |
|---|---|---|
| **Wompi** (Colombia) | `pub_test_*`, `prv_test_*` | ✅ Anti-replay + HMAC |
| **Stripe** | `pk_test_*`, `sk_test_*` | ✅ Webhook con firma |
| **MercadoPago** | `TEST-*` access token | ✅ Sandbox configurado |
| **Efectivo** (POS) | — | ✅ Sin pasarela externa |

### 🔐 Seguridad
- **RBAC**: 3 roles con permisos granulares
- **JWT** con refresh token rotation y blacklisting en Redis
- **Rate limiting** por endpoint (auth: 10/min, webhook: 60/min, búsqueda: 60/min)
- **Anti-replay**: nonce + timestamp + HMAC en webhooks de pago
- **Secret scanning**: GitHub Actions con Gitleaks en todos los PRs
- **Contraseñas**: hasheadas con bcryptjs

---

## 🏗️ Arquitectura

```
Farmacy/
├── backend/                # API REST (Express + TypeScript + Prisma)
│   ├── src/modules/        # 19 módulos (auth, productos, ventas, caja, etc.)
│   ├── src/services/       # Servicios compartidos (inventario, SSE, WebSocket)
│   ├── src/__tests__/      # 28 archivos, 546 tests
│   └── src/jobs/           # BullMQ workers (alertas, export CSV)
├── frontend/               # SPA (React 19 + Vite 6 + Tailwind CSS 4)
│   ├── src/pages/tienda/   # 15 páginas B2C
│   ├── src/pages/admin/    # 20+ páginas administrativas
│   └── src/pages/auth/     # 7 páginas de autenticación
├── database/               # Prisma schema (17 modelos) + Seeds + SQL queries
├── docs/                   # Documentación técnica
├── e2e/                    # Tests E2E con Playwright
├── docker-compose.dev.yml  # Postgres + Redis + pgAdmin (desarrollo)
├── docker-compose.yml      # Producción completa (backend + frontend + DB)
├── run.ps1                 # Inicio rápido — PowerShell (recomendado)
├── setup.bat               # Setup inicial (Windows)
├── setup.sh                # Setup inicial (Linux / macOS)
└── .env.example            # Template de variables de entorno
```

---

## 💾 Persistencia de Datos

**Sí, los datos sobreviven a reinicios y caídas.** La arquitectura garantiza persistencia en 3 capas:

| Capa | Tecnología | Volumen Docker | ¿Sobrevive a reinicio? |
|---|---|---|---|
| **PostgreSQL** | postgres:15-alpine | `farmacy_pg_data_dev` | ✅ **Sí** — datos en disco del host |
| **Redis** | redis:7-alpine + AOF | `farmacy_redis_data_dev` | ✅ **Sí** — append-only file en disco |
| **Carrito B2C** | Zustand + localStorage | — | ✅ **Sí** — persiste en navegador |

> **⚠️** `docker compose down -v` borra los volúmenes y **TODOS los datos se pierden**. No uses `-v` a menos que quieras resetear la base de datos.

---

## 💰 Programa de Fidelidad

| Concepto | Valor |
|---|---|
| **Ganancia** | 1 punto por cada $100 COP del total final pagado |
| **Canje** | 1 punto = $1 COP de descuento en la próxima compra |
| **Expiración** | 1 año después de la última compra |
| **Asignación** | Automática en `VentasService.registrarVenta()` — transacción atómica |
| **Pago en efectivo** | Seleccionar cliente en POS → los puntos se asignan automáticamente |

---

## 🚀 Inicio rápido

### Prerrequisitos

| Herramienta | Versión | Cómo verificar |
|---|---|---|
| [Node.js](https://nodejs.org/) | ≥ 18 | `node --version` |
| [pnpm](https://pnpm.io/) | ≥ 8 | `pnpm --version` |
| [Docker](https://docs.docker.com/engine/install/) | Cualquiera | `docker info` |

> **⚠️ Windows:** Usa [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### Windows (PowerShell)

```powershell
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/farmacy.git
cd farmacy

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus valores reales
# REQUERIDO: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, JWT_CLIENTE_SECRET

# 3. Iniciar PostgreSQL y Redis con Docker
docker compose -f docker-compose.dev.yml up -d

# 4. Setup automático (instala dependencias, genera Prisma, corre seeds)
setup.bat

# 5. Iniciar backend y frontend
.\run.ps1

# 6. Abrir en el navegador
#    Tienda: http://localhost:5173
#    Admin:  http://localhost:5173/admin/login
```

### Linux / macOS

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/farmacy.git
cd farmacy

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus valores reales

# 3. Iniciar PostgreSQL y Redis con Docker
docker compose -f docker-compose.dev.yml up -d

# 4. Setup automático
chmod +x setup.sh && ./setup.sh

# 5. Iniciar backend (Terminal 1)
cd backend && pnpm run dev

# 6. Iniciar frontend (Terminal 2)
cd frontend && pnpm run dev

# 7. Abrir en el navegador
#    Tienda: http://localhost:5173
#    Admin:  http://localhost:5173/admin/login
```

---

## 🔧 Variables de entorno

### Requeridas

| Variable | Propósito |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `JWT_SECRET` | Firma de tokens JWT (mín. 32 caracteres) |
| `JWT_REFRESH_SECRET` | Firma de refresh tokens (mín. 32 caracteres) |
| `JWT_CLIENTE_SECRET` | Firma de tokens de clientes (mín. 32 caracteres) |

### Opcionales

| Variable | Funcionalidad |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth — login social |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Envío de emails (verificación, recuperación de password) |
| `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_KEY` | Pagos Wompi (Colombia) |
| `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Pagos Stripe |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY` | Pagos MercadoPago |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Notificaciones Push |

### Credenciales de desarrollo (seeds)

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@farmacy.co` | `Admin@1234` |
| Farmacéuta | `farmaceuta@farmacy.co` | `Farm@1234` |
| Auxiliar | `auxiliar@farmacy.co` | `Aux@1234` |
| Cliente demo | `cliente@ejemplo.co` | `Cliente@1234` |

---

## 🧪 Tests

| Suite | Comando | Tests |
|---|---|---|
| Backend | `cd backend && pnpm test` | 546 tests (28 archivos) |
| Coverage | `cd backend && pnpm test -- --coverage` | 95.35% statements |
| Frontend | `cd frontend && pnpm test` | Tests de componentes |
| E2E | `pnpm run e2e` | Playwright con Chromium |

---

## 📚 Documentación

| Documento | Descripción |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Arquitectura detallada del sistema |
| [docs/api-routes.md](docs/api-routes.md) | 72 endpoints, 40+ páginas, matriz RBAC |
| [docs/features/b2c.md](docs/features/b2c.md) | B2C, persistencia, puntos de fidelidad |
| [docs/features/payments.md](docs/features/payments.md) | Pasarelas de pago, efectivo, contra entrega |
| [docs/security/compliance.md](docs/security/compliance.md) | Pentest, seguridad, INVIMA, persistencia DB |
| [docs/deploy-guide.md](docs/deploy-guide.md) | Guía paso a paso para deploy en VPS con Docker |
| [docs/monitoreo.md](docs/monitoreo.md) | Rutina operativa de monitoreo y checklist de deploy |

---

## 🔐 Seguridad

> ⚠️ Este repositorio está diseñado para ser público.

| Medida | Estado |
|---|---|
| `.env` en `.gitignore` | ✅ Ignorado por git |
| `.env.example` con placeholders | ✅ Valores genéricos, seguros para commit |
| Seeds con datos ficticios | ✅ Solo datos demo de desarrollo |
| Sin API keys en código fuente | ✅ Todas las claves vía variables de entorno |
| Secret scanning automático | ✅ Gitleaks en todos los PRs |

### Antes de hacer público el repo

1. **Rotar secrets de desarrollo** — Genera nuevas claves en cada consola.
2. **Verificar historial de git:**
   ```bash
   git log --all -p -S "sk_test_" -- .env
   ```
3. **Configurar Google OAuth** manualmente en [Google Cloud Console](https://console.cloud.google.com/apis/credentials).

---

## 🐳 Docker

### Desarrollo (solo DB)

```bash
docker compose -f docker-compose.dev.yml up -d
```

PostgreSQL 15 (puerto 5432), Redis 7 (6379), pgAdmin (5050).

### Producción (full stack)

```bash
docker compose up -d --build
```

Backend + Frontend + PostgreSQL + Redis + Caddy (SSL automático).

---

## 📄 Licencia

MIT — Ver [LICENSE](LICENSE) para más detalles.

---

## 🏫 Proyecto académico

Desarrollado para la **Universidad Tecnológica de Pereira (UTP)** — Ingeniería de Sistemas y Computación.
