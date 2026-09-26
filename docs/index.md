# Documentation module

> 🚨 **pnpm-only.** Este proyecto SOLO usa `pnpm`. NO uses `npm` ni `yarn`. Todo: instalación, scripts, workspace monorepo, CI/CD.

This folder is the living documentation hub for Farmacy (SGF).

## How to use
- Update these docs whenever a module moves from planned to delivered.
- Keep decisions in ADRs so future changes are traceable.
- Reference real files and scripts, not aspirational behavior.

## Map
- 🏗️ **Architecture Diagram:** [docs/architecture-diagram.md](architecture-diagram.md) — Mermaid diagrama completo frontend↔backend↔DB
- Architecture overview: [docs/architecture.md](architecture.md)
- 📍 **API Routes:** [docs/api-routes.md](api-routes.md) — 72 endpoints, 40+ frontend pages, RBAC matrix
- Decisions (ADRs): [docs/adr/](adr/)
  - [ADR-0001](adr/0001-env-source-of-truth-and-ports.md): Standardized ports and environmental variables.
  - [ADR-0002](adr/0001-env-source-of-truth-and-ports.md#adr-0002-colombian-regulatory-invima-cum-data-model): Colombian INVIMA/CUM regulatory compliance.
  - [ADR-0003](adr/0001-env-source-of-truth-and-ports.md#adr-0003-payment-gateways-wompi-stripe-mercadopago): Payment gateways (Wompi, Stripe, MercadoPago).
- Phase tracking: [docs/phase-0-checklist.md](phase-0-checklist.md)
- Work log: [docs/worklog.md](worklog.md)
- 🌐 **Features**:
  - [B2C — Tienda en Línea](features/b2c.md) — Catálogo, autenticación, persistencia, puntos de fidelidad
  - [💳 Pagos — Pasarelas y Efectivo](features/payments.md) — Wompi, Stripe, MercadoPago, efectivo, puntos, contra entrega
- 📦 **Distribución**:
  - [Empaquetado escritorio y PWA](packaging-desktop.md) — Instalador Tauri (.exe), Electron portable, PWA instalable; conexión del POS a servidores en nube/LAN/local
  - [ADR-0004 — POS offline-first](adr/0004-pos-offline-first.md) — Outbox IndexedDB, idempotencia de ventas, cola de excepciones
- 🔒 **Security**:
  - [Seguridad y Compliance](security/compliance.md) — Pentest, medidas, INVIMA, persistencia DB

## Estado del proyecto (2026-05-28)

| Métrica | Valor |
|---|---|
| Backend TypeScript 6.0 | ✅ 0 errores |
| Frontend TypeScript 6.0 | ✅ 0 errores |
| Tests unitarios | ✅ **536/536** pasan (28 archivos) |
| Cobertura | **95.35%** statements (94.87% functions) |
| Tests E2E (Playwright) | ✅ **29 tests** (chromium + mobile) |
| Pentest automático | ✅ **109 tests** (88 PASS, 0 vulnerabilidades) |
| React | 19.2.6 |
| Tailwind CSS | 4.3.0 |
| Módulos backend | **19** activos (+Push +Auditoría +SSE +WS +Jobs) |
| Páginas frontend | 40+ (tienda + admin + auth) |
| Pasarelas de pago | Wompi, Stripe, MercadoPago, Efectivo |
| Roadmap | ✅ **13 fases completadas** (Must/Should/Could) |
| RBAC | ✅ ADMINISTRADOR / FARMACEUTA / AUXILIAR |
| Tiempo real | ✅ WebSockets + SSE + BullMQ + Push + Chatbot WS |
| PWA | ✅ Service Worker + offline fallback + installable |
| SEO | ✅ Meta tags + OG + sitemap + robots + SSG parcial |
| CI/CD | ✅ GitHub Actions (3 workflows) |
| Docker producción | ✅ Caddy SSL + resource limits + healthchecks + backup |
| Secret scanning | ✅ Gitleaks en todos los PRs |
| Vite | 6.4.2 |
| Node.js | 24.x |
