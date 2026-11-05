-- Fase 2: transferencias y ajustes de inventario.
-- Migración aditiva.

DO $$ BEGIN
  CREATE TYPE "InventoryTransferStatus" AS ENUM ('BORRADOR', 'CONFIRMADA', 'ANULADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryAdjustmentType" AS ENUM ('ENTRADA', 'SALIDA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryAdjustmentStatus" AS ENUM ('BORRADOR', 'APLICADO', 'ANULADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "inventory_transfers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "transfer_number" TEXT NOT NULL,
    "transfer_date" TIMESTAMP(3) NOT NULL,
    "from_warehouse_code" TEXT NOT NULL,
    "to_warehouse_code" TEXT NOT NULL,
    "status" "InventoryTransferStatus" NOT NULL DEFAULT 'BORRADOR',
    "responsible" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_transfers_company_id_transfer_number_key"
    ON "inventory_transfers"("company_id", "transfer_number");
CREATE INDEX IF NOT EXISTS "inventory_transfers_company_id_transfer_date_idx"
    ON "inventory_transfers"("company_id", "transfer_date");

DO $$ BEGIN
    ALTER TABLE "inventory_transfers"
        ADD CONSTRAINT "inventory_transfers_company_id_fkey"
        FOREIGN KEY ("company_id") REFERENCES "companies"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "inventory_transfer_items" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_cost" DECIMAL(14,4) NOT NULL,
    "total_cost" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_transfer_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_transfer_items_transfer_id_idx"
    ON "inventory_transfer_items"("transfer_id");

DO $$ BEGIN
    ALTER TABLE "inventory_transfer_items"
        ADD CONSTRAINT "inventory_transfer_items_transfer_id_fkey"
        FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "inventory_transfer_items"
        ADD CONSTRAINT "inventory_transfer_items_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "inventory_adjustments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "adjustment_number" TEXT NOT NULL,
    "adjustment_date" TIMESTAMP(3) NOT NULL,
    "warehouse_code" TEXT NOT NULL,
    "type" "InventoryAdjustmentType" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "InventoryAdjustmentStatus" NOT NULL DEFAULT 'BORRADOR',
    "responsible" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_adjustments_company_id_adjustment_number_key"
    ON "inventory_adjustments"("company_id", "adjustment_number");
CREATE INDEX IF NOT EXISTS "inventory_adjustments_company_id_adjustment_date_idx"
    ON "inventory_adjustments"("company_id", "adjustment_date");

DO $$ BEGIN
    ALTER TABLE "inventory_adjustments"
        ADD CONSTRAINT "inventory_adjustments_company_id_fkey"
        FOREIGN KEY ("company_id") REFERENCES "companies"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "inventory_adjustment_items" (
    "id" TEXT NOT NULL,
    "adjustment_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "system_quantity" DECIMAL(12,4) NOT NULL,
    "counted_quantity" DECIMAL(12,4) NOT NULL,
    "difference_quantity" DECIMAL(12,4) NOT NULL,
    "unit_cost" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_adjustment_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_adjustment_items_adjustment_id_idx"
    ON "inventory_adjustment_items"("adjustment_id");

DO $$ BEGIN
    ALTER TABLE "inventory_adjustment_items"
        ADD CONSTRAINT "inventory_adjustment_items_adjustment_id_fkey"
        FOREIGN KEY ("adjustment_id") REFERENCES "inventory_adjustments"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "inventory_adjustment_items"
        ADD CONSTRAINT "inventory_adjustment_items_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
