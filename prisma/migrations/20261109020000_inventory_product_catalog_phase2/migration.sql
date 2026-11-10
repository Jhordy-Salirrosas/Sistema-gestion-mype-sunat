-- AlterTable inventory_products
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "origin_type" TEXT NOT NULL DEFAULT 'NACIONAL';
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "is_service" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "country_of_origin" TEXT DEFAULT 'PE';
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "cost_price" DECIMAL(14, 4);
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "sale_price" DECIMAL(14, 2);
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "wholesale_price" DECIMAL(14, 2);
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "promo_price" DECIMAL(14, 2);
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "commission_rate" DECIMAL(5, 2);
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "min_price" DECIMAL(14, 2);
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "warehouse_location" TEXT;

-- CreateTable inventory_brands
CREATE TABLE IF NOT EXISTS "inventory_brands" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_brands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_brands_company_id_code_key" ON "inventory_brands"("company_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_brands_company_id_name_key" ON "inventory_brands"("company_id", "name");
CREATE INDEX IF NOT EXISTS "inventory_brands_company_id_idx" ON "inventory_brands"("company_id");

-- CreateTable inventory_models
CREATE TABLE IF NOT EXISTS "inventory_models" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand_name" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_models_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_models_company_id_code_key" ON "inventory_models"("company_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_models_company_id_idx" ON "inventory_models"("company_id");

-- CreateTable inventory_categories
CREATE TABLE IF NOT EXISTS "inventory_categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sunat_code" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_categories_company_id_code_key" ON "inventory_categories"("company_id", "code");
CREATE INDEX IF NOT EXISTS "inventory_categories_company_id_idx" ON "inventory_categories"("company_id");

-- CreateTable inventory_manufacturers
CREATE TABLE IF NOT EXISTS "inventory_manufacturers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country_code" TEXT NOT NULL DEFAULT 'PE',
    "website" TEXT,
    "contact_info" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_manufacturers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_manufacturers_company_id_name_key" ON "inventory_manufacturers"("company_id", "name");
CREATE INDEX IF NOT EXISTS "inventory_manufacturers_company_id_idx" ON "inventory_manufacturers"("company_id");

-- CreateTable inventory_tags
CREATE TABLE IF NOT EXISTS "inventory_tags" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT 'emerald',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_tags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_tags_company_id_name_key" ON "inventory_tags"("company_id", "name");
CREATE INDEX IF NOT EXISTS "inventory_tags_company_id_idx" ON "inventory_tags"("company_id");

-- CreateTable sunat_unit_measurements
CREATE TABLE IF NOT EXISTS "sunat_unit_measurements" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sunat_unit_measurements_pkey" PRIMARY KEY ("code")
);

-- CreateTable inventory_product_suppliers
CREATE TABLE IF NOT EXISTS "inventory_product_suppliers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "supplier_product_code" TEXT,
    "purchase_cost" DECIMAL(14, 4),
    "currency_code" TEXT NOT NULL DEFAULT 'PEN',
    "lead_time_days" INTEGER DEFAULT 0,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_product_suppliers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_product_suppliers_product_id_supplier_id_key" ON "inventory_product_suppliers"("product_id", "supplier_id");
CREATE INDEX IF NOT EXISTS "inventory_product_suppliers_company_id_product_id_idx" ON "inventory_product_suppliers"("company_id", "product_id");
CREATE INDEX IF NOT EXISTS "inventory_product_suppliers_supplier_id_idx" ON "inventory_product_suppliers"("supplier_id");

-- CreateTable inventory_product_presentations
CREATE TABLE IF NOT EXISTS "inventory_product_presentations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "presentation_name" TEXT NOT NULL,
    "factor" DECIMAL(12, 4) NOT NULL,
    "sunat_unit_code" TEXT NOT NULL DEFAULT 'BX',
    "barcode" TEXT,
    "sale_price" DECIMAL(14, 2),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_product_presentations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_product_presentations_product_id_presentation_name_key" ON "inventory_product_presentations"("product_id", "presentation_name");
CREATE INDEX IF NOT EXISTS "inventory_product_presentations_company_id_product_id_idx" ON "inventory_product_presentations"("company_id", "product_id");

