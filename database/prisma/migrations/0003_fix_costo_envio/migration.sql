-- Correctivo: el modelo Venta define costoEnvio (envío B2C) pero la
-- migración inicial nunca creó la columna. Detectado por la nueva suite
-- de integración contra DB real (los mocks no revelan drift de esquema).
ALTER TABLE "ventas" ADD COLUMN IF NOT EXISTS "costo_envio" DECIMAL(12,2) NOT NULL DEFAULT 0;
