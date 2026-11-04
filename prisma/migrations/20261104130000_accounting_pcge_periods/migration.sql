-- P0 contabilidad: catálogo PCGE y períodos por empresa.

CREATE TYPE "AccountingPeriodStatus" AS ENUM ('ABIERTO', 'CERRADO');

CREATE TABLE "accounting_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "parent_code" TEXT,
    "level" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "accounting_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounting_accounts_code_key" ON "accounting_accounts"("code");
CREATE INDEX "accounting_accounts_parent_code_idx" ON "accounting_accounts"("parent_code");
CREATE INDEX "accounting_accounts_element_idx" ON "accounting_accounts"("element");

CREATE TABLE "accounting_periods" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'ABIERTO',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounting_periods_company_id_period_key" ON "accounting_periods"("company_id", "period");
CREATE INDEX "accounting_periods_company_id_year_month_idx" ON "accounting_periods"("company_id", "year", "month");

ALTER TABLE "accounting_periods"
    ADD CONSTRAINT "accounting_periods_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
