-- Mapeo contable de los conceptos SIRE a cuentas del PCGE.
--
-- Cada empresa define una cuenta por tipo de operación; el índice único
-- permite guardar el conjunto completo con upserts.

CREATE TABLE "sire_accounting_mappings" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "tipo_operacion" TEXT NOT NULL,
  "cuenta_contable" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sire_accounting_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sire_accounting_mappings_company_id_tipo_operacion_key"
ON "sire_accounting_mappings"("company_id","tipo_operacion");

CREATE INDEX "sire_accounting_mappings_company_id_idx"
ON "sire_accounting_mappings"("company_id");

ALTER TABLE "sire_accounting_mappings"
ADD CONSTRAINT "sire_accounting_mappings_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
