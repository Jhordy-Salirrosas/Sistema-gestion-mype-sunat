-- Migración ADITIVA de las tablas de inventario (M1, decisión Opción B del 31-10).
--
-- POR QUÉ ESTA MIGRACIÓN EXISTE
--
-- El schema de Prisma declaraba `inventory_warehouses`, `inventory_products`,
-- `inventory_balances` e `inventory_movements`, pero NINGUNA migración las
-- creaba. Se comprobó contra la base real: esas cuatro tablas no existían.
--
-- Consecuencia: la conexión factura -> Kardex que pidió el docente no podía
-- funcionar (la tabla destino no existía), el buscador de productos de la
-- pantalla de emisión fallaba, y `StockValidationService` lanzaba
-- "The table public.inventory_balances does not exist".
--
-- ALCANCE DELIBERADAMENTE LIMITADO
--
-- Esta migración crea SOLO las cuatro tablas de inventario y sus enums. NO
-- toca nada de aduanas ni de SIRE, y sobre todo NO ejecuta el
-- `DROP TABLE kardex_movements` que el diff completo del schema proponía: esa
-- tabla tiene datos del esquema anterior y su eliminación debe decidirla quien
-- administra el esquema, no una migración del módulo de facturación.
--
-- Lo que sigue pendiente y queda documentado como deuda:
--   - goods_receipts / goods_receipt_items / landed_cost_items
--   - columnas nuevas en landed_cost_sheets y customs_items
--   - aplica pendiente 20261030130000_sire_report_uploads
--   - el DROP TABLE kardex_movements del esquema anterior
--
-- Se escribe a mano (no con `prisma migrate dev`) precisamente para poder
-- excluir esas partes: `migrate dev` aplicaría el diff completo y borraría
-- kardex_movements.

-- CreateEnum
CREATE TYPE "InventoryMovementDirection" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "InventoryObligationStatus" AS ENUM ('OBLIGATORIO', 'EXCEPTUADO', 'VOLUNTARIO');

-- CreateTable
CREATE TABLE "inventory_warehouses" (
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

-- CreateTable
CREATE TABLE "inventory_products" (
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

-- CreateTable
CREATE TABLE "inventory_balances" (
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

-- CreateTable
CREATE TABLE "inventory_movements" (
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

-- CreateTable
CREATE TABLE "inventory_obligation_decisions" (
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

-- CreateIndex
CREATE UNIQUE INDEX "inventory_warehouses_company_id_warehouse_code_key" ON "inventory_warehouses"("company_id", "warehouse_code");

-- CreateIndex
CREATE INDEX "inventory_warehouses_company_id_idx" ON "inventory_warehouses"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_products_company_id_sku_key" ON "inventory_products"("company_id", "sku");

-- CreateIndex
CREATE INDEX "inventory_products_company_id_idx" ON "inventory_products"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_company_id_warehouse_id_product_id_key" ON "inventory_balances"("company_id", "warehouse_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_balances_company_id_warehouse_id_idx" ON "inventory_balances"("company_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_balances_company_id_product_id_idx" ON "inventory_balances"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_movements_company_id_warehouse_id_movement_date_idx" ON "inventory_movements"("company_id", "warehouse_id", "movement_date");

-- CreateIndex
CREATE INDEX "inventory_movements_company_id_product_id_movement_date_idx" ON "inventory_movements"("company_id", "product_id", "movement_date");

-- CreateIndex
-- Esta es la llave de idempotencia del Kardex: impide que reprocesar una
-- factura duplique el movimiento de salida.
CREATE UNIQUE INDEX "inventory_movements_company_id_source_reference_id_operatio_key" ON "inventory_movements"("company_id", "source_reference_id", "operation_type_code", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_obligation_decisions_company_id_fiscal_year_key" ON "inventory_obligation_decisions"("company_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "inventory_obligation_decisions_company_id_idx" ON "inventory_obligation_decisions"("company_id");

-- AddForeignKey
ALTER TABLE "inventory_warehouses" ADD CONSTRAINT "inventory_warehouses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_obligation_decisions" ADD CONSTRAINT "inventory_obligation_decisions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
