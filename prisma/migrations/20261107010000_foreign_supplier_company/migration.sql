ALTER TABLE "foreign_suppliers"
  ADD COLUMN "company_id" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "contact_name" TEXT,
  ADD COLUMN "payment_terms" TEXT,
  ADD COLUMN "bank_name" TEXT,
  ADD COLUMN "bank_account" TEXT,
  ADD COLUMN "swift_code" TEXT,
  ADD COLUMN "vessel_name" TEXT,
  ADD COLUMN "voyage_number" TEXT,
  ADD COLUMN "bl_number" TEXT,
  ADD COLUMN "port_origin" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Los proveedores existentes se asignan a la primera empresa; el equipo debe
-- revisar el reparto antes de aplicar esta migración en producción.
UPDATE "foreign_suppliers"
SET "company_id" = (SELECT "id" FROM "companies" ORDER BY "created_at" ASC LIMIT 1)
WHERE "company_id" IS NULL;

ALTER TABLE "foreign_suppliers" ALTER COLUMN "company_id" SET NOT NULL;

CREATE UNIQUE INDEX "foreign_suppliers_company_id_tax_id_key"
  ON "foreign_suppliers"("company_id", "tax_id");
CREATE INDEX "foreign_suppliers_company_id_business_name_idx"
  ON "foreign_suppliers"("company_id", "business_name");

ALTER TABLE "foreign_suppliers"
  ADD CONSTRAINT "foreign_suppliers_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
