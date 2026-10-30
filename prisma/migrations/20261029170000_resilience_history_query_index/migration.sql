CREATE INDEX "transaction_history_invoice_id_created_at_idx"
ON "transaction_history"("invoice_id", "created_at");
