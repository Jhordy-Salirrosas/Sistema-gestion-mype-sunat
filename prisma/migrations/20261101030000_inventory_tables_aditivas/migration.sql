-- Reconstruida desde el esquema Prisma para reconciliar el historial.
-- En la base compartida ya estaba aplicada; en una base nueva crea las tablas.

DO $$ BEGIN
  CREATE TYPE "InventoryMovementDirection" AS ENUM ('ENTRADA', 'SALIDA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryObligationStatus" AS ENUM ('OBLIGATORIO', 'EXCEPTUADO', 'VOLUNTARIO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "inventory_warehouses" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "warehouse_code" TEXT NOT NULL,
    "sunat_establishment_code" TEXT NOT NULL DEFAULT '0000',
    "description" TEXT NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_products" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sunat_type_code" TEXT NOT NULL DEFAULT '01',
    "sunat_unit_code" TEXT NOT NULL DEFAULT 'NIU',
    "min_stock_alert" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_balances" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "current_stock" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "average_unit_cost" DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
    "total_inventory_value" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "last_movement_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "movement_number" TEXT NOT NULL,
    "movement_date" TIMESTAMP(3) NOT NULL,
    "accounting_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operation_type_code" TEXT NOT NULL,
    "document_type_code" TEXT,
    "document_serial" TEXT,
    "document_number" TEXT,
    "direction" "InventoryMovementDirection" NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_cost" DECIMAL(14,4) NOT NULL,
    "total_cost" DECIMAL(14,2) NOT NULL,
    "previous_stock" DECIMAL(12,4) NOT NULL,
    "previous_unit_cost" DECIMAL(14,4) NOT NULL,
    "previous_total_value" DECIMAL(14,2) NOT NULL,
    "resulting_stock" DECIMAL(12,4) NOT NULL,
    "resulting_unit_cost" DECIMAL(14,4) NOT NULL,
    "resulting_total_value" DECIMAL(14,2) NOT NULL,
    "source_reference_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory_obligation_decisions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "annual_revenue_uit" DECIMAL(10,2) NOT NULL,
    "tax_regime" TEXT NOT NULL,
    "ple_12_1_status" "InventoryObligationStatus" NOT NULL,
    "ple_13_1_status" "InventoryObligationStatus" NOT NULL,
    "legal_basis_notes" TEXT,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_obligation_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_warehouses_company_id_idx" ON "inventory_warehouses"("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_warehouses_company_id_warehouse_code_key" ON "inventory_warehouses"("company_id", "warehouse_code");
CREATE INDEX IF NOT EXISTS "inventory_products_company_id_idx" ON "inventory_products"("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_products_company_id_sku_key" ON "inventory_products"("company_id", "sku");
CREATE INDEX IF NOT EXISTS "inventory_balances_company_id_warehouse_id_idx" ON "inventory_balances"("company_id", "warehouse_id");
CREATE INDEX IF NOT EXISTS "inventory_balances_company_id_product_id_idx" ON "inventory_balances"("company_id", "product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_balances_company_id_warehouse_id_product_id_key" ON "inventory_balances"("company_id", "warehouse_id", "product_id");
CREATE INDEX IF NOT EXISTS "inventory_movements_company_id_warehouse_id_movement_date_idx" ON "inventory_movements"("company_id", "warehouse_id", "movement_date");
CREATE INDEX IF NOT EXISTS "inventory_movements_company_id_product_id_movement_date_idx" ON "inventory_movements"("company_id", "product_id", "movement_date");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_movements_company_id_source_reference_id_operatio_key" ON "inventory_movements"("company_id", "source_reference_id", "operation_type_code", "product_id");
CREATE INDEX IF NOT EXISTS "inventory_obligation_decisions_company_id_idx" ON "inventory_obligation_decisions"("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_obligation_decisions_company_id_fiscal_year_key" ON "inventory_obligation_decisions"("company_id", "fiscal_year");

ALTER TABLE "inventory_warehouses" ADD CONSTRAINT "inventory_warehouses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_obligation_decisions" ADD CONSTRAINT "inventory_obligation_decisions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
