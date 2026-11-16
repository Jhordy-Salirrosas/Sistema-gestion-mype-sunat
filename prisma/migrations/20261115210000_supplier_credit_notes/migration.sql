ALTER TABLE "national_purchases" ADD COLUMN "credit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
CREATE TABLE "supplier_credit_notes" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "purchase_id" TEXT NOT NULL, "note_number" TEXT NOT NULL,
  "issue_date" TIMESTAMP(3) NOT NULL, "amount" DECIMAL(14,2) NOT NULL, "net_amount" DECIMAL(14,2) NOT NULL,
  "igv_amount" DECIMAL(14,2) NOT NULL, "reason" TEXT NOT NULL, "notes" TEXT, "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "supplier_credit_notes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "supplier_credit_notes_company_id_note_number_key" ON "supplier_credit_notes"("company_id","note_number");
CREATE INDEX "supplier_credit_notes_company_id_issue_date_idx" ON "supplier_credit_notes"("company_id","issue_date");
CREATE INDEX "supplier_credit_notes_purchase_id_idx" ON "supplier_credit_notes"("purchase_id");
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "national_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
