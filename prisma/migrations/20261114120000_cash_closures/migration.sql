CREATE TABLE "cash_closures" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "closure_date" DATE NOT NULL,
  "sales_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "collections_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "cash_collections" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "cash_expenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "expected_cash" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "counted_cash" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "difference" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "details" JSONB,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CERRADA',
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_closures_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cash_closures_company_id_closure_date_key" ON "cash_closures"("company_id","closure_date");
CREATE INDEX "cash_closures_company_id_closure_date_idx" ON "cash_closures"("company_id","closure_date");
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
