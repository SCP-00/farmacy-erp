-- Offline fase 1 (ADR 0004): idempotencia de sincronización del POS.
-- Cada venta creada desde el outbox del POS trae una idempotency_key (UUID
-- generado localmente). El endpoint la registra UNIQUE: si la misma venta
-- llega dos veces (retry de red), la segunda devuelve la venta original
-- sin reprocesar — sin doble descuento de stock ni venta duplicada.
CREATE TABLE "ventas_sync" (
    "idempotency_key" UUID NOT NULL,
    "venta_id" UUID NOT NULL,
    -- UNIQUE: relacion 1-1 (una venta se sincroniza una sola vez)
    "sincronizada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ventas_sync_pkey" PRIMARY KEY ("idempotency_key")
);

CREATE INDEX "ventas_sync_venta_id_idx" ON "ventas_sync"("venta_id");

ALTER TABLE "ventas_sync" ADD CONSTRAINT "ventas_sync_venta_id_fkey"
  FOREIGN KEY ("venta_id") REFERENCES "ventas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ventas_sync" ADD CONSTRAINT "ventas_sync_venta_id_key" UNIQUE ("venta_id");
