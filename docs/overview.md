# Visión técnica detallada

> Todo lo que estaba en el README y un contratista no necesita en el primer vistazo: features completas, pagos, seguridad, persistencia, fidelidad, invariantes de dinero y Docker.

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
│   ├── src/__tests__/      # 30 archivos, 578 tests (+12 de integración)
│   └── src/jobs/           # BullMQ workers (alertas, export CSV)
├── frontend/               # SPA/PWA (React 19 + Vite 6 + Tailwind CSS 4)
│   ├── src/pages/tienda/   # 15 páginas B2C
│   ├── src/pages/admin/    # 20+ páginas administrativas
│   ├── src/pages/auth/     # 7 páginas de autenticación
│   └── src-tauri/          # Empaquetado escritorio Tauri v2 (.exe)
├── desktop/                # Empaquetado Electron (portable .exe)
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

## 💾 Persistencia de datos

**Sí, los datos sobreviven a reinicios y caídas.** La arquitectura garantiza persistencia en 3 capas:

| Capa | Tecnología | Volumen Docker | ¿Sobrevive a reinicio? |
|---|---|---|---|
| **PostgreSQL** | postgres:15-alpine | `farmacy_pg_data_dev` | ✅ **Sí** — datos en disco del host |
| **Redis** | redis:7-alpine + AOF | `farmacy_redis_data_dev` | ✅ **Sí** — append-only file en disco |
| **Carrito B2C** | Zustand + localStorage | — | ✅ **Sí** — persiste en navegador |

> **⚠️** `docker compose down -v` borra los volúmenes y **TODOS los datos se pierden**. No uses `-v` a menos que quieras resetear la base de datos.

---

## 💰 Programa de fidelidad

| Concepto | Valor |
|---|---|
| **Ganancia** | 1 punto por cada $100 COP de la base pagada (excluye envío) — `PUNTOS_POR_PESO` en `config_param` |
| **Canje** | 1 punto = $1 COP de descuento en la próxima compra |
| **Expiración** | `PUNTOS_VIGENCIA_DIAS` (365) desde la última compra — job diario de expiración |
| **Asignación** | Automática en `VentasService.registrarVenta()` — transacción atómica, server-side |
| **Devoluciones** | Revierten puntos ganados y re-creditan puntos usados de la venta |
| **Anti-fraude** | `puntosUsados` se recorta al saldo real; cupones validados y aplicados solo en el backend |

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

---

## 💵 Invariantes de seguridad (hardening de dinero)

> Reglas que NO se pueden romper al agregar features. Los tests las protegen.

1. **Montos y precios SIEMPRE server-side** — el cliente solo envía `productoId`, `cantidad`, código de cupón y puntos a usar. Wompi/Stripe/MercadoPago toman el monto de la venta en DB.
2. **Puntos** — `puntosUsados` se recorta al saldo real del cliente (anti-fraude); regla de ganancia única en `VentasService.registrarVenta()`.
3. **Cupones** — se validan y aplican solo contra la tabla `codigos_descuento` (vigencia, usos máximos, incremento atómico). Preview: `POST /api/v1/cupones/validar`.
4. **FEFO atómico** — `SELECT FOR UPDATE` + decrement revalidado dentro del lock; sin ventas duplicadas de stock.
5. **Pedidos huérfanos** — ventas B2C `PENDIENTE` sin pago aprobado tras 24h se marcan `EXPIRADO` y liberan stock (job horario).
6. **Config de negocio** — umbrales, tarifas y reglas viven en `config_param` (DB), no hardcodeadas.

---

## 🔐 Seguridad del repositorio

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

## 🧪 Tests

| Suite | Comando | Tests |
|---|---|---|
| Backend (unit) | `cd backend && pnpm test` | 578 tests |
| Backend (integración, DB real) | `cd backend && pnpm run test:integration` | 12 tests |
| Frontend | `cd frontend && pnpm test` | 103 tests |
| E2E | `pnpm run e2e` | Playwright con Chromium |

> Los tests de integración ejecutan la cadena completa contra PostgreSQL real: FEFO atómico `FOR UPDATE`, idempotencia offline (`ventas_sync`), cupones server-side y búsqueda sin acentos (migración `unaccent`).

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
