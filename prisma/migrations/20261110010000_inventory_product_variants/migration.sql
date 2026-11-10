-- AlterTable
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "attributes" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventory_product_variants" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "variant_name" TEXT NOT NULL,
    "attribute_values" JSONB,
    "barcode" TEXT,
    "additional_cost" DECIMAL(14,4) DEFAULT 0.0000,
    "price_override" DECIMAL(14,2),
    "current_stock" DECIMAL(12,4) DEFAULT 0.0000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_product_variants_company_id_sku_key" ON "inventory_product_variants"("company_id", "sku");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inventory_product_variants_company_id_product_id_idx" ON "inventory_product_variants"("company_id", "product_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventory_product_variants_company_id_fkey'
    ) THEN
        ALTER TABLE "inventory_product_variants" ADD CONSTRAINT "inventory_product_variants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventory_product_variants_product_id_fkey'
    ) THEN
        ALTER TABLE "inventory_product_variants" ADD CONSTRAINT "inventory_product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

