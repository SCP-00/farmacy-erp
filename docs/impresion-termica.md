# Impresora térmica ESC/POS

El POS imprime tirillas de 80 mm en impresoras térmicas estándar (Epson TM-T20/T88
y compatibles) generando **comandos ESC/POS** directamente, sin drivers.

## Dos transportes

| Transporte | Cuándo | Cómo |
|---|---|---|
| **Red (TCP 9100)** | Varias cajas en LAN. Una impresora por sede. Recomendado. | El backend imprime a la IP de la impresora. No requiere nada en el navegador. |
| **USB directo (WebUSB)** | Una impresora USB conectada a la caja. | El navegador (Chrome/Edge) manda los bytes a la impresora. |

El POS usa USB si hay una impresora guardada en ese equipo; si no, imprime por red.

## Configurar la impresora de red

En **Caja → Impresora** (solo ADMIN), o por API:

```http
PUT /api/v1/impresion/config
{ "sucursalId": 1, "host": "192.168.1.50", "port": 9100, "ancho": 48, "abrirCajon": true }
```

- `host` — IP o nombre de red de la impresora.
- `port` — puerto RAW (9100 por defecto en casi todas).
- `ancho` — caracteres por línea (48 para 80 mm en fuente A; 42 es un valor seguro).
- `abrirCajon` — pulso al **cajón de dinero** al cobrar (conector RJ11 de la impresora).

Sin `sucursalId` se guarda la configuración **de respaldo** (`IMPRESORA_DEFAULT`), que
usan las sedes sin impresora propia. La configuración vive en `config_param`: es
editable sin desplegar.

## API

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/impresion/config` | Lista las impresoras configuradas (ADMIN) |
| `PUT` | `/impresion/config` | Guarda la impresora de una sede (ADMIN) |
| `GET` | `/impresion/tirilla/:ventaId` | Bytes ESC/POS (`application/octet-stream`) |
| `POST` | `/impresion/tirilla/:ventaId` | Imprime en la impresora de red |

`POST .../tirilla/:id` devuelve `{ impreso: false, motivo }` (HTTP 200) si la sede no
tiene impresora: no es un error, el POS cae a la impresión del navegador.

## Detalles del formato

- Codificación **CP1252** (`ESC t 16`) para acentos del español.
- Corte automático y avance de 3 líneas al final.
- Negrita/altura doble en el nombre del negocio y el TOTAL.
- Datos del encabezado desde `config_param`: `FARMACIA_NOMBRE`, `FARMACIA_NIT`,
  `FARMACIA_DIRECCION`, `FARMACIA_TELEFONO`.

## Probar sin hardware

El motor ESC/POS es puro y se testea a nivel de bytes:

```bash
cd backend && pnpm exec vitest run src/__tests__/escpos.utils.test.ts src/__tests__/impresion.service.test.ts
```

`impresion.service.test.ts` levanta un **servidor TCP local** que captura los bytes y
verifica que le lleguen íntegros: no necesita impresora real.

## Impresoras probadas/recomendadas

- **Epson TM-T20III / TM-T88** (USB y Ethernet) — referencia del mercado.
- **Genéricas 80 mm con Ethernet** — compatibles ESC/POS, puerto 9100.
- La impresora debe aceptar **RAW/JetDirect** por el puerto 9100.
