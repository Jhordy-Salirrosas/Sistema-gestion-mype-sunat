CREATE TYPE "PurchaseOrderStatus" AS ENUM ('BORRADOR', 'APROBADA', 'ANULADA', 'CONVERTIDA');
CREATE TABLE "purchase_orders" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "order_number" TEXT NOT NULL,
  "supplier_id" TEXT, "supplier_doc_number" TEXT NOT NULL, "supplier_name" TEXT NOT NULL,
  "warehouse_code" TEXT NOT NULL DEFAULT 'ALM-01', "issue_date" TIMESTAMP(3) NOT NULL,
  "expected_date" TIMESTAMP(3), "currency_code" TEXT NOT NULL DEFAULT 'PEN',
  "prices_include_igv" BOOLEAN NOT NULL DEFAULT false,
  "net_amount" DECIMAL(14,2) NOT NULL, "igv_amount" DECIMAL(14,2) NOT NULL, "total_amount" DECIMAL(14,2) NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'BORRADOR', "notes" TEXT, "created_by" TEXT,
  "converted_purchase_id" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "purchase_order_items" (
  "id" TEXT NOT NULL, "order_id" TEXT NOT NULL, "product_id" TEXT NOT NULL, "sku" TEXT NOT NULL,
  "description" TEXT NOT NULL, "unit_code" TEXT NOT NULL DEFAULT 'NIU', "quantity" DECIMAL(12,4) NOT NULL,
  "unit_cost" DECIMAL(14,4) NOT NULL, "subtotal" DECIMAL(14,2) NOT NULL, "igv_amount" DECIMAL(14,2) NOT NULL,
  "total_amount" DECIMAL(14,2) NOT NULL, CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "purchase_orders_company_id_order_number_key" ON "purchase_orders"("company_id","order_number");
CREATE INDEX "purchase_orders_company_id_issue_date_idx" ON "purchase_orders"("company_id","issue_date");
CREATE INDEX "purchase_order_items_order_id_idx" ON "purchase_order_items"("order_id");
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
