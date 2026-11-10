CREATE TABLE IF NOT EXISTS "expenses" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "expense_date" TIMESTAMP(3) NOT NULL,
  "supplier_name" TEXT NOT NULL,
  "supplier_doc" TEXT,
  "document_type" TEXT NOT NULL DEFAULT '01',
  "document_number" TEXT,
  "description" TEXT NOT NULL,
  "base_amount" DECIMAL(14,2) NOT NULL,
  "igv_amount" DECIMAL(14,2) NOT NULL,
  "total_amount" DECIMAL(14,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REGISTRADO',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "expenses_company_id_expense_date_idx" ON "expenses"("company_id","expense_date");
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
