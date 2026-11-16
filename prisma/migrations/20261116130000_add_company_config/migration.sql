-- Variables globales de la empresa para SIRE.
--
-- El RUC sigue en `companies`; esta tabla guarda el nombre con el que se
-- muestran los reportes y las series de comprobantes por defecto.

CREATE TABLE "company_configurations" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "business_name" TEXT,
  "series" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_configurations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_configurations_company_id_key"
ON "company_configurations"("company_id");

ALTER TABLE "company_configurations"
ADD CONSTRAINT "company_configurations_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
