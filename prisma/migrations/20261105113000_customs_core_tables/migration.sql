-- Fase 3.0: Tablas Core del Módulo de Aduanas e Importaciones
-- Migración aditiva: crea las entidades base de importación requeridas por órdenes de importación, inventario y costeo.

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE "ShipmentStatus" AS ENUM ('BORRADOR', 'EN_TRANSITO', 'ARRIBADO', 'EN_DESPACHO', 'CON_LEVANTE', 'COSTEADO', 'CERRADO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CustomsChannel" AS ENUM ('PENDIENTE', 'VERDE', 'NARANJA', 'ROJO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LandedCostStatus" AS ENUM ('BORRADOR', 'EN_REVISION', 'APROBADO', 'A_AJUSTAR', 'PROVISIONAL', 'DEFINITIVO', 'A_RECALCULAR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SettlementType" AS ENUM ('TIPO_0010_DECLARACION', 'TIPO_0026_MAYOR_VALOR', 'TIPO_0027_MULTA', 'RESOLUCION_MULTA_RM65');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SettlementStatus" AS ENUM ('GENERADA', 'PAGADA', 'GARANTIZADA', 'VENCIDA', 'ANULADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SeriesDestinationType" AS ENUM ('MERCADERIA', 'ACTIVO_FIJO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GoodsReceiptStatus" AS ENUM ('CONFORME', 'CON_DISCREPANCIA', 'OBSERVADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Agentes de aduana y proveedores extranjeros
CREATE TABLE IF NOT EXISTS "customs_brokers" (
    "id" TEXT NOT NULL,
    "broker_code" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "mandate_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customs_brokers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "customs_brokers_broker_code_key" ON "customs_brokers"("broker_code");

CREATE TABLE IF NOT EXISTS "foreign_suppliers" (
    "id" TEXT NOT NULL,
    "tax_id" TEXT,
    "business_name" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "default_currency" TEXT NOT NULL DEFAULT 'USD',
    "is_related" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "foreign_suppliers_pkey" PRIMARY KEY ("id")
);

-- 3. Expedientes de importación (Shipments)
CREATE TABLE IF NOT EXISTS "customs_shipments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "shipment_number" TEXT NOT NULL,
    "supplier_id" TEXT,
    "customs_broker_id" TEXT,
    "incoterm" TEXT NOT NULL DEFAULT 'FOB',
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "transport_mode" TEXT NOT NULL DEFAULT 'MARITIMO',
    "origin_country_code" TEXT NOT NULL DEFAULT 'CN',
    "destination_customs" TEXT NOT NULL DEFAULT '118',
    "etd_date" TIMESTAMP(3),
    "eta_date" TIMESTAMP(3),
    "order_reference" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'BORRADOR',
    "is_observed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customs_shipments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "customs_shipments_company_id_shipment_number_key" ON "customs_shipments"("company_id", "shipment_number");

DO $$ BEGIN
    ALTER TABLE "customs_shipments" ADD CONSTRAINT "customs_shipments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "customs_shipments" ADD CONSTRAINT "customs_shipments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "foreign_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "customs_shipments" ADD CONSTRAINT "customs_shipments_customs_broker_id_fkey" FOREIGN KEY ("customs_broker_id") REFERENCES "customs_brokers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Documentos y eventos aduaneros
CREATE TABLE IF NOT EXISTS "customs_documents" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "issuer_name" TEXT,
    "storage_url" TEXT NOT NULL,
    "is_validated" BOOLEAN NOT NULL DEFAULT false,
    "vuce_dr_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customs_documents_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "customs_documents" ADD CONSTRAINT "customs_documents_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "customs_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "customs_events" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "event_value" TEXT,
    "reference_code" TEXT,
    "registered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customs_events_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "customs_events" ADD CONSTRAINT "customs_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "customs_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Liquidaciones aduaneras (Tributos)
CREATE TABLE IF NOT EXISTS "customs_settlements" (
    "id" TEXT NOT NULL,
    "declaration_id" TEXT NOT NULL,
    "settlement_type" "SettlementType" NOT NULL,
    "settlement_number" TEXT NOT NULL,
    "tax_code" TEXT NOT NULL,
    "amount_usd" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "amount_pen" DECIMAL(14,2) NOT NULL,
    "cda_number" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'GENERADA',
    "paid_at" TIMESTAMP(3),
    "bank_code" TEXT,
    "bank_operation_number" TEXT,
    "voucher_storage_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customs_settlements_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "customs_settlements" ADD CONSTRAINT "customs_settlements_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "customs_declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Recepciones físicas de almacén (Goods Receipts)
CREATE TABLE IF NOT EXISTS "goods_receipts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "declaration_id" TEXT NOT NULL,
    "shipment_id" TEXT,
    "warehouse_code" TEXT NOT NULL DEFAULT 'ALM-01',
    "reception_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reception_type" TEXT NOT NULL DEFAULT 'TOTAL',
    "responsible_name" TEXT NOT NULL,
    "responsible_dni" TEXT,
    "container_number" TEXT,
    "seal_number" TEXT,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'CONFORME',
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "goods_receipts_company_id_receipt_number_key" ON "goods_receipts"("company_id", "receipt_number");
CREATE INDEX IF NOT EXISTS "goods_receipts_company_id_declaration_id_idx" ON "goods_receipts"("company_id", "declaration_id");

DO $$ BEGIN
    ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "customs_declarations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "customs_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "goods_receipt_items" (
    "id" TEXT NOT NULL,
    "goods_receipt_id" TEXT NOT NULL,
    "customs_item_id" TEXT,
    "product_code" TEXT NOT NULL,
    "commercial_description" TEXT NOT NULL,
    "declared_quantity" DECIMAL(12,4) NOT NULL,
    "received_quantity" DECIMAL(12,4) NOT NULL,
    "damaged_quantity" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "difference_quantity" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "discrepancy_reason" TEXT,
    "unit_code" TEXT NOT NULL DEFAULT 'NIU',
    "destination_type" "SeriesDestinationType" NOT NULL DEFAULT 'MERCADERIA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "goods_receipt_items_goods_receipt_id_idx" ON "goods_receipt_items"("goods_receipt_id");

DO $$ BEGIN
    ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_customs_item_id_fkey" FOREIGN KEY ("customs_item_id") REFERENCES "customs_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Gastos locales de importación
CREATE TABLE IF NOT EXISTS "local_expense_invoices" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "supplier_ruc" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "expense_concept" TEXT NOT NULL,
    "invoice_serial_number" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "net_amount_pen" DECIMAL(14,2) NOT NULL,
    "igv_amount_pen" DECIMAL(14,2) NOT NULL,
    "total_amount_pen" DECIMAL(14,2) NOT NULL,
    "spot_detraction_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "is_capitalizable" BOOLEAN NOT NULL DEFAULT true,
    "proration_method" TEXT NOT NULL DEFAULT 'VALOR_FOB',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "local_expense_invoices_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "local_expense_invoices" ADD CONSTRAINT "local_expense_invoices_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "customs_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Hojas de liquidación de costos de importación (Landed Cost Sheets)
CREATE TABLE IF NOT EXISTS "landed_cost_sheets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "shipment_id" TEXT NOT NULL,
    "declaration_id" TEXT,
    "calculation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fob_total_usd" DECIMAL(14,2),
    "freight_total_usd" DECIMAL(14,2),
    "insurance_total_usd" DECIMAL(14,2),
    "exchange_rate" DECIMAL(6,4),
    "total_cif_pen" DECIMAL(14,2) NOT NULL,
    "total_duties_pen" DECIMAL(14,2) NOT NULL,
    "total_local_expenses_pen" DECIMAL(14,2) NOT NULL,
    "total_inventory_cost_pen" DECIMAL(14,2) NOT NULL,
    "status" "LandedCostStatus" NOT NULL DEFAULT 'BORRADOR',
    "approved_by_accountant" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "items_proration_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "landed_cost_sheets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "landed_cost_sheets_shipment_id_key" ON "landed_cost_sheets"("shipment_id");

DO $$ BEGIN
    ALTER TABLE "landed_cost_sheets" ADD CONSTRAINT "landed_cost_sheets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "landed_cost_sheets" ADD CONSTRAINT "landed_cost_sheets_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "customs_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "landed_cost_sheets" ADD CONSTRAINT "landed_cost_sheets_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "customs_declarations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "landed_cost_items" (
    "id" TEXT NOT NULL,
    "landed_cost_sheet_id" TEXT NOT NULL,
    "customs_item_id" TEXT,
    "product_code" TEXT NOT NULL,
    "commercial_description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "fob_unit_usd" DECIMAL(14,4) NOT NULL,
    "fob_total_usd" DECIMAL(14,2) NOT NULL,
    "gross_weight_kg" DECIMAL(12,4),
    "allocated_freight_pen" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "allocated_insurance_pen" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "allocated_cif_pen" DECIMAL(14,2) NOT NULL,
    "allocated_duties_pen" DECIMAL(14,2) NOT NULL,
    "allocated_local_expenses_pen" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "total_landed_cost_pen" DECIMAL(14,2) NOT NULL,
    "unit_landed_cost_pen" DECIMAL(14,4) NOT NULL,
    "destination_type" "SeriesDestinationType" NOT NULL DEFAULT 'MERCADERIA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "landed_cost_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "landed_cost_items_landed_cost_sheet_id_idx" ON "landed_cost_items"("landed_cost_sheet_id");

DO $$ BEGIN
    ALTER TABLE "landed_cost_items" ADD CONSTRAINT "landed_cost_items_landed_cost_sheet_id_fkey" FOREIGN KEY ("landed_cost_sheet_id") REFERENCES "landed_cost_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "landed_cost_items" ADD CONSTRAINT "landed_cost_items_customs_item_id_fkey" FOREIGN KEY ("customs_item_id") REFERENCES "customs_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
