CREATE TYPE "SalesQuoteStatus" AS ENUM ('BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'CONVERTIDA', 'ANULADA');
CREATE TABLE "sales_quotes" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "quote_number" TEXT NOT NULL,
  "customer_doc_type" TEXT NOT NULL DEFAULT '6',
  "customer_doc_number" TEXT,
  "customer_name" TEXT NOT NULL,
  "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_until" TIMESTAMP(3),
  "currency_code" TEXT NOT NULL DEFAULT 'PEN',
  "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "igv_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "SalesQuoteStatus" NOT NULL DEFAULT 'BORRADOR',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sales_quotes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "sales_quote_items" (
  "id" TEXT NOT NULL,
  "quote_id" TEXT NOT NULL,
  "item_order" INTEGER NOT NULL DEFAULT 1,
  "sku" TEXT,
  "description" TEXT NOT NULL,
  "unit_code" TEXT NOT NULL DEFAULT 'NIU',
  "quantity" DECIMAL(12,4) NOT NULL,
  "unit_price" DECIMAL(14,4) NOT NULL,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "igv_amount" DECIMAL(14,2) NOT NULL,
  "total_amount" DECIMAL(14,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_quote_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_quotes_company_id_quote_number_key" ON "sales_quotes"("company_id","quote_number");
CREATE INDEX "sales_quotes_company_id_status_issue_date_idx" ON "sales_quotes"("company_id","status","issue_date");
CREATE INDEX "sales_quote_items_quote_id_item_order_idx" ON "sales_quote_items"("quote_id","item_order");
ALTER TABLE "sales_quotes" ADD CONSTRAINT "sales_quotes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_quote_items" ADD CONSTRAINT "sales_quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "sales_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
