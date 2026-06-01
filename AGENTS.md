# FARMACY — AGENTS.md

> 🚨 **pnpm-only.** Este proyecto SOLO funciona con `pnpm`. NO uses `npm` ni `yarn`. Todo: instalación, scripts, workspace monorepo, CI/CD — todo es `pnpm`.

Guía rápida para desarrolladores IA y humanos que trabajan en este proyecto.

## Quick start (Windows)
1. `setup.bat` — Instala deps, genera Prisma Client, ejecuta migraciones, corre seeds (usa `pnpm`)
2. `.\run.ps1` — Inicia Docker (Postgres + Redis), backend (nodemon :3000), frontend (Vite 6 :5173)
   - Ejecutar directamente desde PowerShell
3. Alternativa manual: `docker compose -f docker-compose.dev.yml up -d` + `cd backend && pnpm run dev` + `cd frontend && pnpm run dev`

## Services + ports
| Service | Port | Container |
|---|---|---|
| PostgreSQL 15 | 5432 | `farmacy_postgres_dev` |
| Redis 7 | 6379 | `farmacy_redis_dev` |
| pgAdmin | 5050 | `farmacy_pgadmin` (admin@farmacy.co / admin) |
| Backend (Express) | 3000 | Corre en host via nodemon |
| Frontend (Vite) | 5173 | Proxy `/api` → 127.0.0.1:3000 |
| Mailpit (SMTP local) | 1025 / 8025 | `farmacy_mailpit` — Captura correos en desarrollo. Web UI en :8025 |

## Prisma + database (Colombian INVIMA/CUM Integration)
- Schema: `database/prisma/schema.prisma`
- Todos los scripts usan `--schema=../database/prisma/schema.prisma`
- **17 modelos:** Sucursal, Empleado, Categoria, Producto (35+ campos INVIMA), Lote, Proveedor, OrdenCompra, Venta, PagoTransaccion, etc.
- Producto tiene `cum` (unique), `registroInvima`, `principioActivo`, `atc`, `esMuestraMedica`, `alergenos`, `advertencias`
- Muestras médicas (`esMuestraMedica: true`) bloqueadas en ruta `/buscar`
- Seed: `pnpm run db:seed` desde `backend/`

## Pasarelas de pago
| Pasarela | Sandbox Keys | Estado |
|---|---|---|
| Wompi | `pub_test_*`, `prv_test_*`, `test_integrity_*` | ✅ Sandbox configurado |
| Stripe | `pk_test_*`, `sk_test_*`, `whsec_*` | ✅ Test keys |
| MercadoPago | `TEST-*` access token + public key | ✅ Sandbox configurado |
| Efectivo | — | ✅ Sin pasarela |

## Credenciales de desarrollo (seeds)
| Rol | Email | Contraseña |
|---|---|---|
| Administrador | admin@farmacy.co | Admin@1234 |
| Farmacéuta | farmaceuta@farmacy.co | Farm@1234 |
| Auxiliar | auxiliar@farmacy.co | Aux@1234 |
| Cliente demo | cliente@ejemplo.co | Cliente@1234 |

## Variables de entorno esenciales
- `DATABASE_URL` — PostgreSQL (requerida)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_CLIENTE_SECRET` — mínimo 32 caracteres cada una
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — Email/SMTP (opcional, ver sección de emails abajo)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth social (opcional)
- `WOMPI_*` — Wompi (opcional para sandbox)
- `STRIPE_*` — Stripe (opcional)
- `MERCADOPAGO_*` — MercadoPago (opcional)

## 📧 Sistema de correos electrónicos

El proyecto tiene un sistema de emails de 3 capas que funciona en desarrollo y producción:

### 1. Mailpit (SMTP local — desarrollo)
- **Propósito:** Capturar correos localmente sin enviarlos a destinatarios reales
- **Acceso:** Web UI en http://localhost:8025
- **SMTP:** `localhost:1025` (sin autenticación)
- **Docker:** Imagen `axllent/mailpit:v1.22`, contenedor `farmacy_mailpit`
- **Puertos:** `1025` (SMTP) + `8025` (Web UI)
- **Uso:** Ideal para desarrollo cuando no hay SMTP real configurado. Todos los correos se ven en la interfaz web.

### 2. Brevo (SMTP real — recomendado para pruebas con correos reales)
- **Propósito:** Enviar correos a destinatarios reales desde desarrollo
- **Registro:** https://www.brevo.com (gratuito, 300 emails/día, no expira)
- **Configuración en `.env`:**
  ```env
  SMTP_HOST=smtp-relay.brevo.com
  SMTP_PORT=587
  SMTP_USER=tu_usuario_smtp@brevo.com
  SMTP_PASS=tu_clave_smtp_de_brevo
  ```
- **Alternativa:** Resend (https://resend.com, 100 emails/día, gratis permanente)

### 3. Auto-verify (modo desarrollo)
Cuando `NODE_ENV=development`, el backend **auto-verifica los emails automáticamente** tanto al registrarse como al iniciar sesión. Esto significa:
- Los usuarios pueden registrarse y **loguearse inmediatamente** sin esperar el email de verificación
- El email de verificación se sigue enviando (si hay SMTP configurado) por si se quiere probar el flujo
- En **producción** (`NODE_ENV=production`), la verificación por email es obligatoria (seguridad)

### Cómo funciona el envío (`backend/src/config/mailer.ts`)

```typescript
// La autenticación SMTP es condicional:
// - Si SMTP_USER está configurado → usa auth (Brevo, Gmail, etc.)
// - Si no → usa ignoreTLS (Mailpit local)
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT),
  ...(env.SMTP_USER
    ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
    : { ignoreTLS: true }),
})
```

### Prioridad de configuración (carga de `.env`)

El archivo `backend/src/config/env.ts` carga los `.env` en este orden:
1. `.env` raíz del proyecto (base)
2. `backend/.env` con `override: true` (sobrescribe)

Esto permite tener configuraciones diferentes para el backend sin modificar el `.env` raíz.

### Tipos de correos que se envían

| Tipo | Template | Disparador |
|---|---|---|
| Verificación de email | `emailTemplates.verificarEmail()` | Registro de nuevo cliente |
| Restablecer contraseña | `emailTemplates.resetPassword()` | Solicitud de recuperación |
| Confirmación de compra | `emailTemplates.confirmacionCompra()` | Compra B2C exitosa |
| Alerta stock mínimo | `emailTemplates.alertaStockMinimo()` | Job programado de inventario |
| Devolución (soporte) | HTML directo | Cliente solicita devolución |

### Limpiar rate limit de registro

Si haces muchas pruebas de registro y el rate limit (5/hora) te bloquea:
```powershell
docker exec farmacy_redis_dev redis-cli flushall
```

### Resumen de flujo

```
Usuario se registra
  → Cuenta creada con emailVerificado=true (dev) / false (prod)
  → Si hay SMTP configurado → email de verificación enviado
  → Mailpit captura el email (si apunta a localhost:1025)
  → Brevo entrega el email (si apunta a smtp-relay.brevo.com)
  → Usuario puede loguear inmediatamente (dev) o tras verificar (prod)
```

---

## Tech stack
- **Runtime:** Node.js v24.15.0 + **pnpm v11.2.2** (único gestor de paquetes — no usar npm ni yarn)
- **Backend:** Express 4 + TypeScript 6.0 + Prisma 5.22
- **Frontend:** React 19 + TypeScript 6.0 + Vite 6.4 + Tailwind CSS 4
- **Build:** @tailwindcss/vite plugin (reemplaza postcss + autoprefixer), Brotli compression via `vite-plugin-compression`
- **Backend compression:** Express `compression` middleware con soporte Brotli nativo
- **CDN:** `VITE_CDN_URL` env var para assets estáticos
- **Testing:** Vitest v3 (521 tests, 95.35% cobertura)
- **CI/CD:** GitHub Actions (3 workflows)
- **Monitoreo:** Rutina documentada en `docs/monitoreo.md`
- **Tiempo real:** WebSocket para POS + chatbot, SSE para dashboard, BullMQ para jobs asíncronos
- **Push notifications:** VAPID configurable en `backend/src/config/env.ts`, service worker custom en `frontend/sw.ts`
  - Backend: `push.service.ts` (CRUD + envío), `push.routes.ts` (endpoints protegidos)
  - Frontend: `usePushNotifications()` hook, `PushToggle` en AdminLayout
  - Se activan automáticamente vía EventBus para alertas de inventario
- **Pre-render SEO (SSG parcial):** Build-time prerender con Playwright + sitemap dinámico
  - Script: `frontend/scripts/prerender.mjs` — 7 rutas estáticas + top 20 productos
  - Sitemap: `database/scripts/generar-sitemap.ts` — desde DB con productos activos
  - Nginx: `try_files $uri.html $uri $uri/ /index.html` para servir HTML pre-renderizado
  - Crawler middleware: `backend/src/services/prerender.service.ts` (28+ bots)
  - Docker: `frontend/Dockerfile` incluye Chromium + prerender en builder stage

## Script entrypoints
- Backend: `backend/src/server.ts` (conecta DB antes de HTTP)
- Frontend: `frontend/src/main.tsx` (React 19 + QueryClient)
- Tests: Vitest v3 en `backend/` (27 archivos, 521 tests)
- CI: `pnpm run test` en GitHub Actions (3 workflows)
- Monitoreo: `docs/monitoreo.md` — rutina operativa + checklist deploy

## 🧪 Regla: tests de frontend/browser siempre con @browser-use

**Siempre que realices tests de frontend o interacción con el navegador, DEBES usar `@browser-use` como agente.**

No ejecutes scripts Playwright directos ni uses `basher` para correr tests de navegación. El agente `@browser-use`:
- Automatiza la interacción con la web (clics, formularios, navegación)
- Reporta resultados y errores de consola
- Verifica que el renderizado sea correcto
- Captura lecciones para mejorar ejecuciones futuras

### Excepciones
- Si Chrome no está disponible (System Info reporta `Chrome: not found`), usa el script Playwright directo como fallback (ver sección abajo)
- Tests unitarios y de integración (Vitest) NO necesitan browser-use

---

## Uso de browser-use (Playwright) — solo pnpm

Este proyecto **NO usa npm**. Solo `pnpm` está instalado y disponible.

### Instalación de Playwright (solo una vez)
```bash
# Desde la raíz del proyecto
pnpm add -D playwright
pnpm exec playwright install chromium
```

Playwright instala Chromium en:
```
C:\Users\<usuario>\AppData\Local\ms-playwright\chromium-XXXX\chrome-win64\chrome.exe
```

### Ejecutar browser-use desde Codebuff
```bash
# El agente browser-use necesita Chrome/Chromium en el PATH del sistema.
# Si ya se ejecutó la instalación de Playwright, agregar al PATH:
$env:Path += ";C:\Users\andyh\AppData\Local\ms-playwright\chromium-1223\chrome-win64"
```

> **⚠️ Importante:** El agente `browser-use` depende del System Info cacheado al inicio de la conversación. Si al inicio reporta `Chrome: not found`, no podrá usarse en **esa conversación** aunque Chromium esté en PATH. En una **nueva conversación**, Codebuff reevaluará el System Info y detectará Chromium correctamente. Como alternativa inmediata, se puede usar un script Playwright directo.

### Script de prueba alternativo (cuando browser-use no funciona)
Crear `test-app.mjs` temporal:
```js
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Escuchar errores de consola
page.on("console", msg => console.log(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", err => console.log(`[PAGE ERROR] ${err.message}`));

// Navegar y verificar
await page.goto("http://localhost:5173");
const title = await page.title();
console.log(`Page title: ${title}`);

// Verificar que React root renderizó
const root = await page.$("#root");
console.log(`React root: ${root ? "✅ presente" : "❌ ausente"}`);

await browser.close();
```
Ejecutar con: `node test-app.mjs` (no necesita npm, solo Node.js + Playwright instalado vía pnpm)

---

## 🚀 CI/CD — GitHub Actions

Este proyecto tiene **3 workflows** de GitHub Actions:

### 1. CI (`ci.yml`)
- **Disparador:** push/PR a `main`
- **Jobs:** Backend (typecheck + tests + build), Frontend (typecheck + build), Prisma schema validation
- **Concurrencia:** Cancela runs previos del mismo PR
- **Redis service:** Incluido para compatibilidad con ioredis/BullMQ

```yaml
# Jobs principales:
backend:  typecheck + 521 tests + build (15 min timeout)
frontend: typecheck + Vite build (10 min timeout)
prisma:   validate + generate schema (5 min timeout)
```

### 2. Secret Scanning (`secret-scanning.yml`)
- **Disparador:** push/PR a `main`
- **Tool:** Gitleaks con configuración custom en `backend/.gitleaks.toml`
- **Cobertura:** JWT, DB URLs, Stripe, Wompi, MercadoPago, Cloudinary, SMTP, Google OAuth

### 3. E2E Smoke (`e2e-smoke.yml`)
- **Disparador:** `workflow_dispatch` (manual) o PR etiquetado con `e2e-smoke`
- **Servicios:** PostgreSQL 15 + Redis 7
- **Flujo:** Seed DB → Iniciar backend → Iniciar frontend → Playwright tests → Upload report
- **Timeout:** 20 minutos

### Variables de entorno para CI

Todas las variables de CI están definidas inline en los workflows. No requieren secrets de GitHub para correr (usan valores de prueba). Para producción, configurar como **secrets del repositorio**:

| Secret | Descripción |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Mínimo 32 caracteres |
| `JWT_REFRESH_SECRET` | Refresh tokens |
| `JWT_CLIENTE_SECRET` | Clientes B2C |
| `REDIS_URL` | Redis connection string |
| `VITE_API_URL` | Backend URL para el frontend |

---

## 📊 Monitoreo operativo

Documentación completa en `docs/monitoreo.md`. Resumen:

### Rutina de revisión

| Periodo post-deploy | Frecuencia |
|---|---|
| Primera semana | 2 veces al día |
| Semanas 2 a 4 | 1 vez al día |
| Luego de estabilización | 3 veces por semana |
| Tras cada release | Primeras 2 horas continuas |

### Rutina rápida (5 min)

```bash
# 1. Contenedores arriba
docker ps --format "table {{.Names}}\t{{.Status}}" | grep farmacy

# 2. Healthcheck backend
curl -s http://localhost:3000/api/v1/health

# 3. Últimos errores
docker logs farmacy_backend --since 1h | grep -i "error\|fatal\|crash" | tail -20

# 4. Últimos 5XX Nginx
docker logs farmacy_frontend --since 1h | grep "HTTP/1.1\" [45][0-9][0-9]" | tail -20
```

### Checklist de deploy

Ver `docs/monitoreo.md#6-checklist-deploy` para el checklist completo de pre/post-deploy.

---

## 🐛 MSYS Path Translation (Git Bash en Windows)

Cuando el backend se ejecuta desde **Git Bash** (o cualquier shell basado en MSYS/Cygwin), las rutas que empiezan con `/` son **traducidas automáticamente** a rutas de Windows. Por ejemplo:

```
/api/v1  →  C:/Program Files/Git/api/v1
```

Esto rompe todas las rutas de la API porque `API_PREFIX` termina siendo `C:/Program Files/Git/api/v1` en lugar de `/api/v1`.

### Síntomas
- El healthcheck (`/api/v1/health`) responde 200 porque Express lo registra como ruta literal corrupta
- **Todas las demás rutas** (`/categorias`, `/productos`, etc.) devuelven **404**
- En las pruebas de Playwright/browser-use se ven decenas de errores 404 en consola

### ✅ Solución implementada

El schema de `API_PREFIX` en `backend/src/config/env.ts` tiene un `.transform()` que detecta el patrón de unidad Windows (`C:/...`) y extrae la ruta original:

```typescript
API_PREFIX: z.string().default('/api/v1').transform(val => {
  if (/^[a-zA-Z]:[/\\]/.test(val)) {
    const parts = val.split(/[/\\]+/).filter(Boolean)
    const skipDirs = new Set(['program files', 'git', 'msys64', 'msys', 'usr', 'etc'])
    let start = 1
    while (start < parts.length && skipDirs.has(parts[start].toLowerCase())) {
      start++
    }
    if (start < parts.length) {
      return '/' + parts.slice(start).join('/')
    }
  }
  return val
}),
```

### ⚠️ Si ejecutas comandos manualmente desde Git Bash

```bash
# ❌ Esto rompe API_PREFIX (MSYS traduce /api/v1):
pnpm run dev

# ✅ Usa MSYS2_ARG_CONV_EXCL para deshabilitar la traducción:
MSYS2_ARG_CONV_EXCL="*" pnpm run dev

# ✅ O mejor, usa PowerShell directamente:
powershell -NoProfile -File run.ps1
```

> **Nota:** El script `run.ps1` usa PowerShell, por lo que **no sufre** de este bug. El problema solo ocurre al ejecutar el backend desde Git Bash u otras shells MSYS.

---

## 🚫⚠️ Regla CRÍTICA: NUNCA matar freebuff.cmd

**`freebuff.cmd` es el proceso que ejecuta Codebuff. Si se cae, la sesión actual se pierde por completo — no hay recuperación.**

### 🛑 Prohibido terminantemente

| ❌ Lo que NUNCA debes hacer | Por qué |
|---|---|
| `taskkill /F /IM node.exe` | Mata TODOS los Node.js, incluyendo freebuff.cmd |
| `Get-Process node \| Stop-Process` | Igual — mata todo proceso Node.js sin discriminar |
| `Stop-Process -Name "node"` | Mata TODOS los Node.js incluyendo freebuff.cmd |
| `taskkill /F /FI "IMAGENAME eq node*"` | Cualquier filtro por nombre de proceso es peligroso |
| `Get-Process node \| Where-Object ...` | A menos que filtres POR PID, es inseguro |

### ✅ Forma segura de detener servidores

Solo matar por **PID específico** capturado al iniciar el proceso:

```powershell
# Capturar PID al iniciar
$backendPID = (Start-Process ... -PassThru).Id

# Matar solo ese PID específico
Stop-Process -Id $backendPID -Force
```

O liberar solo el puerto conocido (sin matar procesos no relacionados):

```powershell
$pidOnPort = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess
if ($pidOnPort) { Stop-Process -Id $pidOnPort -Force }
```

### 🔍 Cómo identificar freebuff.cmd

Si necesitas verificar qué procesos están corriendo sin riesgo:
```powershell
# Listar procesos Node.js con su PID y línea de comandos (seguro — solo lectura)
Get-Process node | Select-Object Id, ProcessName, StartTime

# Ver procesos en un puerto específico (seguro)
netstat -ano | findstr :3000
```

**NUNCA** uses el PID de `freebuff.cmd` en un `Stop-Process`. Si no estás seguro de qué PID matar, no mates nada y consulta al usuario.

### Referencia rápida de comandos seguros

| Acción | Comando seguro |
|---|---|
| ⛔ Matar freebuff.cmd | **NUNCA** — destruye la sesión |
| Detener backend por PID | `Stop-Process -Id $BACKEND_PID -Force` |
| Detener frontend por PID | `Stop-Process -Id $FRONTEND_PID -Force` |
| Liberar puerto 3000 | `Get-NetTCPConnection -LocalPort 3000 \| Stop-Process` |
| Verificar qué ocupa un puerto | `netstat -ano \| findstr :3000` |
| Dejar Docker intacto | **No tocar** `docker` ni contenedores |

> **Regla de oro:** Nunca uses `taskkill /F /IM` ni filtres por nombre de proceso. Siempre usa el PID específico. Y ante la duda, NO mates nada.

---

## 🛡️ Fase 22 — IP Allowlist + Rate limiting granular

### IP Allowlist para webhooks
- `backend/src/middlewares/index.ts` → `verificarIpPermitida(allowedList: string[])`:
  - Middleware factory que verifica `req.ip` contra lista de IPs/CIDR
  - Normaliza IPv6-mapped-IPv4 (`::ffff:xxx` → `xxx`)
  - Si la allowlist está vacía: pasa con `next()` (warning logueado una vez)
  - Si IP no coincide: retorna 403 `{ error: 'IP no autorizada' }`
  - Helper `ipv4ANumero()` y `ipEnCidr()` para CIDR matching
- `backend/src/modules/pagos/pagos.routes.ts` → `verificarIpWebhook` aplicado a Wompi, Stripe, MercadoPago
- `backend/src/config/env.ts` → `WEBHOOK_IP_ALLOWLIST` (optional, comma-separated IPs/CIDRs)
- `backend/src/app.ts` → `app.set('trust proxy', 1)` necesario para leer IP real detrás de Nginx

### Rate limiters granulares
| Middleware | Límite | Aplica en |
|---|---|---|
| `limitarCreacion` | 30 req/min | POST/PUT/PATCH (productos, ventas, compras, auth refresh/logout, auth-cliente) |
| `limitarBusqueda` | 60 req/min | GET /buscar + GET / + GET /:id (productos, ventas) |
| `limitarRegistro` | **5 req/hora** | POST /registro (auth-cliente) — skip automático en `NODE_ENV=test` |
| `limitarWebhook` | `RATE_LIMIT_WEBHOOK_MAX` env var | Webhooks Wompi/Stripe/MercadoPago |
| `limitarLogin` | `RATE_LIMIT_AUTH_MAX` env var | Login admin + cliente |

### Variables de entorno nuevas
| Variable | Default | Descripción |
|---|---|---|
| `WEBHOOK_IP_ALLOWLIST` | — | IPs/CIDR permitidos para webhooks (comma-separated) |
| `RATE_LIMIT_WEBHOOK_MAX` | 60 | Máx requests/min para webhooks |
| `RATE_LIMIT_CREACION_MAX` | 30 | Máx requests/min para POST/PUT/PATCH |
| `RATE_LIMIT_BUSQUEDA_MAX` | 60 | Máx requests/min para búsqueda pública |

### Endpoints protegidos

#### Auth admin (`auth.routes.ts`)
| Endpoint | Middleware |
|---|---|
| POST /login | `limitarLogin` (10/15min) |
| POST /refresh | `limitarCreacion` |
| POST /logout | `limitarCreacion` |

#### Auth cliente (`authCliente.routes.ts`)
| Endpoint | Middleware |
|---|---|
| POST /registro | `limitarRegistro` (5/hora) |
| POST /login | `limitarLogin` |
| POST /verificar-email | `limitarCreacion` |
| POST /recuperar-password | `limitarCreacion` |
| POST /reset-password | `limitarCreacion` |
| POST /logout | `limitarCreacion` |
| POST /favoritos | `limitarCreacion` |
| POST /pedidos/:id/devolucion-request | `limitarCreacion` |

#### Catálogo público (`productos.routes.ts`)
| Endpoint | Middleware |
|---|---|
| GET / (admin list) | `autenticar, validarQuery, limitarBusqueda` |
| GET /buscar (público) | `limitarBusqueda, validarQuery` |
| GET /:id (detalle público) | `limitarBusqueda` |

---

## 🛡️ Fase 23a — NoSQL injection hardening

### Chatbot (`chatbot.routes.ts`)
- **Zod body validation:** `mensajeChatbotSchema` (string max 500) + `interaccionesSchema` (string[] 2-20)
- **Type guards:** `sanitizarInput(input: unknown)`, `sanitizarSessionToken(token: unknown)`, `buscarProductos(query)` con `typeof` check
- **Filter guard:** `.filter((p: unknown) => typeof p === 'string')` en split de palabras
- Orden: `limitarCreacion, validarCuerpo(schema), handler` — rate limiting antes de validación costosa

### Endpoints con `contains` de Prisma — Zod query validation
| Archivo | Schema | Validación |
|---|---|---|
| `productos.routes.ts` | `listarAdminSchema` | `q`, `categoriaId`, `activo`, `laboratorio` como `z.string().optional()` |
| `auditoria.routes.ts` | `logsQuerySchema` | `desde`, `hasta`, `accion`, `modulo`, `empleadoId`, `ip`, `q` como `z.string().optional()` |
| `proveedores.routes.ts` | `listarProveedoresSchema` | `q`, `activo` como `z.string().optional()` |
| `clientes.admin.routes.ts` | `listarClientesSchema` | `q`, `documento` como `z.string().optional()` |

### iLike() helper — defense-in-depth
```typescript
const iLike = (value: unknown) => ({
  contains: typeof value === 'string' ? value : '',
  mode: Prisma.QueryMode.insensitive,
})
```
- Tipo cambiado de `value: string` a `value: unknown` con runtime type guard
- Aplicado en: `proveedores.routes.ts`, `clientes.admin.routes.ts`

---

## 🛡️ Fase 10 — Seguridad hardening

Esta sección documenta las medidas de seguridad implementadas en Fase 10.

### CORS
- `backend/src/config/env.ts` → `CORS_ORIGINS` (comma-separated, para producción)
- `backend/src/app.ts` → CORS con `methods`, `allowedHeaders`, `maxAge` explícitos
- En producción, si `CORS_ORIGINS` no está configurado, se loggea un warning y la API solo acepta orígenes de desarrollo

### Helmet / CSP
- `backend/src/config/env.ts` → `CSP_ENABLED` (default `'true'`)
- CSP cubre: Cloudinary (imágenes/scripts), Wompi (checkout), Stripe (JS), MercadoPago (checkout)
- `referrerPolicy: 'strict-origin-when-cross-origin'`
- `hsts: maxAge=31536000, includeSubDomains, preload`
- Si `CSP_ENABLED=false`, se usa Helmet básico (útil si CSP bloquea recursos de desarrollo)

### Sanitización de chatbot
- `backend/src/modules/chatbot/chatbot.routes.ts`:
  - `sanitizarInput()`: elimina HTML/XML tags, caracteres de control, limita a 500 chars
  - `sanitizarSessionToken()`: solo `[a-zA-Z0-9\-_.]`, max 128 chars
- Aplica a: `POST /` (mensaje + sessionToken) y `POST /interacciones` (productoIds)

### Secret scanning
- Archivo: `backend/.gitleaks.toml` con reglas para: JWT, DB URLs, Google OAuth, Stripe, MP, Wompi, Cloudinary, SMTP
- Uso: `gitleaks detect --source . --config backend/.gitleaks.toml -v`
- Se puede agregar como script en `package.json` o como paso en CI/CD

---

## 📝 Regla: documentar cambios + git commit/push siempre

Cada vez que se modifique el código o la configuración del proyecto, se debe:

### 1. Documentar en AGENTS.md y/o docs/
- Si el cambio afecta el flujo de trabajo de IA → actualizar `AGENTS.md`
- Si el cambio es funcional (rutas, DB, features) → actualizar `docs/` correspondiente
- Si es un milestone → registrar en `docs/worklog.md`

### 2. Hacer git commit con mensaje descriptivo
```bash
git add .
git commit -m "tipo: descripción clara del cambio"
```
Tipos de commit recomendados: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`

### 3. Hacer git push
```bash
git push
```

> **⚠️ Importante:** No dejar cambios sin commitear ni documentación desactualizada. El commit y push son parte obligatoria de cada tarea completada.
