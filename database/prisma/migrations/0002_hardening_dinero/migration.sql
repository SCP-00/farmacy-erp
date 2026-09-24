-- Hardening de dinero y fidelidad — Farmacy
-- 1) Puntos usados quedan auditados en la venta (antes solo un decremento opaco en cliente)
ALTER TABLE "ventas" ADD COLUMN "puntos_usados" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ventas" ADD COLUMN "codigo_descuento_id" UUID;

-- 2) Costo del lote al momento de la venta (margen real por venta)
ALTER TABLE "detalles_venta" ADD COLUMN "costo_unitario" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 3) Configuración de negocio editable sin deploy (antes hardcodeada en rutas)
CREATE TABLE "config_param" (
    "clave" VARCHAR(100) NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "config_param_pkey" PRIMARY KEY ("clave")
);

INSERT INTO "config_param" ("clave", "valor", "descripcion") VALUES
  ('ENVIO_GRATIS_DESDE',    '50000', 'Subtotal mínimo (COP) para envío gratis'),
  ('ENVIO_COSTO_DEFAULT',   '10000', 'Costo de envío para ciudades sin tarifa'),
  ('PUNTOS_POR_PESO',       '0.01',  'Puntos ganados por cada peso COP de la base de puntos'),
  ('PUNTOS_VIGENCIA_DIAS',  '365',   'Días de vigencia de los puntos desde la compra'),
  ('DEVOLUCION_DIAS_LIMITE','15',    'Días máximos para procesar una devolución'),
  ('PEDIDO_HUERFANO_HORAS', '24',    'Horas antes de cancelar una venta PENDIENTE sin pago confirmado')
ON CONFLICT ("clave") DO NOTHING;

-- 4) Cupón demo (antes hardcodeado SOLO en el frontend → cupones gratis para cualquiera)
INSERT INTO "codigos_descuento" ("id", "codigo", "tipo", "valor", "activo")
VALUES (gen_random_uuid(), 'FARMACY10', 'PORCENTAJE', 10, true)
ON CONFLICT ("codigo") DO NOTHING;

-- 5) FK ventas → codigos_descuento
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_codigo_descuento_id_fkey"
  FOREIGN KEY ("codigo_descuento_id") REFERENCES "codigos_descuento"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) Índices para los jobs de fidelidad y pedidos huérfanos
CREATE INDEX "ventas_estado_creado_idx"     ON "ventas"("estado", "creado_en");
CREATE INDEX "clientes_puntos_expiran_idx"  ON "clientes"("puntos_expiran_en");
