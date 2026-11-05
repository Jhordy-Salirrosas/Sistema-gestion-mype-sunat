-- Fase 2: Compras nacionales (Facturas y Boletas de compra)
-- Migración aditiva.

DO $$ BEGIN
  CREATE TYPE "NationalPurchaseStatus" AS ENUM ('REGISTRADA', 'ANULADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "national_purchases" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "purchase_number" TEXT NOT NULL,
    "supplier_id" TEXT,
    "supplier_doc_type" TEXT NOT NULL DEFAULT '6',
    "supplier_doc_number" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "document_type_code" TEXT NOT NULL DEFAULT '01',
    "document_serial" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "accounting_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency_code" TEXT NOT NULL DEFAULT 'PEN',
    "exchange_rate" DECIMAL(14,6),
    "warehouse_code" TEXT NOT NULL DEFAULT 'ALM-01',
    "net_amount" DECIMAL(14,2) NOT NULL,
    "igv_amount" DECIMAL(14,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "status" "NationalPurchaseStatus" NOT NULL DEFAULT 'REGISTRADA',
    "notes" TEXT,
    "responsible" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "national_purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_national_purchase_doc"
    ON "national_purchases"("company_id", "supplier_doc_number", "document_type_code", "document_serial", "document_number");
CREATE INDEX IF NOT EXISTS "national_purchases_company_id_issue_date_idx"
    ON "national_purchases"("company_id", "issue_date");

DO $$ BEGIN
    ALTER TABLE "national_purchases"
        ADD CONSTRAINT "national_purchases_company_id_fkey"
        FOREIGN KEY ("company_id") REFERENCES "companies"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "national_purchases"
        ADD CONSTRAINT "national_purchases_supplier_id_fkey"
        FOREIGN KEY ("supplier_id") REFERENCES "business_partners"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "national_purchase_items" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit_code" TEXT NOT NULL DEFAULT 'NIU',
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_cost" DECIMAL(14,4) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "igv_amount" DECIMAL(14,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "national_purchase_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "national_purchase_items_purchase_id_idx"
    ON "national_purchase_items"("purchase_id");
CREATE INDEX IF NOT EXISTS "national_purchase_items_product_id_idx"
    ON "national_purchase_items"("product_id");

DO $$ BEGIN
    ALTER TABLE "national_purchase_items"
        ADD CONSTRAINT "national_purchase_items_purchase_id_fkey"
        FOREIGN KEY ("purchase_id") REFERENCES "national_purchases"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "national_purchase_items"
        ADD CONSTRAINT "national_purchase_items_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

