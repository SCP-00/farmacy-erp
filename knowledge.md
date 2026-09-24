# knowledge.md — Farmacy (Sistema de Gestión de Farmacias)

## Qué es este proyecto

**Farmacy** es un ERP de farmacias (proyecto académico UTP) con dos caras:

- **Tienda B2C pública** (React SPA): catálogo, carrito, checkout, pagos online, fidelidad con puntos, chatbot, Google OAuth.
- **Panel administrativo POS**: punto de venta, control de caja, inventario FEFO por lotes, compras/proveedores, empleados con RBAC, reportes.

Stack: TypeScript en todo, pnpm workspaces monorepo, Express + Prisma + PostgreSQL + Redis/BullMQ en `backend/`, React 19 + Vite 6 + Tailwind CSS 4 + Zustand + React Query en `frontend/`.

## Reglas duras (leer antes de tocar nada)

- **SOLO `pnpm`.** Nada de `npm` ni `yarn` (los lockfiles no existen y el workspace se rompe).
- **El schema de Prisma vive en `database/prisma/schema.prisma`**, NO en `backend/prisma/`. Todos los comandos de Prisma deben pasar `--schema=../database/prisma/schema.prisma` (los scripts del backend ya lo hacen; si agregas uno nuevo, hazlo también).
- `docker compose down -v` borra los volúmenes y **toda la data**. Nunca usar `-v` salvo reset intencional.
- `.env` no está en git. Requeridas: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_CLIENTE_SECRET` (los 3 JWT distintos: empleados, refresh, clientes B2C). Template en `.env.example`.
- ESLint 8 (no flat config) con `--ext .ts` — mantener ese estilo en scripts de lint.

## Comandos

```bash
# Infra de desarrollo (Postgres 15 :5432, Redis 7 :6379, pgAdmin :5050)
docker compose -f docker-compose.dev.yml up -d

# Backend (desde backend/)            # Frontend (desde frontend/)
pnpm run dev            # nodemon       pnpm run dev        # vite :5173
pnpm run build          # tsc           pnpm run build      # tsc && vite build
pnpm run lint           # eslint        pnpm run lint       # eslint ts,tsx
pnpm test               # vitest run    pnpm test           # vitest (watch)

# Prisma (desde backend/)
pnpm run db:generate | db:migrate | db:migrate:deploy | db:push | db:seed | db:studio

# Tests E2E (desde la raíz — Playwright)
pnpm run e2e            # también: e2e:ui, e2e:headed, e2e:debug, e2e:report

# Full stack producción con Docker
docker compose up -d --build    # + Caddy (SSL)
```

Setup inicial: `setup.bat` (Windows) / `setup.sh` (Linux/macOS); arrancar todo con `run.ps1`.
Frontend SEO build: `pnpm run build:seo` (build + prerender SSG).

## Dónde vive el código

- `backend/src/app.ts` / `server.ts` — entrypoints. API bajo `/api/v1`.
- `backend/src/modules/` — 19 módulos REST (auth, auth-cliente, productos, lotes, inventario, ventas, caja, clientes, compras, proveedores, categorias, sucursales, empleados, pagos, reportes, imagenes, chatbot, push, auditoria).
- `backend/src/services/` — lógica compartida (inventario, SSE, WebSocket).
- `backend/src/middlewares/`, `backend/src/schemas/` (zod), `backend/src/jobs/` (BullMQ workers), `backend/src/config/`, `backend/src/utils/`.
- `backend/src/__tests__/` — 28 archivos de test (vitest, ~546 tests, cobertura ~95%).
- `frontend/src/pages/tienda/` — páginas B2C; `frontend/src/pages/admin/` — panel admin; `frontend/src/pages/auth/` — autenticación.
- `frontend/src/store/` (Zustand), `frontend/src/services/` (API calls), `frontend/src/components/`, `frontend/src/hooks/`.
- `database/` — schema Prisma (17 modelos), `seeds/`, `queries/`, `scripts/`, `init/`.
- `e2e/` — tests Playwright (Chromium).
- Docs técnicas: `docs/` (architecture.md, api-routes.md — 72 endpoints + matriz RBAC, deploy-guide.md, monitoreo.md, features/, security/, adr/).

## Convenciones y notas

- **Idioma**: código, nombres de dominio y mensajes en español (VentasService, registrarVenta, HORARIO_INICIO...). Mantener coherencia.
- **RBAC**: 3 roles — ADMINISTRADOR / FARMACEUTA / AUXILIAR. Matriz en `docs/api-routes.md`.
- **Autenticación**: dos mundos separados — empleados (JWT + refresh rotation + blacklist Redis) y clientes B2C (`JWT_CLIENTE_SECRET`, + Google OAuth vía passport).
- **FEFO**: el inventario sale por lotes con vencimiento más próximo (First Expired, First Out). Toda venta/ajuste pasa por servicios de inventario, no tocar stock directo.
- **Fidelidad**: regla ÚNICA server-side en `VentasService.registrarVenta()`: `floor((total - costoEnvio) * PUNTOS_POR_PESO)` con `PUNTOS_POR_PESO` de `config_param` (0.01 → 1 punto/$100). Vigencia `PUNTOS_VIGENCIA_DIAS` (365). NO duplicar la lógica en rutas; devoluciones la revierten con el mismo factor.
- **Dinero 100% server-side (invariante)**: el cliente NUNCA envía precios, montos ni descuentos. B2C envía solo `productoId+cantidad+código de cupón+puntosUsados` (recortado al saldo real). Wompi/MercadoPago toman el monto de la DB. Cupones se validan contra `codigos_descuento` (POST /cupones/validar para preview).
- **FEFO atómico**: `InventarioService.descontarStockFEFO` usa `SELECT FOR UPDATE` + `decrement` revalidado dentro del lock. Toda venta pasa por ahí; nunca tocar `cantidadActual` directo fuera de transacciones.
- **Jobs de mantenimiento** (`backend/src/jobs/fidelidad.ts`): expiración de puntos (03:00 diaria) y sweeper de pedidos huérfaños B2C `PENDIENTE` sin pago aprobado tras `PEDIDO_HUERFANO_HORAS` (24h) → estado `EXPIRADO` + reintegro de stock solo a lotes vigentes + reversión de cupón.
- **Config de negocio en `config_param`** (DB, editable sin deploy): `ENVIO_GRATIS_DESDE`, `ENVIO_COSTO_DEFAULT`, `ENVIO_TARIFAS_CIUDADES` (JSON), `PUNTOS_POR_PESO`, `PUNTOS_VIGENCIA_DIAS`, `DEVOLUCION_DIAS_LIMITE`, `PEDIDO_HUERFANO_HORAS`.
- **Margen**: `DetalleVenta.costoUnitario` guarda el precio de compra del lote vendido → margen real por venta disponible en reportes.
- **Pagos**: 4 pasarelas — Wompi (HMAC + anti-replay nonce/timestamp), Stripe (webhook con firma), MercadoPago, Efectivo (POS). Webhooks con rate limit e IP allowlist opcional (`WEBHOOK_IP_ALLOWLIST`).
- **Validación**: zod en backend (`src/schemas/`), react-hook-form + zod en frontend.
- **Tiempo real**: WebSocket + SSE para dashboard y POS concurrente.
- **Tests**: vitest en ambos paquetes (config en `backend/vitest.config.ts`); coverage v8.
- **Credenciales de desarrollo (seeds)**: `admin@farmacy.co / Admin@1234`, `farmaceuta@farmacy.co / Farm@1234`, `auxiliar@farmacy.co / Aux@1234`, `cliente@ejemplo.co / Cliente@1234`.
- **Logs**: winston con rotación diaria; Sentry en backend y frontend.
- **Secrets**: nunca hardcodear; Gitleaks corre en todos los PRs (GitHub Actions).
