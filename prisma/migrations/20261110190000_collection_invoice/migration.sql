ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "invoice_id" TEXT;
CREATE INDEX IF NOT EXISTS "collections_company_id_invoice_id_idx" ON "collections"("company_id","invoice_id");
