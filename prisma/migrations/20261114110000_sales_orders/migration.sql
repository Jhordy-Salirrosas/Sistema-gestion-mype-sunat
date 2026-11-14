CREATE TYPE "SalesDocumentKind" AS ENUM ('COTIZACION', 'PEDIDO');
ALTER TABLE "sales_quotes" ADD COLUMN "kind" "SalesDocumentKind" NOT NULL DEFAULT 'COTIZACION';
DROP INDEX IF EXISTS "sales_quotes_company_id_status_issue_date_idx";
CREATE INDEX "sales_quotes_company_id_kind_status_issue_date_idx" ON "sales_quotes"("company_id","kind","status","issue_date");
