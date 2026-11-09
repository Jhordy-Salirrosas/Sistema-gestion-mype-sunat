-- No aplicada. NOT VALID permite revisar históricos sin inventar vínculos.
CREATE UNIQUE INDEX "uq_invoice_tenant_id" ON "invoices"("company_id", "id");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_referenced_invoice_id_fkey"
  FOREIGN KEY ("company_id", "referenced_invoice_id") REFERENCES "invoices"("company_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "invoices" ADD CONSTRAINT "m1_note_requires_origin"
  CHECK ("tipo_comprobante" NOT IN ('07', '08') OR "referenced_invoice_id" IS NOT NULL) NOT VALID;
-- Revisar/reparar históricos con evidencia antes de VALIDATE CONSTRAINT.
