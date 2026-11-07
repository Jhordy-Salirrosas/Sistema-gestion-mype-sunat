ALTER TABLE "accounting_entries" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "accounting_entries_company_id_idempotency_key_key"
  ON "accounting_entries"("company_id", "idempotency_key");
