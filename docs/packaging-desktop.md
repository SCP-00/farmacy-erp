# 📦 Farmacy como aplicación de escritorio (.exe) y PWA

> Farmacy se puede instalar de **tres formas**, todas desde el mismo código fuente, con el mismo backend y la misma lógica offline (outbox IndexedDB + idempotencia). Elige según el escenario de tu farmacia.

## Comparativa rápida

| | 🌐 **PWA instalable** | ⚡ **Tauri (recomendado)** | 🐘 **Electron portable** |
|---|---|---|---|
| **Instalación** | Chrome/Edge → "Instalar app" | Instalador NSIS `.exe` (2,3 MB) | Un `.exe` portable (74 MB), sin instalación |
| **Tamaño** | 0 (usa el navegador ya instalado) | 7,9 MB | 74 MB |
| **Servidor** | El que sirve la web | Configurable en el login | `FARMACY_SERVER_URL` o configurable en el login |
| **Offline (POS)** | ✅ Outbox IndexedDB | ✅ Outbox IndexedDB | ✅ Outbox IndexedDB |
| **Ideal para** | Prueba rápida, cajeros con navegador | Producción multi-sucursal | Equipos bloqueados (sin instalar nada) |

Las tres rutas comparten:
- **Ventana propia / acceso directo** en el escritorio.
- **El mismo frontend** compilado de `frontend/` (React 19 + Vite + PWA).
- **Conexión a cualquier servidor**: nube, VPS o el equipo local — el POS sincroniza contra el servidor que se configure (ver [Configurar el servidor](#configurar-el-servidor-api)).
- **Offline-first**: el cobro nunca depende de la red; al volver la conexión se sincroniza con idempotencia (una sola venta por `idempotencyKey`).

---

## 🌐 Opción 1 — PWA instalable (sin empaquetar)

El frontend ya es una PWA (manifest + service worker con precache de 82 entradas).

1. Despliega `frontend/dist/` detrás de HTTPS (Caddy/Nginx, o el propio backend).
2. Abre la tienda o el POS en **Chrome o Edge**.
3. Menú ⋮ → **"Instalar aplicación"** (o el icono ⊕ en la barra de direcciones).

Verificación rápida: la app abre en ventana propia (`display: standalone`), con icono verde Farmacy y funciona sin red (el POS encola ventas).

## ⚡ Opción 2 — Tauri (instalador .exe, recomendada)

Compila un binario nativo (~8 MB) que embebe el frontend y usa WebView2 (incluido en Windows 10/11).

### Requisitos
- [Rust](https://rustup.rs/) ≥ 1.77 (`rustc --version`)
- [pnpm](https://pnpm.io/) (el proyecto SOLO usa pnpm)
- WebView2 Runtime (viene con Windows 10/11 actualizado)

### Compilar instalador + ejecutable

```bash
cd frontend
pnpm install
pnpm exec tauri build
```

Salida:

| Artefacto | Ruta |
|---|---|
| Ejecutable | `frontend/src-tauri/target/release/farmacy-desktop.exe` |
| Instalador NSIS | `frontend/src-tauri/target/release/bundle/nsis/Farmacy_1.0.0_x64-setup.exe` |

La ventana carga el frontend compilado (`frontend/dist/`). Sin servidor configurado en el login, el escritorio apunta a `http://localhost:3000/api/v1` (backend local).

Modo desarrollo con hot-reload:

```bash
cd frontend && pnpm exec tauri dev
```

## 🐘 Opción 3 — Electron portable (un solo .exe)

Un único ejecutable que **carga la PWA servida por el backend** (una sola fuente de verdad: actualizas el servidor y todos los clientes quedan actualizados).

### Requisitos
- Node.js ≥ 18 + pnpm

### Compilar portable + instalador

```bash
# desde la raíz del monorepo
pnpm install          # desktop/ es parte del workspace
cd desktop
pnpm run dist         # portable
pnpm run dist:installer  # instalador NSIS (opcional)
```

Salida: `desktop/dist-electron/Farmacy-Portable-1.0.0.exe` (~74 MB).

### Configurar el servidor que carga

| Método | Valor |
|---|---|
| Variable de entorno | `FARMACY_SERVER_URL=https://api.mi-farmacia.co` al arrancar |
| Por defecto | `http://localhost:3000` (backend local) |

---

## Configurar el servidor API

El frontend resuelve la URL del backend en este orden:

1. **`VITE_API_URL` compilada** — deploys web fijos (nube/staging). Si existe, el campo del login se oculta.
2. **Servidor guardado desde el login** — en builds de escritorio, el campo **"Servidor de la empresa"** permite apuntar a `https://api.mi-farmacia.com` una sola vez (se guarda en `localStorage` bajo la clave `farmacy.apiBaseUrl`).
3. **`http://localhost:3000/api/v1`** — por defecto solo en escritorio (Tauri/Electron), coherente con un backend instalado en el mismo equipo.
4. **`/api/v1`** — en web (mismo origen, con proxy del servidor).

Esto permite el escenario de **empresa real**: un servidor central (VPS/nube con PostgreSQL + Redis) y N cajas POS conectadas desde cualquier sucursal — cada escritorio apunta a su servidor y el outbox local garantiza que las ventas se sincronicen sin duplicar stock.

## Seguridad del empaquetado

- **Credenciales de prueba del login**: solo se muestran con `import.meta.env.DEV` (build de desarrollo). En producción no se publicitan usuarios.
- **Electron**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; enlaces externos se abren en el navegador del sistema; menú de desarrollo solo en builds no empaquetados.
- **Tauri**: capabilities mínimas (ventana + abrir enlaces externos); CSP configurable en `frontend/src-tauri/tauri.conf.json`.
- Los instaladores no están firmados digitalmente (sin certificado de código); Windows SmartScreen puede mostrar un aviso — es esperado en software open-source sin firma.

## Compilación cruzada y firma (roadmap)

- **Tauri**: GitHub Actions con `tauri-apps/tauri-action` puede generar instaladores para Windows/macOS/Linux en cada tag (`v*`).
- **Electron**: `electron-builder --win --linux --mac` en CI; para firmar, define `CSC_LINK` y `CSC_KEY_PASSWORD` (certificado de code-signing) y los artefactos saldrán firmados.
- **Actualizaciones automáticas**: Tauri updater + endpoint de firma; Electron `electron-updater` contra GitHub Releases.
