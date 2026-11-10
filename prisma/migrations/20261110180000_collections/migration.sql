CREATE TABLE IF NOT EXISTS "collections" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "collection_date" TIMESTAMP(3) NOT NULL,
  "customer_name" TEXT NOT NULL,
  "customer_doc" TEXT,
  "invoice_number" TEXT,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "payment_method" TEXT NOT NULL DEFAULT 'TRANSFERENCIA',
  "bank_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REGISTRADO',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "collections_company_id_collection_date_idx" ON "collections"("company_id","collection_date");
ALTER TABLE "collections" ADD CONSTRAINT "collections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
