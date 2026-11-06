-- Fase 3.1: Órdenes de Importación y Etapas del Flujo Aduanero
-- Migración aditiva.

DO $$ BEGIN
  CREATE TYPE "ImportOrderStatus" AS ENUM (
    'BORRADOR', 'APROBADA', 'EN_TRANSITO', 'ARRIBADA', 'EN_DESPACHO',
    'CON_LEVANTE', 'RECEPCIONADA', 'COSTEADA', 'CERRADA', 'CANCELADA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "import_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "supplier_country" TEXT NOT NULL DEFAULT 'CN',
    "supplier_id" TEXT,
    "incoterm" TEXT NOT NULL DEFAULT 'FOB',
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(14,6),
    "issue_date" TIMESTAMP(3) NOT NULL,
    "expected_arrival_date" TIMESTAMP(3),
    "port_of_origin" TEXT,
    "port_of_destination" TEXT DEFAULT 'CALLAO',
    "transport_mode" TEXT NOT NULL DEFAULT 'MARITIMO',
    "total_fob" DECIMAL(14,2) NOT NULL,
    "estimated_freight" DECIMAL(14,2) DEFAULT 0.00,
    "estimated_insurance" DECIMAL(14,2) DEFAULT 0.00,
    "total_cif" DECIMAL(14,2) DEFAULT 0.00,
    "current_stage" TEXT NOT NULL DEFAULT 'APROBACION_OC',
    "current_stage_index" INTEGER NOT NULL DEFAULT 1,
    "status" "ImportOrderStatus" NOT NULL DEFAULT 'APROBADA',
    "proforma_number" TEXT,
    "notes" TEXT,
    "responsible" TEXT,
    "shipment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "import_orders_company_id_order_number_key"
    ON "import_orders"("company_id", "order_number");
CREATE INDEX IF NOT EXISTS "import_orders_company_id_issue_date_idx"
    ON "import_orders"("company_id", "issue_date");

DO $$ BEGIN
    ALTER TABLE "import_orders"
        ADD CONSTRAINT "import_orders_company_id_fkey"
        FOREIGN KEY ("company_id") REFERENCES "companies"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "import_orders"
        ADD CONSTRAINT "import_orders_supplier_id_fkey"
        FOREIGN KEY ("supplier_id") REFERENCES "foreign_suppliers"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "import_orders"
        ADD CONSTRAINT "import_orders_shipment_id_fkey"
        FOREIGN KEY ("shipment_id") REFERENCES "customs_shipments"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "import_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_code" TEXT,
    "description" TEXT NOT NULL,
    "hs_code" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_price_fob" DECIMAL(14,4) NOT NULL,
    "total_fob" DECIMAL(14,2) NOT NULL,
    "unit_code" TEXT NOT NULL DEFAULT 'NIU',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "import_order_items_order_id_idx"
    ON "import_order_items"("order_id");

DO $$ BEGIN
    ALTER TABLE "import_order_items"
        ADD CONSTRAINT "import_order_items_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "import_orders"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "import_order_stage_histories" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "stage_index" INTEGER NOT NULL,
    "stage_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETADO',
    "transition_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_name" TEXT NOT NULL,
    "evidence_notes" TEXT,
    "document_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_order_stage_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "import_order_stage_histories_order_id_stage_index_idx"
    ON "import_order_stage_histories"("order_id", "stage_index");

DO $$ BEGIN
    ALTER TABLE "import_order_stage_histories"
        ADD CONSTRAINT "import_order_stage_histories_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "import_orders"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

