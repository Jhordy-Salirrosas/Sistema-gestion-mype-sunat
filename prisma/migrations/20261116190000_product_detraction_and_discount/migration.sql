-- AlterTable inventory_products
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "has_detraction" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "detraction_code" TEXT;
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "detraction_rate" DECIMAL(5, 2);
ALTER TABLE "inventory_products" ADD COLUMN IF NOT EXISTS "discount_rate" DECIMAL(5, 2) DEFAULT 0.00;
