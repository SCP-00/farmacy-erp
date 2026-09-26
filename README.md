# 🌿 Farmacy — Sistema de Gestión de Farmacias

**ERP farmacéutico completo**: tienda online para tus clientes, punto de venta (POS) que **funciona sin internet**, inventario por lotes FEFO, fidelidad con puntos y pagos con Wompi / Stripe / MercadoPago / Efectivo.

[![Tests](https://img.shields.io/badge/Tests-693%20%E2%9C%85-brightgreen)](docs/overview.md#-tests)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](../../actions)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![pnpm](https://img.shields.io/badge/pnpm-only-F69220?logo=pnpm&logoColor=white)](#-instalar-y-correr-en-3-pasos)

---

## 📥 Descargar e instalar (Windows)

**1.** Descarga el instalador más reciente → **[Releases](https://github.com/SCP-00/farmacy-erp/releases/latest)**

| Archivo | Qué es |
|---|---|
| ⚡ **`Farmacy_1.0.0_x64-setup.exe`** (2 MB) | Instalador con asistente — **recomendado** |
| 🐘 **`Farmacy-Portable-1.0.0.exe`** (70 MB) | Un solo .exe, no requiere instalación |

**2.** Ejecuta el instalador (Windows puede mostrar un aviso de SmartScreen por falta de firma digital — elige *"Ejecutar de todas formas"*).

**3.** Abre Farmacy, escribe la dirección de tu servidor en el campo **"Servidor de la empresa"** (o déjalo vacío para usar el backend local) e ingresa.

> **¿Sin instalador?** También funciona como **PWA**: abre la web en Chrome/Edge → menú ⋮ → *"Instalar aplicación"*.

---

## 🖼️ Cómo se ve

| Tienda para el cliente | Punto de venta (POS) |
|---|---|
| ![Tienda](docs/screenshots/01-tienda-home.png) | ![POS](docs/screenshots/08-pos-ticket-electronico.png) |

<details>
<summary><b>📸 Ver galería completa (16 capturas)</b> — cliente, admin, POS, compras, farmacéuta</summary>

**🛒 Cliente (B2C)**

| | |
|---|---|
| **Catálogo** — filtros, búsqueda sin acentos (`acetaminofen` encuentra `Acetaminofén`). | ![Catálogo](docs/screenshots/02-tienda-catalogo.png) |
| **Carrito** — persistente, control de stock y aviso de RX. | ![Carrito](docs/screenshots/03-tienda-carrito.png) |
| **Checkout — envío** — cliente autenticado. | ![Checkout](docs/screenshots/14-checkout-datos.png) |
| **Checkout — pagos** — Wompi, Stripe, MercadoPago, Efectivo, Transferencia. | ![Wompi](docs/screenshots/15-checkout-wompi.png) |
| **Ficha de producto** — info INVIMA/CUM, indicaciones, alérgenos. | ![Producto](docs/screenshots/16-producto-detalle.png) |
| **Mi cuenta** — pedidos y puntos de fidelidad. | ![Cuenta](docs/screenshots/17-cuenta-pedidos.png) |

**🖥️ Administrador**

| | |
|---|---|
| **Login empleados** — RBAC + campo "Servidor de la empresa" en escritorio. | ![Login](docs/screenshots/04-login-admin.png) |
| **Dashboard en vivo** — ventas del día (WebSocket/SSE). | ![Dashboard](docs/screenshots/05-admin-dashboard.png) |

**🧾 POS — offline-first**

| | |
|---|---|
| **Búsqueda instantánea** — atajos F2/F4/F5/F8, lector de códigos de barras USB. | ![POS búsqueda](docs/screenshots/06-pos-busqueda.png) |
| **Venta en curso** — verificación de interacciones medicamentosas. | ![POS venta](docs/screenshots/07-pos-venta-carrito.png) |

**📦 Inventario y compras**

| | |
|---|---|
| **Lotes FEFO** — vencimientos; el POS descuenta el lote más próximo a vencer. | ![Lotes](docs/screenshots/09-inventario-lotes-fefo.png) |
| **Órdenes de compra** — proveedores y recepción de mercancía. | ![Órdenes](docs/screenshots/10-compras-ordenes.png) |
| **Nueva orden** — compras multi-producto con costos. | ![Nueva orden](docs/screenshots/11-compras-nueva-orden.png) |

**👥 Farmacéuta**

| | |
|---|---|
| **Clientes** — historial y perfil de salud (alérgenos). | ![Clientes](docs/screenshots/12-clientes.png) |
| **Fidelidad** — 1 punto por $100 COP, canje y expiración. | ![Fidelidad](docs/screenshots/13-farmaceuta-fidelidad.png) |

*Capturas reales de la app corriendo (backend + PostgreSQL), no maquetadas. Sucursales: [18-sucursales.png](docs/screenshots/18-sucursales.png).*

</details>

---

## ⚡ Qué lo hace diferente

- **El POS funciona sin internet** — la venta se guarda local (IndexedDB) y se sincroniza sola al reconectar, sin duplicar stock ni dinero (idempotencia server-side). Detalles: [ADR 0004](docs/adr/0004-pos-offline-first.md).
- **Un POS por cada PC, un servidor central** — cada escritorio apunta al servidor de la empresa (nube, VPS o LAN) desde el login. Ideal multi-sucursal.
- **Inventario FEFO real** — descuenta por lotes con `SELECT FOR UPDATE`; vencidos no se venden.
- **Reglas de dinero blindadas** — montos y cupones se calculan solo en el servidor; nada de confianza en el cliente. Ver [invariantes](docs/overview.md#-invariantes-de-seguridad-hardening-de-dinero).

---

## 🚀 Probar sin instalar nada (demo con Docker)

```bash
git clone https://github.com/SCP-00/farmacy-erp.git && cd farmacy-erp
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL + Redis
setup.bat          # Windows   (Linux/macOS: ./setup.sh)
./run.ps1          # Windows   (Linux/macOS: cd backend && pnpm dev + cd frontend && pnpm dev)
```

Abre **http://localhost:5173** (tienda) · **http://localhost:5173/admin/login** (admin)

**Cuentas demo:**

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@farmacy.co` | `Admin@1234` |
| Farmacéuta | `farmaceuta@farmacy.co` | `Farm@1234` |
| Auxiliar | `auxiliar@farmacy.co` | `Aux@1234` |
| Cliente | `cliente@ejemplo.co` | `Cliente@1234` |

> El proyecto **solo usa pnpm** (no npm/yarn). Instálalo con `corepack enable pnpm`.

---

## 🧭 Rutas principales

| Rol | Dónde |
|---|---|
| Cliente | `/` — tienda, catálogo, carrito, checkout |
| Empleado | `/admin/login` → dashboard, `/admin/caja/pos`, inventario, compras, reportes |

---

## 🧪 Calidad

693 tests (578 unit + 12 de integración contra PostgreSQL real + 103 frontend) · CI en todos los PRs · secret scanning con Gitleaks · E2E con Playwright. Comandos y cobertura: [docs/overview.md](docs/overview.md#-tests).

---

## 📚 Documentación

| Documento | Qué contiene |
|---|---|
| [Visión técnica](docs/overview.md) | Features completas, arquitectura, persistencia, fidelidad, env vars, invariantes de dinero, Docker |
| [Empaquetado .exe / PWA](docs/packaging-desktop.md) | Tauri, Electron, PWA, configuración del servidor del POS, firma y updates |
| [Deploy en VPS](docs/deploy-guide.md) | Guía paso a paso con Docker y SSL |
| [API y RBAC](docs/api-routes.md) | 72 endpoints, matriz de roles |
| [POS offline-first](docs/adr/0004-pos-offline-first.md) | ADR: outbox IndexedDB, idempotencia, cola de excepciones |
| [Arquitectura](docs/architecture.md) · [Diagrama](docs/architecture-diagram.md) | Diseño del sistema |
| [Seguridad y compliance](docs/security/compliance.md) | Pentest, INVIMA |
| [Monitoreo](docs/monitoreo.md) | Rutina operativa y checklist |

---

## 🤝 Contribuir

1. `corepack enable pnpm` — el monorepo **solo funciona con pnpm**.
2. Rama → cambios → PR (CI + Gitleaks corren en cada PR).
3. Antes de abrir PR: `cd backend && pnpm test` y `cd frontend && pnpm test`.

---

## 📄 Licencia

MIT — ver [LICENSE](LICENSE).

**Proyecto académico** — Universidad Tecnológica de Pereira (UTP) · Ingeniería de Sistemas y Computación
