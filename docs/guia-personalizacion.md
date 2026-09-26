# Guía de personalización por farmacia

Farmacy está diseñado para que **cada farmacia lo adapte sin tocar código**.
Toda la personalización de negocio vive en la tabla `config_param` (base de
datos) y se expone al frontend vía `GET /api/v1/config/publico`.

## Cómo funciona

1. El backend lee los parámetros de `config_param` (cache de 60s en Redis).
2. `GET /api/v1/config/publico` devuelve **solo** las claves de la whitelist
   (`CLAVES_PUBLICAS` en `backend/src/modules/config/config.routes.ts`).
   Hay un filtro defensivo en código: aunque alguien guarde un secret en
   `config_param`, este endpoint nunca lo expone.
3. Para cambiar un valor: `UPDATE config_param SET valor='...' WHERE clave='...'`
   y luego `POST /api/v1/config/invalidar-cache` (o esperar 60s).

## Parámetros disponibles

| Clave | Qué controla | Ejemplo |
|---|---|---|
| `ENVIO_GRATIS_DESDE` | Subtotal mínimo (COP) para envío gratis | `50000` |
| `ENVIO_COSTO_DEFAULT` | Costo de envío para ciudades sin tarifa | `10000` |
| `ENVIO_TARIFAS_CIUDADES` | Tarifas por ciudad (JSON) | `{"bogotá":5000,"pereira":5000}` |
| `PUNTOS_POR_PESO` | Puntos ganados por cada peso pagado (sin envío) | `0.01` (1 punto / $100) |
| `PUNTOS_VIGENCIA_DIAS` | Días de vigencia de los puntos | `365` |
| `DEVOLUCION_DIAS_LIMITE` | Días máximos para devolución | `15` |
| `PEDIDO_HUERFANO_HORAS` | Horas antes de cancelar pedido sin pago | `24` |
| `FARMACIA_NOMBRE` | Nombre comercial de la tienda | `Droguería La Salud` |
| `FARMACIA_TELEFONO` / `FARMACIA_DIRECCION` / `FARMACIA_WHATSAPP` | Datos de contacto públicos | |
| `TIENDA_LEMA` | Eslogan en la portada | `Tus medicamentos en 24h` |
| `TIENDA_BANNER_ACTIVO` / `TIENDA_MENSAJE_BANNER` | Banner promocional de la tienda | `true` / `Vacunación sabados` |
| `CHATBOT_ACTIVADO` | Mostrar u ocultar FarmaBot | `true` |

## Escenarios típicos

**Farmacia de barrio (1 sede, envío propio):** bajar `ENVIO_GRATIS_DESDE`
a 30000, tarifas planas del barrio en `ENVIO_TARIFAS_CIUDADES`, contacto de
WhatsApp, lema propio.

**Cadena pequeña (3 sedes):** subir `PEDIDO_HUERFANO_HORAS` a 48, vigencia
de puntos a 180 días para rotarlos más rápido, banner de promociones por
temporada actualizado sin deploy.

**Recompensa agresiva:** `PUNTOS_POR_PESO=0.02` (2 puntos por $100) —
aplica a POS y B2C por la misma regla única del código.

## Personalización de identidad visual

Los colores, logo y tipografía se cambian editando tokens de Tailwind en
`frontend/src/index.css` (variables CSS `--primary`, etc.). Es la única
parte que todavía requiere tocar un archivo; moverla a `config_param` con
CSS dinámico está en el roadmap (ver ADR offline, fase 3).
