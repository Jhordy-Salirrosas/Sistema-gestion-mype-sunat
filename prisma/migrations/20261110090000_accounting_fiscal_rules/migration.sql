CREATE TABLE IF NOT EXISTS "accounting_fiscal_years" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ABIERTO',
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  CONSTRAINT "accounting_fiscal_years_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_fiscal_years_company_id_year_key" ON "accounting_fiscal_years"("company_id","year");
CREATE INDEX IF NOT EXISTS "accounting_fiscal_years_company_id_status_idx" ON "accounting_fiscal_years"("company_id","status");
ALTER TABLE "accounting_fiscal_years" ADD CONSTRAINT "accounting_fiscal_years_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "accounting_rules" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "process_code" TEXT NOT NULL,
  "document_type" TEXT NOT NULL DEFAULT '*',
  "line_order" INTEGER NOT NULL,
  "account_code" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "base_calculation" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "accounting_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_rules_company_id_process_code_document_type_line_order_key" ON "accounting_rules"("company_id","process_code","document_type","line_order");
CREATE INDEX IF NOT EXISTS "accounting_rules_company_id_process_code_is_active_idx" ON "accounting_rules"("company_id","process_code","is_active");
ALTER TABLE "accounting_rules" ADD CONSTRAINT "accounting_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
