# knowledge.md — Farmacy (Sistema de Gestión de Farmacias)

## Qué es este proyecto

**Farmacy** es un ERP de farmacias con dos caras:

- **Tienda B2C pública** (React SPA): catálogo, carrito, checkout, pagos online, fidelidad con puntos, chatbot, Google OAuth.
- **Panel administrativo POS**: punto de venta, cierre y arqueo de caja, inventario FEFO por lotes, compras/proveedores, empleados con RBAC, reportes, impresión en térmica.

Stack: TypeScript en todo, pnpm workspaces monorepo, Express + Prisma + PostgreSQL + Redis/BullMQ en `backend/`, React 19 + Vite 6 + Tailwind 4 + Zustand + React Query en `frontend/`.

**Escenario de despliegue objetivo:** una farmacia con **varias cajas/sucursales en LAN** (servidor local, no cloud). Esto manda sobre el diseño: el POS debe seguir vendiendo si se cae la red (offline-first), el stock no puede oversellearse entre cajas simultáneas, y los respaldos se restauran en el mismo servidor.

**Estado actual:** nivel de producción para operar en LAN. Fuera de alcance por ahora (la farmacia es un supuesto académico): DIAN/facturación electrónica, medicamentos controlados, recetas médicas, firma de código para autoinstalar actualizaciones.

## Reglas duras (leer antes de tocar nada)

- **SOLO `pnpm`.** Nada de `npm` ni `yarn`; el workspace se rompe.
- **El schema de Prisma vive en `database/prisma/schema.prisma`**, NO en `backend/prisma/`. Todo comando de Prisma debe llevar `--schema=../database/prisma/schema.prisma`.
- **Después de cualquier `prisma generate` hay que copiar el client a mano.** Los scripts `db:*` usan `npx prisma ...` y **no** disparan el post-generate. El `tsconfig` del backend mapea `@prisma/client` a `./node_modules/.prisma/client`, y pnpm lo deja en `node_modules/.pnpm/...`; por eso existe `backend/scripts/prisma-postgenerate.js`. Usa `pnpm dev` (que corre `predev` = generate + copia) o `node scripts/prisma-postgenerate.js` a mano. Si los tipos de Prisma aparecen como `any`/no existen, es esto.
- `docker compose down -v` borra los volúmenes y **toda la data**. Nunca usar `-v` salvo reset intencional.
- `.env` no está en git. Los 3 secretos JWT son distintos y no intercambiables: `JWT_SECRET` (empleados), `JWT_REFRESH_SECRET` (refresh), `JWT_CLIENTE_SECRET` (B2C). Plantilla en `.env.example`.
- ESLint 8 (no flat config) con `--ext` — mantener ese estilo en los scripts de lint.

## Comandos

```bash
# Infra de desarrollo (Postgres 15 :5432, Redis 7 :6379, pgAdmin :5050)
docker compose -f docker-compose.dev.yml up -d

# Backend (desde backend/)                      # Frontend (desde frontend/)
pnpm run dev        # nodemon (predev = prisma     pnpm run dev        # vite :5173
                    #  generate + copia client)
pnpm run build      # tsc                         pnpm run build      # tsc && vite build
pnpm run lint       # eslint src --ext .ts         pnpm run lint       # eslint ts,tsx
pnpm test           # vitest run (650)             pnpm exec vitest run  # vitest en watch
pnpm run test:integration                          # 19 tests contra PG real

# Prisma (desde backend/, todos con --schema=../database/prisma/schema.prisma)
pnpm run db:generate | db:migrate | db:migrate:deploy | db:push | db:seed | db:studio

# Tests E2E (desde la raíz — Playwright)
pnpm run e2e        # también: e2e:ui, e2e:headed, e2e:debug, e2e:report

# Full stack producción con Docker
docker compose up -d --build    # + Caddy (SSL)
```

`pnpm run test:integration` **no aplica migraciones**: requiere `DATABASE_URL` apuntando a una Postgres real que ya tenga `migrate deploy` + seeds aplicados (eso es lo que hace el workflow de CI antes de testear). Corren **secuenciales** (`singleFork`) porque comparten la base y los números de venta, así que no corren en paralelo. Verifica el impacto en los datos antes de apuntarlos a un entorno con data real.

Setup inicial: `setup.bat` / `setup.ps1` (Windows) y `setup.sh` (Linux/macOS); arranque con `run.ps1`. Build SEO del frontend: `pnpm run build:seo` (build + prerender SSG). Empaquetado desktop: `desktop/` (Electron portable), `frontend/src-tauri/` (Tauri v2), `pnpm run build` en frontend (PWA).

## Dónde vive el código

- `backend/src/app.ts` (monta rutas + Swagger) / `server.ts` (bootstrap). API bajo `/api/v1`.
- `backend/src/modules/` — 24 módulos REST: auth, auth-cliente, productos, lotes, inventario, ventas, **caja**, **impresion**, clientes, compras, proveedores, categorias, sucursales, empleados, pagos, reportes, imagenes, chatbot, push, auditoria, config, cupones, importador, health.
- `backend/src/services/` — lógica compartida: `inventario`, `ventas`, **`caja`**, **`impresion`**, eventbus, sse, websocket, push, interacciones, prerender.
- `backend/src/middlewares/`, `src/schemas/` (zod), `src/jobs/` (BullMQ: `fidelidad`, `alertas`, `email`, `csv-export`, `queue`), `src/config/`, `src/utils/` (`escpos`, `respaldo`, `jwt`, `logger`, `respuesta`, `texto`).
- `backend/src/__tests__/` — 39 archivos unitarios (650 tests) + `integration/` 5 archivos (19 tests) contra Postgres real: ventas, búsqueda, **caja**, **impresión**, **concurrencia**.
- `frontend/src/pages/tienda/` (B2C), `pages/admin/` (panel), `pages/auth/`, `store/` (Zustand), `services/` (llamadas API + `impresion.ts`, `actualizacion.ts`), `components/`, `hooks/`. 8 archivos de test (111 tests).
- `database/` — `prisma/schema.prisma` (26 modelos), `migrations/` (0001_init → **0006_caja_arqueo**), `seeds/`, `queries/`, `scripts/` (backups), `init/`.
- `e2e/` — Playwright (Chromium). CI en `.github/workflows/`: `ci.yml` (Prisma schema validation, backend, frontend), `e2e-smoke.yml`, `secret-scanning.yml` (Gitleaks).
- `docs/` — punto de entrada `index.md`; luego `overview.md`, `architecture.md`, `api-routes.md` (endpoints + matriz RBAC), `deploy-guide.md`, `monitoreo.md`, **`backups.md`**, **`impresion-termica.md`**, `packaging-desktop.md`, `guia-personalizacion.md`, más `adr/`, `features/`, `security/`, `screenshots/`.

## Invariantes de negocio (no duplicar en otro lado)

- **Dinero 100% server-side.** El cliente NUNCA envía precios, montos ni descuentos. B2C solo manda `productoId + cantidad + cupón + puntosUsados` (recortados al saldo real); Wompi/MercadoPago toman el monto de la DB. Cupones se validan contra `codigos_descuento`.
- **Fidelidad:** regla ÚNICA en `VentasService.registrarVenta()`: `floor((total - costoEnvio) * PUNTOS_POR_PESO)`. Las devoluciones revierten con el mismo factor.
- **FEFO atómico:** `InventarioService.descontarStockFEFO` usa `SELECT FOR UPDATE` + `decrement` revalidado dentro del lock. Toda venta pasa por ahí. **Nunca tocar `cantidadActual` directamente** fuera de la transacción.
- **Cierre de caja:** el cajero solo declara `efectivoContado` (y opcionalmente denominaciones). **El servidor calcula todos los totales por método de pago y el `efectivo_esperado`** desde las ventas + movimientos (`caja.service.ts`: `calcularResumenCaja`, `calcularDiferencia`, `clasificarMetodoPago`). Un `CajaMovimiento` INGRESO/SANGRIA con motivo ajusta el efectivo esperado, no las ventas. Guardas: 404 caja inexistente, 409 caja cerrada, 403 si un farmaceuta opera caja ajena, 400 ventas `PENDIENTE`, 422 zod.
- **Concurrencia multi-caja:** el oversell es el riesgo #1 del escenario LAN. El invariante está fijado por test contra Postgres real (stock 5 + 12 ventas simultáneas de 1 → exactamente 5 ok, stock 0, `vendido + restante = total`). Si tocas el descuento de stock, ese test debe seguir verde.
- **Impresión ESC/POS:** el motor (`escpos.utils.ts`) y el transporte TCP 9100 (`impresion.service.ts`) son propios; desde el frontend primero red (backend) y si no hay impresora, WebUSB (`impresion.ts`). `POST /tirilla/:ventaId` devuelve 200 con `impreso:false` si no hay impresora configurada, 502 si falla la red.
- **Respaldos:** el ciclo es generar → **verificar** → restaurar. `verificar-backup.sh` restaura el `.sql.gz` en un esquema temporal y compara conteos y huellas antes de escribir `BACKUP_ULTIMO_OK`; sin ese paso un respaldo no cuenta como bueno. Nunca combines `pg_dump --compress=9` con `| gzip` (doble gzip → no restaurable).
- **RBAC:** 3 roles — `ADMINISTRADOR` / `FARMACEUTA` / `AUXILIAR` (matriz en `docs/api-routes.md`).
- **Auth:** dos mundos separados — empleados (JWT + refresh rotation + blacklist en Redis) y clientes B2C (`JWT_CLIENTE_SECRET` + Google OAuth).
- **Config de negocio editable sin deploy:** tabla `config_param` en DB. Incluye `PUNTOS_POR_PESO`, `PUNTOS_VIGENCIA_DIAS`, `ENVIO_*`, `DEVOLUCION_DIAS_LIMITE`, `PEDIDO_HUERFANO_HORAS`, **`BACKUP_ULTIMO_OK`** (lo escribe el verificador), **`IMPRESORA_SUCURSAL_<id>`** y **`IMPRESORA_DEFAULT`** (host:puerto, 9100 por defecto).

## Variables de entorno que se olvidan fácil

Además de `.env.example`: `BACKUP_MAX_HORAS` (umbral de vencimiento que lee `/api/v1/health/backup` y el job `alertas.ts`; default 26) y `BACKUP_REMOTE_TARGET` (destino offsite; si contiene `:` usa rclone, si no `cp`). **`FRONTEND_DIST_PATH`** (ruta absoluta a `frontend/dist`) hace que el backend sirva la SPA además de la API — necesario en LAN sin Nginx y para que el Electron portable no abra un JSON 404. Todas están ya en `.env.example`.

## Empaquetado de escritorio: qué sirve qué

Los tres artefactos existen y compilan, pero **no son equivalentes**:

| Artefacto | Ruta | Dónde está el frontend |
|---|---|---|
| Tauri ejecutable | `frontend/src-tauri/target/release/farmacy-desktop.exe` | **Embebido** en el `.exe` |
| Tauri instalador NSIS | `frontend/src-tauri/target/release/bundle/nsis/Farmacy_1.0.0_x64-setup.exe` | **Embebido** |
| Electron portable | `desktop/dist-electron/Farmacy-Portable-1.0.0.exe` | **Servido por el backend** (`FARMACY_SERVER_URL`, por defecto `:3000`) |

Consecuencia práctica: al cambiar código del frontend hay que **recompilar Tauri** (`cd frontend && pnpm exec tauri build`, ~2 min con el cargo cacheado), pero **Electron no se recompila** — siempre descarga la SPA del servidor, así que basta con reiniciar el backend.

Al probar el `.exe` de Tauri: aparece en `tasklist` como `farmacy-desktop` con `MainWindowTitle` "Farmacy - Punto de Venta". No se puede leer su DOM (usa WebView2, no CDP), así que la prueba real de que la app habla con el backend es mirar las peticiones en el log del servidor al abrirla.

Probar el `.exe` de Electron a fondo sí es posible con `playwright._electron.launch({ executablePath: 'desktop/dist-electron/win-unpacked/Farmacy.exe' })`: da DOM, texto y capturas del binario realmente empaquetado.

`pnpm exec tauri build` **debe** correr con cwd en `frontend/`: si se invoca el CLI de Tauri desde otra ruta compila el `src-tauri` de otro proyecto. Ojo con esto si hay más proyectos Tauri en la máquina.

## Gotchas del entorno

- **Consola Windows en cp1252:** los heredocs con acentos se corrompen al ejecutar. Para crear `.sql`/`.sh`/código con tildes, escribir el archivo con la herramienta de edición (UTF-8) y ejecutarlo con `-f`; nunca pegarlo por `echo`.
- **`PORT=0` puede venir exportado en el shell**, y `dotenv` no sobreescribe variables existentes: el backend arranca en un puerto aleatorio y loguea una URL que no existe. Si `localhost:3000` no responde, revisa `echo $PORT` antes que el código. (`PORT` está validado como `z.string()`, así que un valor no numérico también pasa.)
- **El botón "Cobrar" del POS abre un `window.confirm()` nativo** cuando hay descuento. Es un diálogo del navegador, no del DOM: bloquea el renderer y las herramientas de automatización se quedan esperando sin poder aceptarlo. Para automatizar el POS, cobra sin descuento o envía el `Enter` al diálogo.
- Para lanzar procesos de larga duración que deban sobrevivir entre llamadas a la terminal, `nohup ... &` no basta en Git Bash y `setsid` no existe. Usar `node -e "spawn(cmd, {detached:true, stdio:'ignore'}).unref()"` o `cmd //c start /b`.
- **Postgres local en Windows:** servicio de Windows, binarios en `C:/Program Files/PostgreSQL/15/bin/` (no están en el PATH — `backup.sh` ya resuelve `PG_BIN`/rutas conocidas). El usuario de la app (`farmacy_user`) **no tiene `CREATEDB`**, por eso la verificación de respaldos usa un esquema temporal en vez de una base nueva.
- **Playwright:** el Chromium de Playwright está en `C:/Users/andyh/AppData/Local/ms-playwright/chromium-*/chrome-win64/chrome.exe`; si falta la descarga, pasar `executablePath` explícito.
- **No versionar:** `.freebuff/` y `scripts-temp/` ya están en `.gitignore`. Stagear archivos uno por uno o por carpeta; nunca `git add -A` a ciegas.
- **GitHub:** `gh` CLI puede no estar autenticado. Para pushes de un solo uso, usar `GIT_ASKPASS` con un script temporal en `scripts-temp/` en vez de escribir el token en `.git/config` o en la URL del remote; **rotar cualquier token que se haya mostrado en una transcripción**.
- Commits directos a `main`, Conventional Commits **en español** (`feat(caja):`, `fix(backups):`, `test(concurrencia):`, `docs:`), con cuerpo que explique el porqué.

## Convenciones

- **Idioma:** código, nombres de dominio y mensajes en **español** (`VentasService`, `registrarVenta`, `calcularResumenCaja`). Mantener coherencia.
- **Validación:** zod en backend (`src/schemas/`), react-hook-form + zod en frontend.
- **Pagos:** Wompi (HMAC + anti-replay nonce/timestamp), Stripe (webhook firmado), MercadoPago, Efectivo (POS). Webhooks con rate limit e IP allowlist (`WEBHOOK_IP_ALLOWLIST`).
- **Tiempo real:** WebSocket + SSE para dashboard y POS concurrente.
- **Jobs:** `fidelidad.ts` expira puntos (03:00) y barre pedidos huérfaños B2C; `alertas.ts` manda emails (incluye alerta de respaldo vencido/fallido).
- **Logs:** winston con rotación diaria; Sentry en backend y frontend.
- **Tests:** vitest en ambos paquetes, coverage v8.
- **Versionado del cliente:** `frontend/vite.config.ts` inyecta `VITE_APP_VERSION` desde `package.json` vía `define`; `services/actualizacion.ts` la compara contra GitHub Releases y muestra `AvisoActualizacion` una vez por versión (nunca lanza si no hay red).
- **Credenciales de desarrollo (seeds):** `admin@farmacy.co / Admin@1234`, `farmaceuta@farmacy.co / Farm@1234`, `auxiliar@farmacy.co / Aux@1234`, `cliente@ejemplo.co / Cliente@1234`.
- **Secrets:** nunca hardcodear; Gitleaks corre en cada push/PR.
