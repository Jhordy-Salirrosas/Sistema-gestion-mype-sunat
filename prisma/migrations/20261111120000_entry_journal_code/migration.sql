ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "journal_code" TEXT NOT NULL DEFAULT 'OPV';
CREATE INDEX IF NOT EXISTS "accounting_entries_company_id_period_journal_code_idx" ON "accounting_entries"("company_id","period","journal_code");
