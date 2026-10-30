# 🌿 Farmacy — ERP y punto de venta para farmacias

**ES:** Punto de venta que **sigue vendiendo sin internet**, tienda B2C, inventario por lotes FEFO, fidelidad por puntos y cuatro medios de pago. TypeScript, PostgreSQL, Redis, Docker.
**EN:** Pharmacy ERP with an offline-capable POS, B2C storefront, FEFO batch inventory, loyalty points and four payment gateways. 693 automated tests; CI on every pull request.

[![Tests](https://img.shields.io/badge/Tests-693%20%E2%9C%85-brightgreen)](docs/overview.md#-tests)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](../../actions)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue)](LICENSE)
[![pnpm](https://img.shields.io/badge/pnpm-only-F69220?logo=pnpm&logoColor=white)](#-probarlo-sin-instalar-nada)

---

## Mi rol en el proyecto

Lo construí dirigiendo agentes de IA. La implementación la generan ellos; el criterio, el alcance y la verificación son míos:

- **Alcance y especificación.** Definí qué entraba en la v1 y qué reglas de negocio no se negocian: FEFO en el descuento de lotes, idempotencia del POS offline (que reconectar no duplique stock ni dinero) y cálculo de montos exclusivamente en el servidor.
- **Modelo de datos.** Diseñé el esquema relacional en PostgreSQL y las invariantes de dinero que el backend hace cumplir.
- **Criterio de aceptación.** Escribí los casos y mantengo la suite de **693 pruebas** que decide si un cambio se publica.
- **Integración de pagos.** Cuatro pasarelas (Wompi, Stripe, MercadoPago, efectivo) y el flujo de conciliación de cada una.
- **Documentación.** Visión técnica, ADR del POS offline-first, guía de despliegue en VPS y matriz de roles.

## Cómo se ve

Capturas reales de la aplicación corriendo con backend y PostgreSQL, no maquetas.

| Tienda para el cliente | Punto de venta (POS) |
|---|---|
| ![Tienda](docs/screenshots/01-tienda-home.png) | ![POS](docs/screenshots/08-pos-ticket-electronico.png) |

<details>
<summary><b>📸 Ver galería completa (16 capturas)</b> — cliente, admin, POS, compras, farmacéutico</summary>

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

**👥 Farmacéutico**

| | |
|---|---|
| **Clientes** — historial y perfil de salud (alérgenos). | ![Clientes](docs/screenshots/12-clientes.png) |
| **Fidelidad** — 1 punto por $100 COP, canje y expiración. | ![Fidelidad](docs/screenshots/13-farmaceuta-fidelidad.png) |

Sucursales: [18-sucursales.png](docs/screenshots/18-sucursales.png).
</details>

## Qué resuelve

- **El POS funciona sin internet.** La venta se guarda local en IndexedDB y se sincroniza sola al reconectar, sin duplicar stock ni dinero (idempotencia del lado del servidor). Detalle: [ADR 0004](docs/adr/0004-pos-offline-first.md).
- **Un POS por PC, un servidor central.** Cada escritorio apunta al servidor de la empresa (nube, VPS o LAN) desde el login. Sirve para varias sucursales.
- **Inventario FEFO real.** Descuenta por lotes con `SELECT FOR UPDATE`; los vencidos no se venden.
- **Reglas de dinero blindadas.** Montos y cupones se calculan solo en el servidor. Ver [invariantes](docs/overview.md#-invariantes-de-seguridad-hardening-de-dinero).

## Stack

`TypeScript` `React` `Node/Express` `PostgreSQL` `Prisma` `Redis` `WebSocket/SSE` `Docker` `Tauri (escritorio)` `Playwright`

## Probarlo sin instalar nada

```bash
git clone https://github.com/SCP-00/farmacy-erp.git && cd farmacy-erp
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL + Redis
setup.bat                                        # Linux/macOS: ./setup.sh
./run.ps1                                        # Linux/macOS: backend y frontend con pnpm dev
```

Abre **http://localhost:5173** (tienda) y **http://localhost:5173/admin/login** (admin).

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@farmacy.co` | `Admin@1234` |
| Farmacéutico | `farmaceuta@farmacy.co` | `Farm@1234` |
| Auxiliar | `auxiliar@farmacy.co` | `Aux@1234` |
| Cliente | `cliente@ejemplo.co` | `Cliente@1234` |

> El proyecto usa **solo pnpm**: `corepack enable pnpm`.

### Descargar para Windows

Instalador más reciente en **[Releases](https://github.com/SCP-00/farmacy-erp/releases/latest)**: `Farmacy_1.0.0_x64-setup.exe` (2 MB, recomendado) o `Farmacy-Portable-1.0.0.exe` (70 MB, sin instalación). También funciona como **PWA** desde Chrome/Edge → menú ⋮ → *Instalar aplicación*.

Windows mostrará SmartScreen porque el ejecutable no está firmado; elige *Ejecutar de todas formas*.

## Rutas principales

| Rol | Dónde |
|---|---|
| Cliente | `/` — tienda, catálogo, carrito, checkout |
| Empleado | `/admin/login` → dashboard, `/admin/caja/pos`, inventario, compras, reportes |

## Calidad

**693 pruebas** (578 unitarias + 12 de integración contra PostgreSQL real + 103 de frontend), CI en cada PR, secret scanning con Gitleaks y E2E con Playwright. Comandos y cobertura: [docs/overview.md](docs/overview.md#-tests).

## Documentación

| Documento | Qué contiene |
|---|---|
| [Visión técnica](docs/overview.md) | Features, arquitectura, persistencia, fidelidad, variables de entorno, invariantes de dinero, Docker |
| [Empaquetado .exe / PWA](docs/packaging-desktop.md) | Tauri, Electron, PWA, configuración del servidor del POS, firma y actualizaciones |
| [Deploy en VPS](docs/deploy-guide.md) | Guía paso a paso con Docker y SSL |
| [API y RBAC](docs/api-routes.md) | 72 endpoints y matriz de roles |
| [POS offline-first](docs/adr/0004-pos-offline-first.md) | ADR: outbox IndexedDB, idempotencia, cola de excepciones |
| [Arquitectura](docs/architecture.md) · [Diagrama](docs/architecture-diagram.md) | Diseño del sistema |
| [Seguridad y compliance](docs/security/compliance.md) | Pentest, INVIMA |
| [Monitoreo](docs/monitoreo.md) | Rutina operativa y checklist |

## Contribuir

1. `corepack enable pnpm` — el monorepo solo funciona con pnpm.
2. Rama → cambios → PR (CI y Gitleaks corren en cada PR).
3. Antes de abrir PR: `cd backend && pnpm test` y `cd frontend && pnpm test`.

## Licencia

Apache-2.0 — ver [LICENSE](LICENSE).

Proyecto académico · Universidad Tecnológica de Pereira (UTP) · Ingeniería de Sistemas y Computación.
