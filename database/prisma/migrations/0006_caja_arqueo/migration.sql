-- Arqueo de caja real: separa el efectivo FÍSICO contado por el cajero de los
-- totales de SISTEMA por método, y añade movimientos manuales de efectivo
-- (sangría/ingreso) que afectan el efectivo esperado al cierre.

ALTER TABLE "cajas" ADD COLUMN "total_ingresos" DECIMAL(12,2);
ALTER TABLE "cajas" ADD COLUMN "total_sangrias" DECIMAL(12,2);
ALTER TABLE "cajas" ADD COLUMN "efectivo_esperado" DECIMAL(12,2);
ALTER TABLE "cajas" ADD COLUMN "efectivo_contado" DECIMAL(12,2);
ALTER TABLE "cajas" ADD COLUMN "denominaciones" JSONB;

-- Tipo de movimiento de efectivo del turno
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'SANGRIA');

CREATE TABLE "caja_movimientos" (
    "id" UUID NOT NULL,
    "caja_id" UUID NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "motivo" VARCHAR(255) NOT NULL,
    "empleado_id" UUID NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caja_movimientos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "caja_movimientos_caja_id_creado_en_idx" ON "caja_movimientos"("caja_id", "creado_en");

ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_caja_id_fkey"
    FOREIGN KEY ("caja_id") REFERENCES "cajas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "caja_movimientos" ADD CONSTRAINT "caja_movimientos_empleado_id_fkey"
    FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
