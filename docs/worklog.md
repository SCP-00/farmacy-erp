# Work log

Use this log to record completed milestones and the files changed for each phase.

## 2026-05-29 — Limpieza agresiva de artefactos temporales

**Objetivo:** Eliminar residuos de ejecución que no aportaban al proyecto y que solo ensuciaban la raíz del repo o el directorio de pruebas.

### Cambios realizados
- Eliminados de la raíz:
  - `backend-output.log`
  - `backend.log`
  - `debug.log`
  - `frontend.log`
  - `server.log`
  - `nul`
- Vaciado de `test-screenshots/`:
  - screenshots PNG generados por browser E2E
  - logs `test-e2e-*.log`

### Validación
- ✅ `test-screenshots/` quedó vacío
- ✅ La raíz dejó de mostrar logs temporales y el archivo `nul`

## 2026-05-29 — Reorganización de E2E manuales + limpieza de raíz

**Objetivo:** Sacar scripts manuales sueltos de la raíz y agruparlos en una carpeta dedicada para mantener un root más limpio y con mejor separación entre entrypoints y utilidades.

### Cambios realizados
- `scripts/e2e/manual/` (NUEVO) — Carpeta para scripts E2E manuales:
  - `test-e2e-cliente.mjs`
  - `test-e2e-proveedores.mjs`
  - `test-e2e-browser.mjs`
- `package.json` — nuevos scripts:
  - `pnpm run e2e:cliente`
  - `pnpm run e2e:proveedores`
  - `pnpm run e2e:browser`
- `README.md` — árbol del proyecto y tabla de pruebas actualizados con la nueva ruta
- Eliminados de la raíz:
  - `test-e2e-cliente.mjs`
  - `test-e2e-proveedores.mjs`
  - `test-e2e-browser.mjs`

### Validación
- ✅ `node --check` para los 3 scripts movidos
- ✅ Referencias actualizadas en README y package.json

## 2026-05-28 — Fase 26: Dark mode rediseñado (paleta gris carbón profesional) + Deploy guide completa + documentación

**Objetivo:** Rediseñar dark mode de alto contraste a paleta gris carbón profesional (VS Code/Slack inspirado), y crear guía paso a paso para deploy en VPS con Docker.

### Dark mode — Paleta rediseñada

| Variable | Antes (alto contraste) | Ahora (profesional) |
|---|---|---|
| `dark-bg` | `#0A0F1A` (azul muy oscuro) | `#1e1e1e` (VS Code neutral gray) |
| `dark-surface` | `#131826` | `#252526` |
| `dark-surface-elevated` | `#1C2233` | `#2d2d2d` |
| `dark-text` | `#E8EDF5` | `#d4d4d4` (11.8:1 contraste) |
| `dark-text-muted` | `#64748B` | `#868686` (4.58:1 WCAG AA) |
| `dark-hover` | rgba(148,163,184,0.12) | rgba(255,255,255,0.07) |

Body gradient: `linear-gradient(#1e1e1e, #252526)`
Hero-panel: `linear-gradient(135deg, #1a1a2e, #16213e)`

### 7 componentes actualizados con dark mode consistente
- `CarritoDrawer.tsx`, `ProductCard.tsx`, `Dashboard.tsx` (chart grid), `PuntoVenta.tsx` (panel derecho), `ListaProductos.tsx`, `ListaClientes.tsx`

### Deploy guide
- `docs/deploy-guide.md` (NUEVO) — Guía completa paso a paso para deploy en VPS con Docker
  - Incluye: prerrequisitos, clonado, .env, Docker, Caddy SSL, healthchecks, monitoring, backup

### Archivos modificados
- `frontend/src/index.css` — Paleta dark mode completa
- `frontend/src/components/tienda/CarritoDrawer.tsx`
- `frontend/src/components/tienda/ProductCard.tsx`
- `frontend/src/pages/admin/Dashboard.tsx`
- `frontend/src/pages/admin/caja/PuntoVenta.tsx`
- `frontend/src/pages/admin/inventario/ListaProductos.tsx`
- `frontend/src/pages/admin/clientes/ListaClientes.tsx`
- `docs/deploy-guide.md` (NUEVO)
- `README.md` — Enlace a deploy-guide.md
- `docs/worklog.md` — Esta entrada

### Validaciones
- ✅ TypeScript frontend: 0 errores
- ✅ TypeScript backend: 0 errores
- ✅ APIs: health (200), categorías (8), productos (57), sucursales (2)
- ✅ Code review: aprobado

---

## 2026-05-28 — Fase 25: Backup Dockerizado + resource limits review + documentación de progreso

**Objetivo:** Integrar backup automático de PostgreSQL en Docker, evaluar resource limits contra estándares de industria, y documentar el estado completo del proyecto.

### Cambios realizados

#### 1. Backup Dockerizado
- `database/scripts/backup-docker.sh` (NUEVO) — Script de backup diseñado para ejecutarse como sidecar Docker:
  - Soporta 4 comandos: `backup`, `restore [file]`, `list`, `loop`
  - `loop` ejecuta pg_dump comprimido cada 24h (configurable vía `BACKUP_INTERVAL`)
  - Rotación automática: elimina backups > 30 días (`RETENTION_DAYS`)
  - Verificación de integridad post-backup
  - Restaura con confirmación de 5 segundos
  - Variables de entorno: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, BACKUP_DIR, RETENTION_DAYS, BACKUP_INTERVAL
- `docker-compose.yml`:
  - Nuevo servicio `db-backup` (comentado por defecto) con postgres:15-alpine + script montado
  - Nuevo volumen `farmacy_backup_data` (comentado)
  - Cabecera actualizada con requisitos e instrucciones de backup

#### 2. Documentación de Backup
- `docs/monitoreo.md` — Nueva sección 8 "Estrategia de Backup y Restore"

#### 3. Documentación de progreso
- `docs/index.md` — Estado del proyecto actualizado a 2026-05-28
- `docs/worklog.md` — Esta entrada

### Resource limits — veredicto

| Servicio | Mi asignación | Estándar industria pequeña | Veredicto |
|---|---|---|---|
| PostgreSQL | 512MB RAM, 1.0 CPU | 1-2GB, 1-2 CPU | 🟡 **Ajustado** — funcional para DB pequeña/mediana, subir a 1GB recomendado |
| Backend (Express) | 512MB RAM, 0.5 CPU | 256-512MB, 0.5-1 CPU | ✅ Normal |
| Redis | 256MB RAM, 0.5 CPU | 128-256MB, 0.25-0.5 CPU | ✅ Normal |
| Frontend (Nginx) | 128MB RAM | 64-128MB | ✅ Normal |
| Caddy | 128MB RAM, 0.25 CPU | 64-128MB | ✅ Normal |

---

## 2026-05-28 — Fase 24: Documentación completa + persistencia DB + puntos cash + cleanup repo

**Objetivo:** Responder a todas las preguntas del usuario sobre persistencia de datos, asignación de puntos en efectivo, validación de compras, seguridad, y limpiar el repo para entrega pública.

### Cambios realizados

#### 1. Documentación nueva
- `docs/features/payments.md` (NUEVO) — Documentación completa del módulo de pagos:
  - 4 pasarelas: Wompi (Colombia), Stripe, MercadoPago, Efectivo
  - Flujo completo de pago en efectivo contra entrega
  - ✅ Validación de compras reales (empleado autenticado + PagoTransaccion + webhooks)
  - 🔴 Solución: cómo asignar puntos a clientes que pagan en efectivo (seleccionar cliente en POS antes de cobrar)
  - Seguridad webhooks: anti-replay (nonce + timestamp), HMAC, IP allowlist, idempotencia
  - Programa de puntos/fidelidad: 1 punto por cada $100 COP, canje 1:1, expiración 1 año
  - Persistencia: PostgreSQL + Docker volume — no se pierde al reiniciar

- `docs/security/compliance.md` (NUEVO) — Documentación de seguridad:
  - Resultados de pentest: 109 tests (88 PASS, 0 vulnerabilidades reales)
  - OWASP ZAP passive scan: 0 alertas High/Medium/Low
  - Medidas de seguridad implementadas: JWT + refresh rotation, RBAC, rate limiting, bcryptjs, Helmet, CORS
  - Compliance colombiano INVIMA: 35+ campos regulatorios, CUM único, muestras médicas bloqueadas
  - Persistencia DB: volúmenes Docker en disco del host, verificación post-reinicio
  - Secret scanning: Gitleaks en todos los PRs

#### 2. Documentación actualizada
- `README.md` — Reescribido completamente:
  - Nueva sección 💾 **Persistencia de Datos**: tabla de capas (PostgreSQL/Redis/Carrito), verificación post-caída, advertencia `docker compose down -v`
  - Nueva sección 💰 **Programa de Puntos/Fidelidad**: tabla de concepto/valor, cómo asignar puntos en efectivo paso a paso, cómo validar compras
  - Nueva sección 🔐 **Seguridad y ofuscación — para repositorio público**: secret rotation, verificación de historial git, configuración Google OAuth
  - Variables REQUERIDAS y OPCIONALES en tabla clara
  - Enlaces a toda la documentación (features/, security/)
- `docs/index.md` — Mapa actualizado con enlaces a:
  - `features/b2c.md` (B2C, persistencia, puntos)
  - `features/payments.md` (Pagos, efectivo, contra entrega)
  - `security/compliance.md` (Pentest, seguridad, INVIMA, persistencia DB)

#### 3. Repo cleanup
- `.gitignore` — Excluidos: `scripts/tools/` (ZAP ~268MB), `sessionZAP*`, `*.tar.gz`, `*.zip`, `scripts/descargar-zap.ps1`

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores
- ✅ Tests: 536/536 pasan (28 archivos)
- ✅ Code review: aprobado (fixes menores aplicados)

---

## 2026-05-28 — Fase 23b: 3 Could-have completados — push multi-dispositivo, SSR ampliado, secret scanning en todos los PRs

**Objetivo:** Completar los 3 items Could-have pendientes del roadmap: gestión de dispositivos push, SSR ampliado a top 100 + categorías, y secret scanning en todos los PRs.

### Cambios realizados

#### 1. Push multi-dispositivo — UI de gestión en panel admin
- `backend/src/services/push.service.ts`: Agregadas funciones `listarDispositivos()` y `eliminarDispositivoPorId()`
- `backend/src/modules/push/push.routes.ts`: Nuevos endpoints `GET /push/dispositivos` y `DELETE /push/subscribir/:id`
- `frontend/src/services/index.ts`: Agregados `pushService.listarDispositivos()` y `pushService.eliminarDispositivo()`
- `frontend/src/pages/admin/configuracion/ConfigSeguridad.tsx`: Nuevo componente `DispositivosPush` con:
  - Lista de dispositivos registrados con ícono según User-Agent (Mobile/Tablet/Desktop)
  - Eliminación individual con confirmación
  - Estados: loading spinner, error con mensaje, empty state con instrucciones
  - Fecha de registro formateada
  - Dark mode completo

#### 2. SSR ampliado — Top 100 productos + categorías populares
- `frontend/scripts/prerender.mjs`:
  - Top 20 → **Top 100** productos pre-renderizados
  - Nuevo bloque de **categorías populares** (top 15): página `categoria/<slug>/index.html`
  - Fix de ReferenceError: variables `cantidadProductos`/`cantidadCategorias` declaradas en scope de `main()`
  - Log final con desglose: estáticas + productos + categorías

#### 3. Secret scanning en todos los PRs
- `.github/workflows/secret-scanning.yml`: Trigger `pull_request:` sin `branches:` para activar en **todos los PRs** (no solo a main)

### Documentación actualizada
- `plan.md`: 3 items Could-have marcados ✅, Fase 21 actualizada (top 100 + categorías)
- `docs/worklog.md`: Esta entrada

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores
- ✅ Tests: 536/536 pasan (28 archivos)
- ✅ Code review: aprobado (bug de ReferenceError en prerender corregido)

---


## 2026-05-28 — Fase 23a: Rate limiting faltante + fortalecimiento NoSQL injection

**Objetivo:** Cerrar endpoints sin rate limiting (auth, registro cliente, catálogo público) y fortalecer defensa contra NoSQL injection en chatbot, búsquedas y endpoints con `contains` de Prisma.

### 1. Rate limiting en endpoints faltantes

| Endpoint | Limiter | Límite |
|---|---|---|
| **auth** POST /refresh | `limitarCreacion` | 30/min |
| **auth** POST /logout | `limitarCreacion` | 30/min |
| **auth-cliente** POST /registro | `limitarRegistro` | **5/hora** (skip en test) |
| **auth-cliente** POST /verificar-email | `limitarCreacion` | 30/min |
| **auth-cliente** POST /recuperar-password | `limitarCreacion` | 30/min |
| **auth-cliente** POST /reset-password | `limitarCreacion` | 30/min |
| **auth-cliente** POST /logout | `limitarCreacion` | 30/min |
| **auth-cliente** POST /favoritos | `limitarCreacion` | 30/min |
| **auth-cliente** POST /devolucion-request | `limitarCreacion` | 30/min |
| **productos** GET / (admin list) | `limitarBusqueda` | 60/min |
| **productos** GET /:id (detalle público) | `limitarBusqueda` | 60/min |

**Archivos:** `backend/src/middlewares/index.ts` (nuevo `limitarRegistro`), `auth.routes.ts`, `authCliente.routes.ts`, `productos.routes.ts`

### 2. Fortalecimiento NoSQL injection

#### Chatbot (`backend/src/modules/chatbot/chatbot.routes.ts`)
- Zod schemas: `mensajeChatbotSchema` (mensaje: string max 500, sessionToken opcional), `interaccionesSchema` (productoIds: string[] 2-20, alergenos opcional)
- `validarCuerpo()` en POST / y POST /interacciones
- `sanitizarInput(input: unknown)` — type guard `typeof !== 'string'` retorna ''
- `sanitizarSessionToken(token: unknown)` — type guard `typeof !== 'string'` retorna ''
- `buscarProductos(query: string)` — type guard `typeof query !== 'string'` retorna []
- `.filter((p: unknown) => typeof p === 'string' && ...)` en split de palabras

#### Búsquedas con `contains` — Zod query validation
- **productos GET /** (`backend/src/modules/productos/productos.routes.ts`): `listarAdminSchema` + `validarQuery()`
- **auditoria GET /logs-actividad** (`backend/src/modules/auditoria/auditoria.routes.ts`): `logsQuerySchema` + `validarQuery()`
- **proveedores GET /** (`backend/src/modules/proveedores/proveedores.routes.ts`): `listarProveedoresSchema` + `validarQuery()`
- **clientes admin GET /** (`backend/src/modules/clientes/clientes.admin.routes.ts`): `listarClientesSchema` + `validarQuery()`
- **iLike() helper**: tipo cambiado de `value: string` a `value: unknown` con type guard `typeof value === 'string' ? value : ''` (defense-in-depth final antes de Prisma `contains`)

### Ajustes durante code review
- `limitarRegistro` usa `skip: () => env.NODE_ENV === 'test'` para no bloquear unit tests
- `productos GET /`: middleware order corregido a `autenticar, validarQuery(...), limitarBusqueda` (query validation antes de rate limiting)
- Chatbot: Zod schemas con valores default que pasan al handler para mensajes de error custom

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores
- ✅ Tests: 536/536 pasan (28 archivos)
- ✅ Code review: aprobado

---

## 2026-05-28 — Fase 22b: Hardening seguridad complementario — GitHub Actions fixes + pentest automation

**Objetivo:** Resolver vulnerabilidades identificadas en auditoría: mass assignment, path traversal en Cloudinary, workflows CI/CD inconsistentes, y agregar tests de penetración automatizados.

### Cambios realizados

#### 1. GitHub Actions fixes
- **ci.yml**: Prisma generate con ruta explícita (`--schema=../database/prisma/schema.prisma`), frontend build sin prerender (no hay backend en CI)
- **e2e-smoke.yml**: Playwright install con `--with-deps`, healthcheck con `-w "%{http_code}"`
- **secret-scanning.yml**: Restaurado `GITLEAKS_CONFIG: backend/.gitleaks.toml` (se había perdido en refactor anterior, el `.gitleaks.toml` está en `backend/` no en raíz)

#### 2. Mass assignment hardening
| Archivo | Cambio |
|---|---|
| `inventario.schema.ts` | Creados Zod schemas: `crearProveedorSchema`, `actualizarProveedorSchema`, `crearSucursalSchema`, `actualizarSucursalSchema` |
| `proveedores.routes.ts` | POST/PATCH con `validarCuerpo()` + `limitarCreacion` |
| `sucursales.routes.ts` | POST/PATCH con `validarCuerpo()` + `limitarCreacion` |
| `categorias.routes.ts` | PATCH con `limitarCreacion` |
| `empleados.routes.ts` | POST/PATCH con `limitarCreacion` |
| `lotes.routes.ts` | POST con `limitarCreacion` |

#### 3. Path traversal fix — Cloudinary (`imagenes.routes.ts`)
- Sanitización de `publicId` en DELETE mejorada a 4 pasos:
  1. Whitelist chars: alfanum, `_`, `-`, `/`, `.`
  2. Eliminar `..` (2+ dots consecutivos) — path traversal prevention
  3. Normalizar slashes múltiples
  4. Eliminar leading/trailing slashes

#### 4. Security tests (`backend/src/__tests__/security.test.ts` — NUEVO)
- 9 suites: SQL Injection (11 payloads), XSS (10 payloads), Path Traversal (5 payloads), Mass Assignment, Prototype Pollution, HTTP Headers, Rate Limiting, Zod Validation, Prisma Query Safety
- Helper functions que replican sanitización real del chatbot y Cloudinary

#### 5. Pentest scripts
- `scripts/security-pentest.sh`: 9 tests vía curl (existente, actualizado)
- `scripts/security-pentest.ps1`: Versión PowerShell del mismo suite (NUEVO)

### Fixes durante code review
- `sanitizarPublicId()` en test alineado con implementación real (`\.{2,}` en lugar de `\.+`, whitelist incluye `.`)
- `security-pentest.ps1`: `[System.Web.HttpUtility]::UrlEncode()` → `[System.Uri]::EscapeDataString()` (compatibilidad cross-platform)

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores
- ✅ Tests: 536/536 pasan (28 archivos, +1 security.test.ts)
- ✅ Code review: aprobado

---

## 2026-05-28 — Fase 22: Endurecimiento final — allowlist IP webhooks + rate limiting granular por endpoint

**Objetivo:** Endurecer la seguridad perimetral con allowlist de IPs por proveedor de pago (Wompi, Stripe, MercadoPago) y rate limiting granular por tipo de endpoint (creación, búsqueda, webhook).

### Cambios realizados

#### 1. IP Allowlist middleware (`backend/src/middlewares/index.ts`)
- Nueva función `verificarIpPermitida(allowedList: string[])` — fábrica de middleware Express que:
  - Si allowlist vacía: pasa con `next()` (warning logueado una vez)
  - Si allowlist configurada: verifica `req.ip` contra lista de IPs/CIDR
  - Normaliza IPv6-mapped-IPv4 (`::ffff:xxx` → `xxx`)
  - Soporta CIDR con `ipv4ANumero()` + `ipEnCidr()` helper functions
  - Retorna 403 con `{ error: 'IP no autorizada' }` si no coincide
- Helper `ipv4ANumero(ip)` — convierte IPv4 a entero de 32 bits sin signo (`>>> 0`)
- Helper `ipEnCidr(ip, cidr, bits)` — verifica si IP está dentro de rango CIDR

#### 2. Rate limiters granulares (`backend/src/middlewares/index.ts`)
- `limitarCreacion`: 30 req/min para operaciones de escritura (POST/PUT/PATCH)
- `limitarBusqueda`: 60 req/min para endpoints de búsqueda pública
- `limitarWebhook`: ahora lee `env.RATE_LIMIT_WEBHOOK_MAX` (antes hardcoded 60)
- `limitarLogin`: lee `env.RATE_LIMIT_AUTH_MAX` (antes hardcoded 10)

#### 3. Nuevas variables de entorno (`backend/src/config/env.ts`)
- `RATE_LIMIT_WEBHOOK_MAX` (default `'60'`)
- `RATE_LIMIT_CREACION_MAX` (default `'30'`)
- `RATE_LIMIT_BUSQUEDA_MAX` (default `'60'`)
- `WEBHOOK_IP_ALLOWLIST` (optional, comma-separated IPs/CIDRs)

#### 4. Trust proxy fix (`backend/src/app.ts`)
- `app.set('trust proxy', 1)` agregado **antes** de passport init
- Necesario para que `req.ip` lea la IP real detrás de Nginx en Docker

#### 5. Webhook IP allowlist en pagos (`backend/src/modules/pagos/pagos.routes.ts`)
- Creado middleware `verificarIpWebhook` desde `WEBHOOK_IP_ALLOWLIST` env var
- Aplicado a los 3 webhooks: Wompi, Stripe, MercadoPago
- Middleware order: `verificarIpWebhook → limitarWebhook → handler`

#### 6. Rate limiters en rutas existentes
| Archivo | Endpoints protegidos |
|---|---|
| `productos.routes.ts` | `POST /` (crear), `GET /buscar` (búsqueda) |
| `ventas.routes.ts` | `POST /` (crear venta), `GET /buscar` (búsqueda) |
| `compras.routes.ts` | `POST /` (crear orden) |

#### 7. .env.example
- Nuevas vars documentadas: `WEBHOOK_IP_ALLOWLIST`, `RATE_LIMIT_WEBHOOK_MAX`, `RATE_LIMIT_CREACION_MAX`, `RATE_LIMIT_BUSQUEDA_MAX`

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores
- ✅ Tests: 521/521 pasan (27 archivos)
- ✅ Code review: aprobado (2 iteraciones)

---

## 2026-05-28 — Fase 21: Pre-render SEO (SSG parcial) — Playwright prerender + sitemap dinámico + crawler middleware

**Objetivo:** Pre-renderizar landing pública con SSR/SSG parcial para SEO. Build-time prerender con Playwright para rutas públicas estáticas + productos populares, Nginx `try_files` para servir HTML pre-renderizado, crawler detection middleware opcional para deployments sin Docker, y sitemap XML dinámico desde DB.

### Cambios realizados

#### 1. Prerender script (`frontend/scripts/prerender.mjs` — NUEVO)
- Servidor HTTP estático integrado para servir `dist/` durante build
- Pre-renderiza 7 rutas públicas: `/`, `/productos`, `/quienes-somos`, `/contacto`, `/sucursales`, `/privacidad`, `/terminos`
- Playwright con User-Agent Googlebot para simular crawler
- **Espera inteligente**: `waitForFunction(() => document.title !== 'Farmacy')` para asegurar que Helmet inyectó meta tags reales
- Guarda como `nombre.html` y `nombre/index.html` (compatibilidad Nginx `try_files $uri $uri/`)
- Pre-renderiza top 20 productos vía API (graceful fallback si no hay backend disponible)
- `executablePath` configurable vía `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (para Docker Alpine con Chromium del sistema)
- `--port` y `--base` flags para uso en diferentes entornos

#### 2. Backend — Prerender middleware (`backend/src/services/prerender.service.ts` — NUEVO)
- Express middleware que detecta **28+ crawlers** por User-Agent (Googlebot, Bing, Facebook, Twitter, LinkedIn, etc.)
- Sirve HTML pre-renderizado desde disco con headers `X-Prerendered: true` y `X-Robots-Tag: index, follow`
- Soporta rutas estáticas + dinámicas (`/productos/<slug>`)
- Fallback automático: prueba `slug.html` → `slug/index.html` → SPA normal
- **Condicional:** Se activa solo si `PRERENDER_DIST_PATH` está configurado en `env.ts`

#### 3. Sitemap generador (`database/scripts/generar-sitemap.ts` — NUEVO)
- Script Prisma que conecta a DB y genera `sitemap.xml` en `frontend/public/`
- Incluye 8 URLs estáticas + top 500 productos activos (no muestras médicas)
- `lastmod` dinámico desde `producto.updatedAt`
- `SITE_URL` configurable vía env var
- Uso: `npx tsx database/scripts/generar-sitemap.ts`

#### 4. Frontend — Scripts de build (`frontend/package.json`)
- `"prerender": "node scripts/prerender.mjs"` — prerender standalone sobre dist/ existente
- `"build:seo": "pnpm run build && node scripts/prerender.mjs"` — build + prerender en un paso

#### 5. Frontend — Dockerfile multi-stage (`frontend/Dockerfile`)
- Builder stage: instala Playwright + Chromium via `apk add chromium` + `playwright install --with-deps chromium`
- `RUN pnpm run build && node scripts/prerender.mjs` — build + prerender en capa única
- Nginx config con `try_files $uri.html $uri $uri/ /index.html` — SPA fallback con preferencia SSG
- Gzip dinámico, cache de assets con hashes (1 año), HTML con cache moderado (1 hora)
- Proxy `/api/` → `backend:3000`, healthcheck endpoint

#### 6. Backend — Config + Wiring (`backend/src/config/env.ts` + `backend/src/app.ts`)
- `env.ts`: Nueva variable `PRERENDER_DIST_PATH: z.string().optional()`
- `app.ts`: Prerender middleware condicional — se activa solo si `PRERENDER_DIST_PATH` existe y el directorio es válido

#### 7. Fixes aplicados durante code review
- `prerender.mjs`: Eliminado try/catch innecesario en `executablePath`, simplificado a `process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined`
- `prerender.service.ts`: Eliminado `/carrito` de `PUBLIC_ROUTES` (consistente con prerender.mjs que lo excluye)
- `prerender.mjs`: Documentado que productos pre-render no se ejecutan en Docker build (no hay backend)

### Arquitectura

| Componente | Rol | Activa en |
|---|---|---|
| `prerender.mjs` | Build-time Playwright prerender | Docker build / `pnpm run build:seo` |
| Nginx `try_files` | Sirve HTML estático a crawlers y usuarios | Docker producción |
| `prerender.service.ts` | Crawler detection + serve (fallback) | Deploy manual sin Docker |
| `generar-sitemap.ts` | Sitemap dinámico desde DB | Manual post-deploy |

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores
- ✅ Tests: 521/521 pasan (27 archivos)
- ✅ Code review: aprobado tras 2 iteraciones de fixes

---

## 2026-05-28 — Fase 20: Notificaciones Push para alertas de inventario (Push API + VAPID)

**Objetivo:** Implementar notificaciones push nativas (Web Push API) para alertas de inventario en el panel admin, con suscripción persistente por empleado, VAPID configurable, y un service worker custom.

### Cambios realizados

#### 1. Prisma schema — PushSubscription model
- `database/prisma/schema.prisma` — Nuevo modelo `PushSubscription` con:
  - `id` (UUID), `empleadoId` (FK → Empleado), `endpoint`, `p256dh`, `auth`, `userAgent`, `creadoEn`
  - Relación inversa en `Empleado` (`pushSubscriptions`)
  - Unique compuesto `[empleadoId, endpoint]` — un empleado puede tener múltiples dispositivos
- Migración vía `prisma db push`

#### 2. Backend — Push service (`backend/src/services/push.service.ts` — NUEVO)
- `initVapid()`: Inicializa VAPID desde variables de entorno (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL)
- `guardarSuscripcion()`: UPSERT de suscripción por empleado + endpoint
- `eliminarSuscripcion()` / `eliminarTodasSuscripciones()`: Cleanup de endpoints inválidos
- `enviarAAdministradores()`: Envía push a TODOS los administradores con suscripción activa
  - Auto-cleanup de endpoints 410/404 (PushSubscription expirados o revocados)
  - Promise.allSettled para tolerancia a fallos parciales
- `enviarASucursal()`: Envía push a empleados de una sucursal específica
- `enviarAlertaInventario()`: Construye notificación tipada con tag, icono, data (url, tipo, fecha)

#### 3. Backend — Push routes (`backend/src/modules/push/push.routes.ts` — NUEVO)
- `GET /push/vapid-public-key` — Clave pública VAPID para el frontend
- `POST /push/subscribir` — Guardar suscripción (validación de endpoint, p256dh, auth)
- `DELETE /push/subscribir` — Eliminar suscripción específica o todas las del empleado
- Todas las rutas protegidas con middleware `autenticar`

#### 4. Backend — EventBus wiring (`backend/src/server.ts`)
- `initVapid()` llamado al arrancar el servidor
- EventBus `STOCK_CRITICO` e `INVENTARIO_ALERTA` → `enviarAlertaInventario()`
- Guard de validación `if (!payload?.data?.mensaje) return` antes de enviar

#### 5. Backend — Config (`backend/src/config/env.ts`)
- Nuevas variables VAPID (opcionales): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`
- Dependencias: `web-push` + `@types/web-push`

#### 6. Frontend — Service Worker custom (`frontend/sw.ts` — NUEVO)
- Migrado de `generateSW` a `injectManifest` strategy (SW custom con control total)
- **Workbox precaching**: `precacheAndRoute(self.__WB_MANIFEST)`
- **Runtime caching**: productos, categorías, sucursales, Google Fonts, icons8
- **Push event listener**: parsea JSON o muestra texto plano, con `vibrate`, `requireInteraction`, `actions`
- **Notification click handler**: enfoca ventana existente o abre nueva, navega a `data.url`
- **Navigation fallback**: `fetch` handler con `mode === 'navigate'`, fallback a `offline.html` en cache, response 503 como último recurso
- **Auto-update**: `skipWaiting()` en install + `clients.claim()` en activate
- Dependencias: `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration`

#### 7. Frontend — Push hook (`frontend/src/hooks/usePushNotifications.ts` — NUEVO)
- `usePushNotifications()` con estado completo:
  - `supported`: detección de ServiceWorker + PushManager
  - `permission`: `Notification.permission` con listener reactivo (`navigator.permissions.query`)
  - `subscribed` / `loading`: estados de suscripción
  - `subscribe()`: solicita permiso → obtiene VAPID key → `pushManager.subscribe()` → guarda en backend
  - `unsubscribe()`: elimina en backend → `pushSubscription.unsubscribe()`
- Caché de VAPID key en localStorage (`farmacy-vapid-public-key`)
- Conversión URL-safe base64 ↔ Uint8Array ↔ ArrayBuffer
- Exportado desde `frontend/src/hooks/index.ts`

#### 8. Frontend — AdminLayout PushToggle (`frontend/src/components/layout/AdminLayout.tsx`)
- Componente `PushToggle` inline con 3 estados visuales:
  - `BellOff` (desactivado, gris) — no suscrito
  - `BellRing` (verde teal) — suscrito activo
  - `Bell` con `animate-pulse` (cargando)
- Deshabilitado si permiso denegado (`opacity-40`, `cursor-not-allowed`)
- Tooltip flotante desktop: "Activar push" / "Push activado" / "Bloqueado" / "..."
- `role="alert"`, `aria-label` para accesibilidad

#### 9. Frontend — Vite config (`frontend/vite.config.ts`)
- `VitePWA` cambiado a `strategies: 'injectManifest'` con `srcDir: '.', filename: 'sw.ts'`
- Eliminado bloque `workbox` (muerto en injectManifest)
- Comentario documentando dónde se maneja el navigateFallback

#### 10. Frontend — Types (`frontend/src/vite-env.d.ts`)
- `/// <reference types="vite-plugin-pwa/inject" />` para `self.__WB_MANIFEST`
- Declaración de módulo `virtual:pwa-register`

#### 11. Dependencias agregadas
| Paquete | Ubicación | Tipo |
|---|---|---|
| `web-push` + `@types/web-push` | backend | dependency |
| `workbox-precaching` | frontend | devDependency |
| `workbox-routing` | frontend | devDependency |
| `workbox-strategies` | frontend | devDependency |
| `workbox-expiration` | frontend | devDependency |

### Fixes aplicados durante code review
1. `push.routes.ts`: `export const pushRouter: ReturnType<typeof Router> = Router()` (TS2883)
2. `usePushNotifications.ts`: Uint8Array type cast para TS6 (`as unknown as BufferSource`)
3. `server.ts`: EventBus guard `if (!payload?.data?.mensaje) return` + `String()` en lugar de `as`
4. `sw.ts`: Added navigation fallback fetch handler + response guard 503
5. `vite.config.ts`: Removed dead `workbox` block (ignored in injectManifest)

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores
- ✅ Tests: 521/521 pasan (27 archivos)
- ✅ Code review: aprobado tras 3 iteraciones de fixes

---

## 2026-05-28 — Fase 19: Polish extendido — Brotli, CDN, WebSocket chatbot, limpieza

**Objetivo:** Cerrar detalles no bloqueantes que elevan la percepción de calidad: compresión Brotli, CDN configurable, WebSocket para chatbot en vivo, y limpieza de archivos muertos.

### Cambios realizados

#### 1. Limpieza de archivos inútiles
- **Eliminados:** `backend/scripts/test-comprehensive.ts`, `backend/scripts/test-e2e.ts`, `backend/scripts/test-fases-completo.ts` (scripts de test obsoletos)
- **Eliminado:** `docs/spec/resolver-run-batch-y-migraciones.md` (spec ya resuelto en fases anteriores)
- **Eliminados:** `e2e/reports/index.html`, `e2e/results/.last-run.json` (artefactos E2E generados)
- **.gitignore actualizado:** agregadas entradas `e2e/reports/` y `e2e/results/`

#### 2. Compresión Brotli
- **Vite build:** `vite-plugin-compression` con algoritmo `brotliCompress`, extensión `.br`, threshold 1KB, `deleteOriginFile: false`
- **Express middleware:** `compression` package con threshold 512 bytes, level 6, filter que excluye SSE y WebSocket upgrades

#### 3. CDN base path configurable
- `frontend/vite.config.ts`: `base: process.env.VITE_CDN_URL || '/'`
- En producción, seteando `VITE_CDN_URL=https://cdn.ejemplo.com/`, todos los assets se sirven desde CDN

#### 4. WebSocket para chatbot en vivo
- **Backend (`websocket.service.ts`):**
  - Nuevo canal `CHATBOT` en `CANALES`
  - Nuevo type `CHATBOT` en `MensajeWS`
  - Handler `procesarChatbot()` que llama a `procesarMensaje()` desde chatbot.routes.ts
  - Responde con evento `chatbot:respuesta` directamente al cliente
- **Frontend (`hooks/index.ts`):**
  - `useChatbot()` ahora acepta `transport: 'http' | 'ws'`
  - Con `transport='ws'`: conecta WebSocket, autentica con JWT, envía mensajes como `CHATBOT`
  - Reconexión exponencial (1s→30s, max 20 intentos)
  - Timeout de 15s por mensaje vía WS con fallback transparente
  - `wsConnected` como estado reactivo

#### 5. Dependencias agregadas
| Paquete | Ubicación |
|---|---|
| `vite-plugin-compression` | frontend (devDependency) |
| `compression` + `@types/compression` | backend (dependency) |

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores
- ✅ Tests: 521/521 pasan (27 archivos)
- ✅ Code review: aprobado tras 2 iteraciones de fixes

---

## 2026-05-28 — Fase 18: CI/CD con GitHub Actions + Monitoreo operativo

**Objetivo:** Automatizar la validación y despliegue mediante GitHub Actions, y definir una rutina operativa de monitoreo con checklist de deploy.

### Cambios realizados

#### 1. CI Pipeline (`.github/workflows/ci.yml` — NUEVO)
- **Disparador:** push/PR a `main`
- **3 jobs paralelos:**
  - **Backend:** Install → Prisma generate → Typecheck → Tests (521) → Build (tsc)
  - **Frontend:** Install → Typecheck → Build (Vite)
  - **Prisma:** Validate schema → Generate client
- Service Redis incluido para ioredis/BullMQ
- Concurrencia con cancelación de runs previos
- Variables de entorno inline para CI (valores de prueba)

#### 2. Secret Scanning (`.github/workflows/secret-scanning.yml` — NUEVO)
- **Disparador:** push/PR a `main`
- Usa `gitleaks/gitleaks-action@v2` con configuración custom `backend/.gitleaks.toml`
- `fetch-depth: 0` para escanear todo el historial
- Mensaje de error claro con instrucciones para falsos positivos

#### 3. E2E Smoke (`.github/workflows/e2e-smoke.yml` — NUEVO)
- **Disparador:** `workflow_dispatch` manual o PR etiquetado `e2e-smoke`
- Servicios: PostgreSQL 15 + Redis 7 con healthchecks
- Flujo completo: Seed DB → Iniciar backend (healthcheck polling) → Iniciar frontend → Playwright → Upload report
- Filter opcional `test_filter` para correr tests específicos
- Cleanup de servidores en `always()`

#### 4. Monitoreo Operativo (`docs/monitoreo.md` — NUEVO)
- 7 secciones:
  1. Healthchecks del sistema (PostgreSQL, Redis, Backend, Frontend)
  2. Logs a revisar por fuente (backend, nginx, postgres, redis)
  3. Rutina de revisión escalonada (primera semana → estabilización)
  4. Errores críticos (🔴) vs no críticos (🟡) vs informativos (⚪)
  5. Alertas que requieren acción manual (inventario + sistema)
  6. Checklist de deploy (antes/durante/después/post-mortem 24h)
  7. Comandos útiles (Docker, backend, monitoreo continuo con cron)
- Apéndice A: Referencia rápida de variables de entorno

#### 5. Documentación actualizada
- `AGENTS.md` — Nueva sección `🚀 CI/CD — GitHub Actions` con descripción de 3 workflows y tabla de secrets
- `AGENTS.md` — Nueva sección `📊 Monitoreo operativo` con rutina rápida de 5 min
- `plan.md` — Fase 18 marcada como ✅ COMPLETADA, orden actualizado
- `docs/worklog.md` — Esta entrada

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores
- ✅ Tests: 521/521 pasan (27 archivos)
- ✅ Code review: aprobado

---

## 2026-05-27 — Fase 17: Tiempo real y jobs asíncronos

**Objetivo:** Eliminar polling innecesario y mover tareas pesadas fuera del request-response clásico mediante EventBus, SSE, WebSockets y BullMQ.

### Cambios realizados

#### 1. EventBus (`backend/src/services/eventbus.service.ts` — NUEVO)
- Singleton con `EventEmitter` para eventos de dominio
- 8 eventos tipados:
  - `dashboard:kpis-update`, `inventario:alerta` (dashboard)
  - `caja:abierta`, `caja:cerrada`, `venta:registrada` (POS)
  - `inventario:stock-critico`, `inventario:stock-ajustado` (inventario)
  - `job:completado`, `job:error` (jobs asíncronos)
- `PayloadEvento` con tipo, data y timestamp
- Métodos `emit()`, `on()`, `once()`, `removeAll()`, `stats()`
- Límite de listeners: 30 (default 10)

#### 2. SSE Service (`backend/src/services/sse.service.ts` — NUEVO)
- Distribuye eventos del EventBus a clientes SSE
- Filtro opcional por tipo de evento (via query param `?eventos=...`)
- Heartbeat cada 30s para mantener conexión viva
- Cleanup de clientes desconectados en cada heartbeat
- `sseManager.init()` escucha todos los eventos del EventBus

#### 3. WebSocket Manager (`backend/src/services/websocket.service.ts` — NUEVO)
- `ws` nativo sobre el mismo server HTTP, path `/ws`
- Autenticación JWT vía query param `?token=...`
- 4 canales tipados: `pos:caja`, `pos:ventas`, `pos:stock`, `admin:alertas`
- Suscripción por defecto según rol (ADMINISTRADOR recibe `admin:alertas`)
- Suscripción dinámica vía mensajes `SUBSCRIBE`/`UNSUBSCRIBE`
- Heartbeat ping cada 30s con auto-cleanup
- `broadcast()` a todos los clientes suscritos a un canal
- `destroy()` con cleanup completo (unsubscribes, close clients, limpiar mapa)

#### 4. BullMQ Queue + Workers (`backend/src/jobs/queue.ts` — NUEVO)
- 2 colas: `csv-export` y `emails` (emails está definida pero sin worker aún)
- Conexión Redis parseada desde `REDIS_URL` (compatible con formato `redis://...`)
- Configuración de retry: 3 intentos (csv), 5 (emails), backoff exponencial
- `removeOnComplete`: 7 días (csv), 1 día (emails)
- `removeOnFail`: 30 días (csv), 7 días (emails)
- Worker CSV con concurrencia 2, rate limiter 5/min
- Resultados persistidos en Redis (expiran 1 hora)
- Eventos JOB_COMPLETADO/JOB_ERROR emitidos al EventBus
- `obliterate` explícitamente eliminado (riesgo de borrar jobs pendientes)

#### 5. CSV Export Job (`backend/src/jobs/csv-export.job.ts` — NUEVO)
- Lógica extraída para exportar ventas/compras/inventario a CSV
- Usada por BullMQ worker y exportable para uso síncrono directo
- `obtenerCSVResultado()` para descarga async desde Redis

#### 6. SSE Route (`backend/src/modules/reportes/reportes.sse.ts` — NUEVO)
- `GET /reportes/stream` con autenticación y autorización ADMIN/FARMACEUTA
- Filtro opcional `?eventos=tipo1,tipo2` para que el cliente elija qué recibir

#### 7. Event Wiring en rutas existentes
- `backend/src/modules/ventas/ventas.routes.ts` — Emite `VentaRegistrada` tras POST /
- `backend/src/modules/caja/caja.routes.ts` — Emite `CajaAbierta` y `CajaCerrada` en POST /abrir y POST /:id/cerrar
- `backend/src/modules/inventario/inventario.routes.ts` — Emite `StockAjustado` en POST /ajuste, y `StockCritico` si stock ≤ 10

#### 8. server.ts — Inicialización ordenada
- `backend/src/server.ts`: DB → Redis → Express → SSE → HTTP → WS → Workers
- Orden correcto: iniciar SSE manager ANTES de levantar HTTP (no necesita server)
- Iniciar WS manager DESPUÉS de `app.listen()` (necesita el server HTTP)
- Iniciar Workers DESPUÉS de WS
- Cleanup en SIGTERM/SIGINT: WS → SSE → Workers → HTTP → DB

#### 9. app.ts — Mount
- `backend/src/app.ts`: Importado `sseRouter` y montado en `${prefix}/reportes`

#### 10. Frontend — Hooks `useRealtime` (`frontend/src/hooks/useRealtime.ts` — NUEVO)
- `useSSE()`:
  - Conexión fetch-based con `ReadableStream` (permite header Authorization)
  - Parseo de frames SSE: `event:`, `data:`, línea vacía = fin de frame
  - Reconexión automática con backoff exponencial (1s→30s, max 20 intentos)
  - Filtro opcional `eventos` para seleccionar qué eventos recibir
  - Retorna `{ conectado, ultimoEvento }`
- `useWS()`:
  - WebSocket con JWT en query param
  - Heartbeat PING cada 30s
  - Reconexión automática con backoff exponencial
  - Método `enviar(type, channel)` para SUBSCRIBE/UNSUBSCRIBE/PING
  - Retorna `{ conectado, ultimoEvento, enviar }`
- Exportados desde `frontend/src/hooks/index.ts`

#### 11. Dashboard actualizado con SSE (`frontend/src/pages/admin/Dashboard.tsx`)
- `useSSE` conectado para recibir eventos en vivo
- Callback `onEvent` refresca KPIs cuando llega `dashboard:kpis-update`
- Callback `onConnected` refresca datos iniciales al reconectar

#### 12. PuntoVenta actualizado con WebSocket (`frontend/src/pages/admin/caja/PuntoVenta.tsx`)
- `useWS` conectado para eventos POS
- Callback `onEvent` procesa eventos de stock crítico, caja abierta/cerrada
- Cleanup de conexión al desmontar componente

#### 13. Fixes aplicados
- `backend/src/__tests__/caja-clientes.routes.test.ts`: Agregado `abiertaEn: new Date()` a mock de `caja.create` (el nuevo evento `CAJA_ABIERTA` lee `caja.abiertaEn.toISOString()`)
- `backend/src/jobs/queue.ts`: `crearConexion()` ahora parsea `REDIS_URL` con `new URL()` en lugar de env vars separadas (compatible con el formato usado por el resto del proyecto)
- `backend/src/jobs/queue.ts`: `obliterate` eliminado (código peligroso que borraba permanentemente todos los jobs)
- `frontend/src/hooks/useRealtime.ts`: `AbortController` tipado para React 19 strict

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores
- ✅ Tests: 521/521 pasan (27 archivos)
- ✅ Code review: aprobado

---

## 2026-05-27 — Fase 16: Auditoría visible y trazabilidad de negocio

**Objetivo:** Implementar auditoría visible con historial de cambios en productos, visor de logs de actividad, rate limiting granular por rol y endurecimiento de webhooks (anti-replay, idempotencia).

### Cambios realizados

#### 1. Modelo HistorialCambio (Prisma)
- `database/prisma/schema.prisma` — Nuevo modelo `HistorialCambio` con:
  - Campos: `id` (UUID), `empleadoId` (FK → Empleado), `productoId` (FK → Producto), `campo`, `valorAnterior`, `valorNuevo`, `creadoEn`
  - Relaciones inversas en `Empleado` (`historialCambios`) y `Producto` (`historialCambios`)
  - Index compuesto por `(productoId, creadoEn)` para consultas eficientes
- Migración ejecutada vía `prisma db push`

#### 2. Endpoints de auditoría backend
- `backend/src/modules/auditoria/auditoria.routes.ts` (NUEVO):
  - `GET /logs-actividad` — Logs paginados con filtros: `desde`, `hasta`, `accion`, `modulo`, `empleadoId`, `ip`, `q` (búsqueda libre OR por ip/accion/modulo/email)
  - `GET /logs-actividad/acciones` — GroupBy de acciones disponibles para dropdowns del frontend
  - `GET /productos/:id/historial-cambios` — Historial de cambios de un producto específico
- `backend/src/app.ts` — Registro del router de auditoría

#### 3. Tracking de cambios en productos
- `backend/src/modules/productos/productos.routes.ts` — PATCH `/:id` modificado para:
  - Leer el producto ANTES de actualizar (consulta previa)
  - Comparar valores en 10 campos trackeados: `precioVenta`, `precioPromedio`, `stockMinimo`, `nombre`, `requiereRx`, `activo`, `laboratorio`, `presentacion`, `concentracion`, `descripcion`
  - Crear registros en `HistorialCambio` via `createMany` solo si hay cambios reales
  - No interfiere con la respuesta normal del PATCH

#### 4. Rate limiting granular por rol
- `backend/src/middlewares/index.ts`:
  - `limitarWebhook` — 60 req/min para endpoints de webhook (aplicado en pagos)
  - `limitarAdmin` y `limitarEscritura` fueron definidos pero eliminados por no ser aplicados a rutas específicas (código muerto)

#### 5. Webhooks hardening
- `backend/src/modules/pagos/pagos.routes.ts`:
  - **Anti-replay Wompi:** Validación de timestamp (±5 min), nonce único en memoria con cleanup cada 60s
  - **Idempotencia Wompi/Stripe/MercadoPago:** Caché en memoria con TTL 24h, cleanup automático cada 5 min
  - **Validación HMAC Wompi:** Firma SHA-256 con events secret
  - **MercadoPago:** Validación `response.ok` al consultar API de pagos (requirió `ok: true` en tests mock)
  - Rate limiter `limitarWebhook` aplicado a los 3 webhooks

#### 6. Visor de Auditoría (frontend)
- `frontend/src/pages/admin/configuracion/VisorAuditoria.tsx` (NUEVO):
  - Tabla paginada con logs de actividad
  - Filtros combinables: rango de fecha (desde/hasta), acción, módulo, búsqueda libre
  - Exportación a CSV de los registros visibles
  - Loading skeleton, empty state, dark mode completo
  - Paginación cliente-side + límite de 50 registros por página
- `frontend/src/services/index.ts` — `auditoriaService` con método `listarLogs()`
- `frontend/src/app.tsx` — Ruta `/admin/configuracion/auditoria`
- `frontend/src/components/layout/AdminLayout.tsx` — Nav item "Auditoría" con icono Shield

#### 7. Historial de cambios en DetalleProductoAdmin
- `frontend/src/pages/admin/inventario/DetalleProductoAdmin.tsx`:
  - Nuevo componente `HistorialCambios` que carga y muestra cambios del producto
  - Timeline visual con iconos por tipo de cambio
  - Muestra: empleado, campo modificado, valor anterior → nuevo, timestamp
  - Estado vacío cuando no hay cambios registrados
  - Dark mode completo

#### 8. Correcciones técnicas
- `backend/vitest.config.ts` — Alias `@prisma/client` cambiado de `.prisma/client` (directorio corrupto) a `@prisma/client` (symlink al pnpm store)
- `backend/src/__tests__/productos.routes.test.ts` — Mocks actualizados para `historialCambio.createMany` y `findUnique` previo al PATCH
- `backend/src/__tests__/pagos-pasarelas.routes.test.ts` — Agregado `ok: true` a mock fetch de MercadoPago para pasar validación de hardening
- `backend/src/middlewares/index.ts` — `limitarAdmin` y `limitarEscritura` eliminados (código muerto)

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores
- ✅ Tests: 521/521 pasan (27 archivos)
- ✅ Code review: aprobado

---

## 2026-05-26 — Fase 10: Baseline de producción — CORS, Helmet, sanitización chatbot, secret scanning

**Objetivo:** Cerrar huecos operativos y de seguridad de bajo esfuerzo con alto impacto.

### Cambios realizados

#### 1. CORS endurecido (`backend/src/app.ts` + `backend/src/config/env.ts`)
- Se agregó `CORS_ORIGINS` en `env.ts` (separado por comas, para producción)
- CORS ahora usa `env.CORS_ORIGINS` con split por comas, con fallback a localhost para desarrollo
- Se agregaron `methods`, `allowedHeaders` y `maxAge` explícitos
- Warning en producción si `CORS_ORIGINS` no está configurado

#### 2. Helmet / Security headers (`backend/src/app.ts` + `backend/src/config/env.ts`)
- Se agregó `CSP_ENABLED` en `env.ts` (default `'true'`)
- CSP configurado con directivas para: Cloudinary, Wompi, Stripe, MercadoPago, Google Fonts
- `referrerPolicy: 'strict-origin-when-cross-origin'`
- `hsts: maxAge 31536000, includeSubDomains, preload`
- `crossOriginEmbedderPolicy: false` documentado (necesario para SPA + CDN)
- Si `CSP_ENABLED=false`, cae a Helmet básico original

#### 3. Sanitización de chatbot (`backend/src/modules/chatbot/chatbot.routes.ts`)
- `sanitizarInput()`: elimina etiquetas HTML/XML, caracteres de control, limita a 500 chars
- `sanitizarSessionToken()`: solo permite `[a-zA-Z0-9\-_.]`, max 128 chars
- Aplicado en `POST /` (mensaje + sessionToken) y `POST /interacciones` (productoIds)

#### 4. Secret scanning (`backend/.gitleaks.toml`)
- Nuevo archivo con reglas personalizadas para Farmacy:
  - JWT secrets, DB URLs, Google OAuth, Stripe, MercadoPago, Wompi, Cloudinary, SMTP
- Whitelist de rutas: `.env.example`, `docs/`, `node_modules/`, tests, seeds, lockfiles
- Uso: `gitleaks detect --source . --config backend/.gitleaks.toml -v`

#### 5. HEADLESS mode (verificación)
- `run.ps1` ya usa `Get-Job` correctamente en modo headless (implementado previamente)

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ Tests: 520/520 pasan (27 archivos)
- ✅ Code review: aprobado

---

## 2026-05-26 — Fix MSYS path translation + tests + documentación

**Bug:** Al ejecutar el backend desde Git Bash (o cualquier shell MSYS/Cygwin), las rutas
que empiezan con `/` son traducidas automáticamente a rutas Windows.
Ej: `/api/v1` → `C:/Program Files/Git/api/v1`, rompiendo TODAS las rutas de la API.

### Fix implementado

- `backend/src/config/env.ts` — Zod schema de `API_PREFIX` ahora tiene un `.transform()`
  que detecta el patrón de unidad Windows (`C:/...`) y extrae la ruta original saltando
  directorios MSYS conocidos (`Program Files`, `Git`, `msys64`, `msys`, `usr`, `etc`).
  Soporta tanto `/` como `\` como separadores.

### Tests (10 casos, 16 total en env.test.ts)

| Escenario | Resultado |
|---|---|
| Default (sin `API_PREFIX`) → `/api/v1` | ✅ |
| `C:/Program Files/Git/api/v1` (Git Bash) → `/api/v1` | ✅ |
| `C:/msys64/api/v1` (MSYS2 directo) → `/api/v1` | ✅ |
| `D:/Git/api/v1` (distinta letra de unidad) → `/api/v1` | ✅ |
| `C:/Program Files/Git/usr/api/v1` (directorios extra) → `/api/v1` | ✅ |
| `C:\\Program Files\\Git\\api/v1` (backslashes Windows) → `/api/v1` | ✅ |
| `/api/v2` (prefix normal, sin MSYS) → `/api/v2` (preservado) | ✅ |
| `/api/v1/admin` (ruta profunda normal) → `/api/v1/admin` | ✅ |
| `X:/some/unknown/path` (ruta no-MSYS) → `/some/unknown/path` (drive stripped) | ✅ |
| `X:/Program Files/Git/usr/etc` (todos skipDirs) → valor original preservado | ✅ |

### Documentación asociada

- `AGENTS.md` — Nueva sección `🐛 MSYS Path Translation (Git Bash en Windows)` con:
  - Explicación del bug y síntomas
  - Código del fix en env.ts
  - Workarounds: `MSYS2_ARG_CONV_EXCL="*"`, usar PowerShell nativo
- `run.ps1` — Detección de `$env:MSYSTEM` en paso [4/8] con advertencia clara
  (run.ps1 usa PowerShell nativo para los child processes, así que no sufre el bug)
- `docs/worklog.md` — Esta entrada

### Commits

| Hash | Mensaje |
|---|---|
| `27f23a5` | `docs: bug MSYS path translation en AGENTS.md y warning en run.ps1` |
| `410b4fb` | `docs: refinar warning MSYS en run.ps1 - clarificar que no afecta al script` |
| `e559265` | `docs: resultados test MSYS fix en 3 shells + worklog` |
| `10a83be` | `test: cobertura completa MSYS path translation (9 escenarios)` |

---

## 2026-05-25 — Auditoría general y actualización documentación

Se realizó una revisión completa del proyecto y se actualizó toda la documentación.

**Estado actual del proyecto:**
- ✅ Backend TypeScript: 0 errores
- ✅ Frontend TypeScript: 0 errores
- ✅ Tests: 215 pasan, 3 fallos preexistentes (stock mínimo en alertas)
- ⚠️ 12 suites de ruta fallan por resolución de módulo `.prisma/client/default` (preexistente, no afecta funcionalidad)
- ✅ Docker: Postgres + Redis operativos (32 min up)
- ✅ Seeds ejecutadas con 17 tablas pobladas
- ✅ Schema Prisma sincronizado con BD

## 2026-05-25 — Migración Wompi a sandbox + MercadoPago integrado

**Wompi — Cambio a Sandbox:**
- Keys de producción reemplazadas por sandbox: `pub_test_*`, `prv_test_*`, `test_integrity_*`
- `WOMPI_BASE_URL` default cambiado a `https://sandbox.wompi.co/v1`
- `env.ts`: Agregado `WOMPI_INTEGRITY_SECRET` + default sandbox
- `pagos.routes.ts`: Firma HMAC-SHA256 corregida (usa integrity key, no events secret)
- `.env.example`: Agregado `WOMPI_INTEGRITY_SECRET`

**MercadoPago — Integración completa:**
- Keys sandbox escritas en `.env` y `backend/.env`
- `pagos.routes.ts`: Endpoint `/mercadopago/crear` acepta `ventaId`+`items`+`monto`+`clienteEmail` sin requerir `pedidoOnline`
- `frontend/src/services/index.ts`: `crearMercadoPago` con nuevo signature flexible
- `frontend/src/pages/tienda/Checkout.tsx`: Flujo real — crea venta → llama API MP → redirige a initPoint. Sin flash de pantalla.
- **Relación Prisma**: `PagoTransaccion.ventaId` ahora tiene FK formal con `Venta`

## 2026-05-25 — Configuración Wompi Producción

- Keys de producción Wompi configuradas en `.env` y `backend/.env`
- `WOMPI_INTEGRITY_SECRET` agregado a `env.ts` y `.env.example`
- `WOMPI_BASE_URL` default cambiado a `https://api.wompi.co/v1`
- `pagos.routes.ts`: Firma de transacciones corregida (HMAC-SHA256 con integrity key)
- Code review aprobado: 0 errores, 0 warnings

## 2026-05-24 (Full Testing + Coverage)

- **Suite completa de tests (27 archivos, 218 tests):**
  - 14 archivos pasan completamente (core services, utils, schemas, middlewares)
  - 12 archivos de ruta fallan por resolución de módulo `.prisma/client/default`
  - alertas.job.test.ts: 3 tests de stock mínimo fallan por conteo de spies
- **Documentación actualizada** con tablas de coverage y módulos

## 2026-05-24 (Segmentación de tests de ruta)

- **11 nuevos archivos de test de ruta** agregados para cubrir todos los módulos
- Tests de Stripe/MercadoPago (configurados y no configurados)
- Tests de webhooks con firma HMAC

## 2026-05-22 (Fase 7 — Pasarelas de Pago)

- Checkout visual con selector de método (Wompi, Stripe, MercadoPago, Efectivo)
- Simulación animada de pasarela con 3 pasos
- Página de confirmación standalone con query params
- Validación inline de formularios con accesibilidad aria

## 2026-05-22 (Fase INVIMA-CSV)

- Mini-CSV generado: 56 productos, 14 grupos ATC, 26 KB
- Script importar-y-generar.cjs: importación + lotes
- 121 lotes generados para 55 productos

## 2026-05-22 (Eliminación Facebook OAuth)

- Facebook OAuth eliminado completamente del proyecto
- Archivos modificados: passport.ts, auth routes, env.ts, .env.example, frontend

## 2026-05-23 (Fase 5 y 6 completadas)

- POS con escáner de códigos, arqueo de caja, tirilla térmica
- Tienda B2C con carrito, checkout FEFO, catálogo real

## 2026-05-26 — Upgrade masivo de dependencias

Se actualizaron las dependencias principales del proyecto en el branch `deps-upgrade-2026`.

**Cambios realizados:**

| Paquete | Antes → Después |
|---|---|
| Vite | 5.4.21 → **6.4.2** |
| @vitejs/plugin-react | 4.7.0 → **5.2.0** |
| TypeScript (backend) | 5.9.3 → **6.0.3** |
| TypeScript (frontend) | 5.3.3 → **6.0.3** |
| Vitest (frontend) | 1.6.1 → **3.2.4** |
| nodemailer | 8.0.7 → 8.0.8 |
| dotenv | 16.6.1 → 17.4.2 |

**Archivos modificados:**
- `run.bat`: Reescrito con verificación Docker, PowerShell port kill, healthcheck HTTP, HEADLESS mode, .env auto-creación
- `backend/src/config/env.ts`: Carga dual de `.env` (backend/.env + raíz, raíz con prioridad)
- `backend/tsconfig.json`: Agregado `ignoreDeprecations: "6.0"`
- `backend/package.json` y `frontend/package.json`: Version bumps

**Validaciones:**
- ✅ Backend TypeScript: 0 errores
- ✅ Frontend TypeScript: 0 errores
- ✅ Tests: 462/462 pasan (27 archivos)
- ✅ Vite build: exitoso (9.63s)
- ✅ pnpm store: 156MB liberados

## 2026-05-26 — Verificación del fix MSYS path translation (3 shells)

**Prueba completa del bug MSYS path translation desde 3 shells + Git Bash.**

### Pruebas realizadas

| Shell | Endpoint | Resultado |
|---|---|---|
| **PowerShell nativo** | `/api/v1/health` | ✅ 200 |
| | `/api/v1/categorias` | ✅ 200 (8 categorías) |
| | `/api/v1/sucursales` | ✅ 200 (2 sucursales) |
| **CMD** | `/api/v1/health` | ✅ 200 |
| | `/api/v1/categorias` | ✅ 200 |
| **Git Bash** (curl) | `/api/v1/health` | ✅ 200 |
| | `/api/v1/categorias` | ✅ 200 |
| | `/api/v1/sucursales` | ✅ 200 |
| **Git Bash** (backend arrancado desde bash) | `/api/v1/health` | ✅ 200 |
| | `/api/v1/categorias` | ✅ 200 |
| | `/api/v1/sucursales` | ✅ 200 |

### Fix MSYS — Unit test (6/6 casos)
| Escenario | Resultado |
|---|---|
| Path normal `/api/v1` → `/api/v1` | ✅ |
| Git Bash `C:/Program Files/Git/api/v1` → `/api/v1` | ✅ |
| MSYS2 directo `C:/msys64/api/v1` → `/api/v1` | ✅ |
| Diferente letra `D:/Git/api/v2` → `/api/v2` | ✅ |
| Directorios extra `C:/Program Files/Git/usr/api/v1` → `/api/v1` | ✅ |
| Prefix alternativo `/api/v2` → `/api/v2` | ✅ |

**Archivos involucrados:**
- `backend/src/config/env.ts` — Fix MSYS en `.transform()` de `API_PREFIX`
- `backend/src/__tests__/env.test.ts` — Tests unitarios del fix
- `AGENTS.md` — Documentación del bug y workarounds
- `run.ps1` — Detección de `$env:MSYSTEM` y advertencia en paso [4/8]

## 2026-05-26 — Validación inline en formularios admin — InputField, NuevaOrden, RecepcionMercancia, FormularioEmpleado

**Objetivo:** Agregar validación en tiempo real con feedback visual (bordes rojos, mensajes de error), estados `touched`, y atributos ARIA en los formularios admin clave.

### Cambios realizados

#### 1. Componentes reutilizables (`frontend/src/components/shared/InputField.tsx` — **nuevo**)
- `InputField` — input text/email/number/password con label, error, `aria-invalid`, `aria-describedby`, dark mode
- `SelectField` — select con label, error, placeholder, ARIA
- `TextAreaField` — textarea con label, error, ARIA
- `InputError` — mensaje de error con icono `AlertCircle`, `role="alert"`, animación `animate-fade-in`
- Todos los componentes muestran borde rojo (`border-red-400`) cuando hay error + touched, y borde teal en focus normal

#### 2. FormularioEmpleado (`frontend/src/pages/admin/empleados/components/FormularioEmpleado.tsx`)
- Migrado de raw inputs a `InputField`/`SelectField`
- Mantiene `react-hook-form` + `zod` para la validación, ahora con estilos visuales consistentes
- Password: helperText condicional (editar vs crear), toggle de visibilidad con `Eye`/`EyeOff`

#### 3. NuevaOrden (`frontend/src/pages/admin/compras/NuevaOrden.tsx`)
- Validación inline: `proveedorId` requerido, `fechaEntrega` no pasada, `notas` max 500 chars
- Touch tracking (`tocados`) + errores en vivo al escribir si el campo ya fue tocado
- Validación de items: al menos 1 producto, cantidades/precios válidos
- Botón "Crear orden" valida todo antes de mutar, con `toast.error` si hay errores
- Dark mode completo en toda la página

#### 4. RecepcionMercancia (`frontend/src/pages/admin/compras/RecepcionMercancia.tsx`)
- Validación inline **por lote**: `codigoLote` requerido (3-50 chars, alfanumérico), `fechaVencimiento` futura, `cantidad >= 1`, `precio >= 0`
- Touch tracking individual por campo dentro de cada lote (`Record<string, Partial<Record<CampoLote, boolean>>>`)
- Errores en vivo al cambiar si el campo ya fue tocado
- Validación al enviar que marca **todos** los campos de todos los lotes como tocados
- Dark mode completo

### Validaciones
- ✅ TypeScript frontend: 0 errores
- ✅ Vite build: exitoso (5.52s)
- ✅ Code review: aprobado (3 detalles corregidos: helperText duplicado, límite cantidad inconsistente, IIFE simplificado)

---

## 2026-05-26 — Fase 11: UX Core POS + Admin — shortcuts, skeletons, dark mode

**Objetivo:** Mejorar la experiencia de usuario del POS y el panel admin con atajos de teclado, loaders esqueléticos, estados vacíos y cobertura de modo oscuro.

### Cambios realizados

#### 1. Skeleton loaders reutilizables (`frontend/src/components/shared/Skeleton.tsx` — **nuevo**)
- `SkeletonText` — línea de texto animada
- `SkeletonBlock` — bloque rectangular animado
- `SkeletonCard` — card completa con icono + líneas
- `SkeletonTable` — tabla animada con header + filas configurables
- `SkeletonChart` — barras de gráfico animadas con alturas aleatorias
- Todos con soporte dark mode (`dark:bg-dark-border`)

#### 2. EmptyState reutilizable (`frontend/src/components/shared/EmptyState.tsx` — **nuevo**)
- Componente genérico con icono, título, descripción, acción opcional
- Variante `compact` para espacios reducidos
- Clases dark mode

#### 3. Keyboard shortcuts en POS (`frontend/src/pages/admin/caja/PuntoVenta.tsx`)
- `F2` → Cobrar (usa `cobrarRef.click()` para respetar disabled del botón)
- `F4` → Limpiar carrito + descuento + cliente
- `F5` → Abrir caja (si está cerrada)
- `F8` → Focus + select en campo de búsqueda
- `useCallback` con dependencias para evitar memory leaks
- Shortcuts hint bar visible en desktop (`<Keyboard>` icon + `<kbd>` tags)
- `aria-keyshortcuts` en inputs y botones (accesibilidad)
- Ignorado cuando el modal de tirilla está abierto

#### 4. Layout responsive POS (`frontend/src/pages/admin/caja/PuntoVenta.tsx`)
- `flex-col lg:flex-row` — apilado en mobile, lado a lado en desktop
- `min-h-[50vh] lg:min-h-0` para visibilidad en mobile
- Productos: `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` adaptativo
- `overscroll-contain` para scroll suave

#### 5. Skeleton loaders en Dashboard (`frontend/src/pages/admin/Dashboard.tsx`)
- KpiCard muestra `SkeletonBlock` cuando `loading=true`
- Chart muestra `SkeletonChart` cuando `reportesLoading=true`
- Eliminados imports no usados: `ShoppingCart`, `usePermisos`, `format`

#### 6. Dark mode en tablas admin
- **HistorialCaja:** thead, tbody, rows, celdas, loading/empty states, KPIs
- **OrdenesCompra:** thead, tbody, rows, celdas, paginación, loading/empty states

### Validaciones
- ✅ TypeScript frontend: 0 errores
- ✅ Vite build: exitoso (5.06s)
- ✅ Code review: aprobado (3 detalles cosmeticos corregidos)

---

## 2026-05-26 — Fase 12: UX Clínico — Drug-Interaction Alerts, Health Profiles, alertas clínicas

**Objetivo:** Implementar alertas de interacciones medicamentosas en POS, perfiles de salud en B2C, y verificación clínica en ficha de producto.

### Cambios realizados

#### 1. Prisma schema (`database/prisma/schema.prisma`)
- Modelo `Cliente`: nuevos campos `alergenos` (Text) y `condiciones` (Text) para almacenar alérgenos y condiciones preexistentes como strings separadas por coma

#### 2. Backend endpoints (`backend/src/modules/auth-cliente/authCliente.perfil.routes.ts`)
- `GET /salud` — Devuelve `alergenos` y `condiciones` como arrays parseados
- `PATCH /salud` — Recibe arrays, guarda como comma-separated string en DB

#### 3. Frontend services (`frontend/src/services/index.ts`)
- `clientesService.obtenerSalud()` — GET perfil de salud
- `clientesService.actualizarSalud(data)` — PATCH perfil de salud

#### 4. InteractionAlertModal (`frontend/src/components/shared/InteractionAlertModal.tsx` — **nuevo**)
- Modal de alertas clínicas reutilizable con:
  - Severidad: ALTA (rojo), MEDIA (ámbar), BAJA (azul), INFO (púrpura)
  - Iconos por severidad (AlertTriangle, AlertCircle, Info, Stethoscope)
  - Parseo de markdown básico (`**texto**` → `<strong>`)
  - Dark mode completo
  - Animaciones fade-in + slide-up
  - Botones Confirmar/Cancelar con loading state

#### 5. Integración en POS (`frontend/src/pages/admin/caja/PuntoVenta.tsx`)
- Antes de cobrar (F2 o botón), verifica interacciones entre productos en carrito
- Si hay alertas, muestra `InteractionAlertModal` antes de proceder
- Si no hay alertas o falla verificación, continúa normal

#### 6. Perfil de Salud en MiCuenta (`frontend/src/pages/tienda/MiCuenta.tsx`)
- Nueva pestaña "Perfil de salud" en MiCuenta
- Formulario con textareas para alérgenos y condiciones (separados por coma)
- Preview de tags con colores distintivos (ámbar para alérgenos)
- Info box explicativo sobre uso de la información
- Sincronización con `useEffect` cuando se cargan datos
- Integración con endpoint PATCH /salud

#### 7. Verificación de alérgenos en Checkout (`frontend/src/pages/tienda/Checkout.tsx`)
- Al hacer clic en "Pagar", verifica alérgenos vs perfil de salud del cliente
- Si detecta alérgenos en productos del carrito, muestra `InteractionAlertModal`
- Permite continuar o cancelar
- Badge informativo en sidebar con conteo de alérgenos registrados
- Overlay animado durante verificación

#### 8. Botón "Verificar interacciones" en ProductoDetalle (`frontend/src/pages/tienda/ProductoDetalle.tsx`)
- Botón con icono `Stethoscope` que llama a `chatbotService.verificarInteracciones`
- Muestra alertas en `InteractionAlertModal` si se detectan interacciones
- Toast de éxito si no hay interacciones
- Loading state durante verificación

#### 9. Bug fixes aplicados
- **Checkout.tsx**: Reordenamiento de `verificarAlergenosAntesDePagar` (useCallback) antes de `continuarPago` para evitar temporal dead zone + cierre de fragment `<></>` faltante
- **MiCuenta.tsx**: Reemplazo de `useState(() => {...})` (anti-patrón) por `useEffect` correcto + eliminación del hack `prevSalud` con `setTimeout`

### Validaciones
- ✅ TypeScript frontend: 0 errores
- ✅ Vite build: exitoso (9.31s)
- ✅ Code review: aprobado (bugs corregidos)

---

## 2026-05-26 — Documentación: browser-use, kill safety, regla de git

**Archivos modificados:**
- `AGENTS.md`: Agregadas 3 secciones:
  - `Uso de browser-use (Playwright) — solo pnpm`: Instrucciones para usar Playwright con pnpm (no npm), cómo Chromium queda instalado y cómo usarlo desde Codebuff
  - `⚠️ Cuidado con procesos (kill safety)`: Tabla de comandos peligrosos (taskkill /F /IM, Stop-Process sin filtro) vs comandos seguros por PID específico. Advertencia explícita sobre no matar `freebuff.cmd`
  - `📝 Regla: documentar cambios + git commit/push siempre`: Proceso obligatorio de documentar en AGENTS.md/docs/, commit descriptivo, y push

**Contexto:** El usuario reportó que solo tiene `pnpm` instalado (no npm), y que `freebuff.cmd` no debe ser cerrado accidentalmente por comandos kill agresivos.

## 2026-05-26 — Migración React 19 + Tailwind 4 + Coverage 95%+

**React 18→19:**
- react@19.2.6, react-dom@19.2.6, @types/react@19.0.0
- zustand@4.5.0, @tanstack/react-query@5.0.0, react-router-dom@6.22.0
- recharts@2.12.0, lucide-react@1.16.0 (íconos sociales migrados a SVG inline)
- TypeScript: 0 errores

**Tailwind 3→4:**
- tailwindcss@4.3.0 + @tailwindcss/vite@4.3.0
- postcss.config.cjs y tailwind.config.ts eliminados
- index.css migrado a @import "tailwindcss" + @theme
- vite.config.ts: @tailwindcss/vite plugin reemplaza postcss
- build exitoso (5.70s)

**Cobertura 83.7%→95.35%:**
- 510 tests (27 archivos), 0 fallos
- Reportes: 44%→100%, auth-cliente perfil: 66%→100%
- schemas: 94.93% stmts, servicios: 95.76%, config: 99.5%
- Todos los módulos ≥90% (excepto imagenes 46.96%)

---

## 2026-05-27 — Fase 13: SEO Técnico + Performance — meta tags, sitemap, lazy loading, bundle optimization

**Objetivo:** Implementar meta tags dinámicos por página, sitemap XML, lazy loading de imágenes con IntersectionObserver, y optimización de bundles/build.

### Cambios realizados

#### 1. SEOHead reutilizable (`frontend/src/components/shared/SEOHead.tsx` — **nuevo**)
- Componente con `Helmet` de `react-helmet-async` que recibe: `title`, `description`, `path`, `image`, `type`, `keywords`
- Defaults: description, title suffix `| Farmacy`, keywords desde constants
- Open Graph tags (`og:title`, `og:description`, `og:image`, `og:type`, `og:url`)
- Twitter Card tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`)
- `lang="es"` en `<html>` tag
- Canonical URL generada automáticamente desde `path`

#### 2. HelmetProvider en main.tsx
- `frontend/src/main.tsx`: Envuelto con `<HelmetProvider>` (anidado dentro de StrictMode)

#### 3. SEOHead integrado en páginas públicas
| Página | Title | Description |
|---|---|---|
| Inicio | `Farmacy — Tu farmacia digital` | Catálogo de medicamentos INVIMA |
| Catalogo | `Catálogo de productos` | + categorías + laboratorios |
| ProductoDetalle | `{nombre} {concentracion}` | + presentación + precio |
| QuienesSomos | `Quiénes somos` | + resumen corporativo |
| Contacto | `Contacto` | + sucursales principales |
| Sucursales | `Nuestras sucursales` | + horarios + servicios |
| Carrito | `Tu carrito de compras` | + resumen |
| Favoritos | `Mis favoritos` | + descripción |
| MisPedidos | `Mis pedidos` | + historial de compras |
| NoEncontrado | `Página no encontrada` | + mensaje 404 |
| PoliticaPrivacidad | `Política de privacidad` | + resumen legal |
| TerminosCondiciones | `Términos y condiciones` | + resumen legal |
| LoginCliente | `Iniciar sesión` | + descripción

#### 4. Sitemap XML + robots.txt
- `frontend/public/sitemap.xml` (nuevo): 12 URLs principales con prioridades y frecuencias
- `frontend/public/robots.txt`: Disallow `/api/*`, `/admin/*`, `/auth/*`; agregada directiva `Host`
- `frontend/src/services/sitemap.ts` eliminado (importaba Express dentro del frontend)

#### 5. LazyImage component (`frontend/src/components/shared/LazyImage.tsx` — **nuevo**)
- Lazy loading con `IntersectionObserver` + `rootMargin: 200px` para carga anticipada
- Placeholder/skeleton animado mientras carga
- Fade-in transition (`opacity-0` → `opacity-100` con `duration-300`)
- Fallback en error (oculta placeholder)
- Soporte dark mode
- Migrado a `<img loading="lazy">` nativo como capa adicional
- Footer.tsx: imágenes de Visa/Mastercard/PayPal migradas a `<LazyImage>`

#### 6. Bundle optimization (`frontend/vite.config.ts`)
- `cssCodeSplit: true` — CSS dividido por chunk
- `chunkSizeWarningLimit: 400` — warning solo si >400 kB
- `assetsInlineLimit: 4096` — assets <4 KB inline como base64
- `manualChunks` granular con función:
  - `vendor-core`: React + ReactDOM + Router
  - `vendor-seo`: react-helmet-async + dependencias
  - `vendor-query`: @tanstack/react-query
  - `vendor-charts`: recharts + d3
  - `vendor-ui`: lucide-react
  - `vendor-toast`: react-hot-toast + goober
  - `vendor-state`: zustand

#### 7. Bug fixes de JSX
- **MisPedidos.tsx**: Loading state `return` reestructurado para cerrar fragment correctamente
- **ProductoDetalle.tsx**: `!producto` return y main return — fragmentos `<>` sin cerrar, corregidos agregando `</>` 
- **ProductoDetalle.tsx**: Fragment suelto dentro del tab de seguridad (listaAlergenos.map) corregido
- **LoginCliente.tsx**: Doble `</>` eliminado

### Validaciones
- ✅ TypeScript frontend: 0 errores
- ✅ Vite build: exitoso (19.89s)
- ✅ Code review: aprobado (3 fixes de fragment/div aplicados correctamente)

### Chunks generados
| Chunk | Tamaño | Gzip |
|---|---|---|
| `vendor-core` | 430 kB | 130 kB |
| `vendor-charts` | 396 kB | 111 kB |
| `vendor-query` | 232 kB | 66 kB |
| app `index` | 184 kB | 39 kB |
| Otros (5 chunks) | 23–86 kB | — |

---

## 2026-05-27 — Fase 14: PWA + Offline — Service Worker, manifest, íconos, offline fallback

**Objetivo:** Convertir Farmacy en una Progressive Web App instalable con soporte offline para la tienda.

### Cambios realizados

#### 1. Dependencias agregadas
| Paquete | Versión | Tipo |
|---|---|---|
| `vite-plugin-pwa` | ^1.3.0 | devDependency |
| `workbox-window` | ^7.4.1 | devDependency (tipos) |

#### 2. Service Worker con Workbox (`frontend/vite.config.ts`)
- Plugin `VitePWA` con `registerType: 'autoUpdate'`
- **Strategy:** `generateSW` — genera `dist/sw.js` + `dist/workbox-b1bafff1.js`
- **Precaching:** 85 entries (2.4 MB) — JS, CSS, HTML, SVG, PNG, JPG, ICO, JSON, XML, WOFF2
- **Offline fallback:** `navigateFallback: '/offline.html'` con denylist para `/api/`, `/admin/`, `/auth/`
- **Runtime caching estratégico:**
  | Pattern | Handler | Cache | Expiración |
  |---|---|---|---|
  | `/api/productos/buscar`, `/api/productos/lista-rapida` | `CacheFirst` | `api-productos` | 1 hora |
  | `/api/categorias` | `CacheFirst` | `api-categorias` | 24 horas |
  | `/api/sucursales` | `CacheFirst` | `api-sucursales` | 24 horas |
  | Google Fonts stylesheets | `StaleWhileRevalidate` | `google-fonts-stylesheets` | 30 días |
  | Google Fonts webfonts | `CacheFirst` | `google-fonts-webfonts` | 60 días |
  | External images (icons8) | `StaleWhileRevalidate` | `external-images` | 7 días |

#### 3. Manifest PWA (`frontend/vite.config.ts`)
- **Name:** Farmacy — Tu farmacia digital
- **Theme color:** `#0F6E56` (verde farmacia)
- **Display:** `standalone` — experiencia tipo app al instalar
- **Icons:** 3 SVG (192x192, 512x512, maskable 512x512)
- **Shortcuts:** "Buscar productos" → `/productos`, "Contacto" → `/sucursales`
- **Categories:** health, medical, pharmacy, shopping

#### 4. Íconos PWA (`frontend/public/icons/` — **3 nuevos**)
- `icon.svg` (512x512): Cruz farmacia verde con gradient, rounded square
- `icon-192.svg` (192x192): Misma cruz, para sizes 192x192
- `icon-maskable.svg` (512x512): Full bleed para Android adaptive icons

#### 5. Offline fallback page (`frontend/public/offline.html` — **nuevo**)
- Página standalone con diseño card, icono decorativo (signal-off SVG), mensaje claro
- Botón "Reintentar" que hace `window.location.reload()`
- Colores y branding farmacia (verde `#0F6E56`, fondo `#F5F8F6`)
- Inline styles, responsive, sin dependencias externas

#### 6. Actualización PWA en vivo (`frontend/src/components/shared/PWAUpdatePrompt.tsx` — **nuevo**)
- Componente React que importa dinámicamente `virtual:pwa-register`
- `registerSW` con dos callbacks:
  - `onNeedRefresh()`: Toast "Nueva versión disponible" (duración 8s, icono 🔄)
  - `onOfflineReady()`: Toast "Funciona sin conexión" (duración 4s)
- Error boundary (try/catch) para desarrollo donde el módulo virtual no existe
- Cleanup flag `cancelled` para evitar estado inconsistente tras desmontar
- Colores de toast acordes a la marca (verde/ámbar)

#### 7. Type declarations (`frontend/src/vite-env.d.ts`)
- `/// <reference types="vite/client" />` — tipos de Vite
- `declare module 'virtual:pwa-register'` — exporta `registerSW()` y `RegisterSWOptions`
- Importa tipos desde `workbox-window`

#### 8. Meta tags PWA (`frontend/index.html`)
- `theme-color: #0F6E56` — color de la barra de herramientas en mobile
- `apple-mobile-web-app-capable: yes` — iOS fullscreen
- `apple-mobile-web-app-title: Farmacy` — nombre en home screen iOS
- `apple-touch-icon` → `/icons/icon-192.svg`
- `mask-icon` → `/icons/icon.svg` color `#0F6E56` (Safari pinned tab)
- `viewport-fit=cover` — notched devices
- Icono cambiado de `favicon.ico` a `/icons/icon.svg`

#### 9. Integración en main.tsx (`frontend/src/main.tsx`)
- Importado `<PWAUpdatePrompt />` desde `./components/shared/PWAUpdatePrompt`
- Renderizado dentro de `<QueryClientProvider>`, después de `<ReactQueryDevtools>`

#### 10. Package reorganized
- `workbox-window` movido de `dependencies` a `devDependencies` (solo tipos en build)

#### 11. PWA Install Analytics — `beforeinstallprompt` + banner de instalación
- **`frontend/src/hooks/usePWAInstall.ts`** (NUEVO):
  - Hook `usePWAInstall()` que escucha `beforeinstallprompt` con `e.preventDefault()`
  - Escucha `appinstalled` y `display-mode: standalone` change para detectar instalación
  - Expone: `isInstallable`, `isInstalled`, `install()`, `dismiss()`, `markBannerShown()`, `getAnalytics()`, `resetAnalytics()`
  - Analytics en localStorage (clave `farmacy_pwa_install_analytics`) con timestamps y conteos
  - `install()` llama a `event.prompt()` y trackea `userChoice.outcome`
  - `dismiss()` desactiva el banner por el resto de la sesión
  - Cleanup de listeners en useEffect return
  - Fix de double-conteo con `hasRecordedInstallRef` (previene que `appinstalled` incremente dos veces)

- **`frontend/src/components/shared/InstallPWABanner.tsx`** (NUEVO):
  - Banner slide-up animado con CSS `@keyframes slide-up`
  - Diseño card con icono Download, título, descripción, botones Instalar / Ahora no
  - Dark mode completo
  - `role="alert"`, `aria-live="polite"` para accesibilidad
  - Marca bannerShownCount automáticamente en analytics

- **`frontend/src/components/layout/PublicLayout.tsx`**:
  - Integrado `<InstallPWABanner />` antes del cierre del contenedor principal

- **`frontend/src/hooks/index.ts`**:
  - Exportado `usePWAInstall` y tipo `PWAInstallAnalytics`

### Validaciones
- ✅ TypeScript frontend: 0 errores
- ✅ Vite build: exitoso (8.26s)
- ✅ Workbox generateSW: 85 entries precached (2.4 MB)
- ✅ Code review: aprobado (fix de double-conteo en analytics corregido)

---

## 2026-05-27 — Documentación: AGENTS.md browser-use + kill safety, plan.md realineado

**Objetivo:** Completar la documentación siguiendo el step-by-step del plan.md, agregar reglas operativas faltantes en AGENTS.md.

### Cambios en AGENTS.md
1. **Nueva sección `🧪 Regla: tests de frontend/browser siempre con @browser-use`**
   - Instrucción explícita: siempre que se realicen tests de frontend o interacción con navegador, usar `@browser-use` como agente
   - No ejecutar scripts Playwright directos ni basher para tests de navegación
   - Excepción: si Chrome no está disponible, usar script Playwright como fallback

2. **Sección `🚫⚠️ Regla CRÍTICA: NUNCA matar freebuff.cmd`**
   - Sección renombrada y reforzada con advertencia explícita
   - Tabla de comandos prohibidos con explicación de por qué matan freebuff.cmd
   - Nueva subsección `🔍 Cómo identificar freebuff.cmd` con comandos seguros de solo lectura
   - Referencia rápida: primera fila `⛔ Matar freebuff.cmd | **NUNCA** — destruye la sesión`
   - Regla de oro extendida: "Ante la duda, NO mates nada"

### Cambios en plan.md
- Corregidos checkboxes: Fases 10-12 ✅, Fase 13 (SEO+PWA) ✅, Fase 14 (E2E) ✅, Fase 15 (Docker) ✅
- Fases pendientes renumeradas (16→19) con su estado real: ⏳ PENDIENTE
- Tabla MoSCoW actualizada con columna de estado
- Criterio final de cierre corregido (solo 3/7 cumplidos)
- Checklist transversal corregido (Interacción dinámica: 0/5, Seguridad: 6/10)

### Archivos modificados
- `AGENTS.md` — 2 secciones nuevas/mejoradas
- `plan.md` — Checkboxes realineados con worklog, fases pendientes marcadas

### Validaciones
- ✅ TypeScript backend: 0 errores
- ✅ TypeScript frontend: 0 errores

---

## 2026-05-27 — Fase 15: Testing E2E con Playwright

**Objetivo:** Implementar pruebas end-to-end con Playwright que validen los flujos críticos de navegación pública, login admin, POS y B2C.

### Dependencias agregadas
| Paquete | Versión | Tipo |
|---|---|---|
| `@playwright/test` | ^1.60.0 | devDependency |

### Archivos creados

#### 1. Configuración global (`e2e/playwright.config.ts`)
- 2 proyectos: **chromium** (desktop 1280×900) y **chromium-mobile** (Pixel 7 412×915)
- baseURL: `http://localhost:5173`
- Timeouts: test 60s, expect 15s, action 10s, navigation 30s
- Retries: 1 (2 en CI), workers: 1 (2 en CI)
- Reporter: HTML (`e2e/reports`) + list con steps
- `--unsafely-treat-insecure-origin-as-secure` para probar PWA sin HTTPS

#### 2. Fixtures de autenticación (`e2e/fixtures/auth.ts`)
- `CREDENTIALS`: admin, farmaceuta, auxiliar, cliente con emails y passwords
- `loginAdmin()`: login vía API → token en localStorage via `addInitScript`
- `loginCliente()`: login cliente vía API
- `loginAdminForm()`: llena formulario de login en página
- `gotoDashboard()`: navega al dashboard admin

#### 3. Specs de tests (`e2e/specs/`)

**public-navigation.spec.ts** — 5 tests:
- Home page: título, logo, búsqueda, enlaces, sin page errors
- Catálogo: título, botones "Agregar" visibles, categoría Analgésicos
- Ficha producto: clic en primer enlace `/productos/`, URL cambia, precio visible
- Búsqueda: llenar input → esperar debounce → Enter → URL con `q=alercet` → resultado visible
- 404: ruta inexistente muestra mensaje de no encontrado

**admin-login.spec.ts** — 4 tests:
- Redirección a `/admin/login` sin sesión
- Login exitoso con admin → redirect → mensaje dashboard
- Login fallido → permanece en login → mensaje error
- Cerrar sesión → clic botón → redirige a login

**pos-flujo.spec.ts** — 4 tests:
- Login farmaceuta → redirige a `/admin/caja/pos` (ruta por defecto)
- Login admin → navega a POS → busca ibuprofeno
- Sin sesión → redirige a login
- Auxiliar (sin permiso caja) → redirige a inventario

**b2c-flujo.spec.ts** — 5 tests:
- Login cliente desde `/login` → redirect a `/` → nombre visible
- Catálogo → agregar al carrito → navegar a `/carrito`
- Carrito vacío muestra página de carrito
- Registro: formulario visible con campos email
- Sucursales: listado o mapa visible

### Scripts agregados (`package.json` raíz)
| Script | Comando |
|---|---|
| `e2e` | `npx playwright test --config=e2e/playwright.config.ts` |
| `e2e:ui` | Modo interactivo UI |
| `e2e:headed` | Navegador visible |
| `e2e:debug` | Modo debug |
| `e2e:report` | Mostrar reporte HTML |

### Resultados
- ✅ **18 tests pasaron** en 37.9s
- ✅ TypeScript frontend: 0 errores
- ✅ Code review: aprobado

### Fixes durante implementación
- **Catálogo test**: Selector `[class*="product"]` no existía — cambiado a `button:has-text("Agregar")`
- **Búsqueda test**: Form submit usaba `debouncedQ` (300ms debounce) — agregado `waitForTimeout(500)` antes de Enter
- **Prisma query engine**: Engine faltante en pnpm — copiado manualmente del pnpm store a `backend/node_modules/.prisma/client/` + `prisma generate` + node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/backend/node_modules/.prisma/client/

---

## 2026-05-27 — Fase 15.5: Prisma Client durable fix + Flujo completo E2E (11 tests) + Dark mode WCAG AA

**Objetivo:** Hacer durable la generación de Prisma Client con pnpm, agregar test E2E integral de 11 escenarios, y mejorar accesibilidad de dark mode.

### Problema raíz: Prisma Client con pnpm

En pnpm, `prisma generate` escribe los archivos generados en `node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/`, NO en `backend/node_modules/.prisma/client/`. Como el tsconfig del backend mapea `@prisma/client -> ./node_modules/.prisma/client`, TypeScript no encontraba los nuevos campos `condiciones` y `alergenos`.

### Fix durable

1. `backend/scripts/prisma-postgenerate.js` — Script Node.js nativo (fs.cpSync, sin PowerShell)
2. `backend/package.json` — predev ejecuta post-generate tras cada `prisma generate`
3. Prisma Client regenerado + copiado (1.58 MB)

### Test E2E: flujo-completo.spec.ts (11 tests)

Tests: Home carga, Catálogo, Login cliente, Producto detalle INVIMA, Carrito, Checkout Efectivo, Login admin, Navegación admin, 404, Redirección sin sesión, Login farmaceuta.

### Dark mode WCAG AA

- `--color-dark-text-muted: #718096` -> `#7a8ba6` (contraste 5.07:1)
- Eliminados `@import` duplicados (PostCSS warning fix)

### Docker Compose

- `version: '3.9'` eliminado de docker-compose.yml y docker-compose.dev.yml

### Validaciones
- Backend TS: 0 errores
- Frontend TS: 0 errores
- Vitest: 520/520 tests
- E2E flujo-completo: 11/11 tests
- prisma-postgenerate: verificado manualmente
