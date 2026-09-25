# ADR 0004: POS offline-first (fase 1 implementada)

> **Estado de implementación**: fase 1 lista — outbox IndexedDB
> (`frontend/src/services/outboxOffline.ts`, integrado en el POS),
> idempotencia server-side (`ventas_sync` + `idempotencyKey` en
> `POST /ventas`, migración `0004_offline_fase1`) y sync con reintento
> exponencial + cola de excepciones. Fases 2 y 3 siguen en diseño.

## Contexto

La venta POS de Farmacy hoy requiere conexión activa con el backend: cada
venta hace `POST /ventas` contra la API que descuenta stock FEFO en
PostgreSQL. La competencia comercial en Colombia (Alegra POS, Sistecpos)
ofrece explícitamente "facturación POS sin conexión a internet" — y en
farmacias de barrio los cortes de internet son rutina, no excepción.

Un POS que se congela cuando cae la red **no es vendible** como sistema
operativo de farmacia, sin importar cuántas funciones tenga.

Este ADR **diseña** la arquitectura; la implementación es la fase más cara
del roadmap y por eso se documenta antes de escribir código.

## Decisión

### 1. Cola de salida local (client-side)

El POS escribe cada venta en un **outbox local** (IndexedDB vía la librería
`idb`) ANTES de intentar enviarla al servidor:

```
[POS UI] → 1. validar localmente (schema zod compartido)
         → 2. guardar en outbox IndexedDB con estado "pendiente"
         → 3. intentar POST /ventas (con idempotency-key = UUID del outbox)
              ├─ 2xx → marcar "sincronizada", quitar de cola activa
              └─ error de red → queda en cola; Service Worker reintenta
                 con backoff exponencial cuando vuelve la conexión
```

- La UI muestra siempre el estado de sincronización por venta (icono).
- El carrito/caja NO bloquea el cobro: cobrar es siempre posible en local.

### 2. Idempotencia (la clave de todo)

Cada venta local lleva `idempotencyKey` (UUID generado en el POS). El
endpoint `POST /ventas` acepta ese campo y:

- si es la primera vez → procesa normal y guarda la key en una tabla
  `ventas_sync(idempotency_key UNIQUE, venta_id)`;
- si la key ya existe → devuelve la venta original sin reprocesar
  (evita doble descuento de stock cuando el POS reintenta).

Sin esta tabla, la sincronización duplica ventas. Es el componente no
negociable del diseño.

### 3. Conflictos de stock — resolución honesta

El stock en el servidor es la única verdad. Al sincronizar una venta que
descuenta stock, pueden pasar tres cosas:

| Caso | Resolución |
|---|---|
| Stock suficiente | Venta se aplica normal |
| Stock parcial (lote FEFO cambió) | El backend descuenta lo que pueda con la lógica FEFO actual y responde con las líneas afectadas; el POS muestra "venta sincronizada con ajuste" y el detalle |
| Stock insuficiente total (otra caja vendió lo último offline) | La venta NO se rechaza: se marca `estado='SIN_STOCK'` para revisión humana en cola de excepciones. En farmacia, anular una venta ya impresa a un cliente real es peor que dejarla en revisión: el farmacéuta decide |

Inventario negativo NO se permite: las ventas `SIN_STOCK` quedan colgadas
de una decisión humana, nunca descuentan de más.

### 4. Catálogo offline

El catálogo (productos + precios) se cachea en IndexedDB con TTL y se
refresca en cada arranque con conexión. Precios SIEMPRE server-side cuando
hay red; en modo offline se usan los cacheados (es el precio que la
farmacia puso en su último sync — aceptable y documentado).

### 5. Qué NO hace el modo offline (explícito)

- No emite pagos de pasarelas (Wompi/Stripe requieren red — es efectivo
  únicamente).
- No consulta programas de fidelidad de otros clientes ni valida cupones
  contra la DB (los cupones se validan al sincronizar; si el cupón ya no
  vale, la venta entra en cola de excepciones).
- No imprime factura electrónica (DIAN es futuro; el ticket POS local es
  "documento no fiscal" mientras tanto).

### 6. Encaje con Tauri (opción de empaquetado, no requisito)

El POS offline NO requiere Tauri: con Service Worker + IndexedDB funciona
en el navegador y en una PWA instalable (el frontend ya es PWA con
Workbox). Tauri es una decisión de empaquetado/distribución posterior:

- **Fase 1 (esta): outbox + idempotencia + sync** — funciona en navegador.
- **Fase 2**: Tauri envuelve el frontend; el backend Node/Express puede
  correr como **sidecar** para farmacias que quieran el servidor local
  (Prisma + Postgres embebido es el mayor riesgo técnico — evaluar
  alternativas: LiteFS, o dejar el server en la nube y solo offline el POS).
- **Fase 3**: personalización visual (logo/colores) leída de config_param
  y aplicada como CSS dinámico, completando "cada farmacia su propia app".

## Consecuencias

- Positivas: el POS sobrevive a cortes de red (requisito comercial real);
  idempotencia beneficia también al modo online (retries seguros);
  cola de excepciones da al farmacéuta control de casos borde.
- Costos: complejidad de sync (el código más delicado del sistema),
  nueva tabla `ventas_sync`, pruebas de concurrencia offline/online
  imprescindibles, UX de estados de sincronización.
- Riesgos: conflictos de stock mal resueltos generan desconfianza — por
  eso la resolución es conservadora (revisión humana antes que inventario
  negativo) y requiere prueba piloto en una sola caja antes de desplegar.
