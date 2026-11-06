-- Fase 3.2: Documentos, Checklist y Enlace con Despacho y Recepción
-- Migración aditiva.

CREATE TABLE IF NOT EXISTS "import_order_documents" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "stage_index" INTEGER NOT NULL,
    "stage_name" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "file_hash" TEXT,
    "file_size_bytes" INTEGER,
    "mime_type" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_order_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "import_order_documents_order_id_stage_index_idx"
    ON "import_order_documents"("order_id", "stage_index");

DO $$ BEGIN
    ALTER TABLE "import_order_documents"
        ADD CONSTRAINT "import_order_documents_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "import_orders"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enlace aditivo de Declaración Aduanera (DAM) con la Orden de Importación
DO $$ BEGIN
    ALTER TABLE "customs_declarations" ADD COLUMN "order_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "customs_declarations"
        ADD CONSTRAINT "customs_declarations_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "import_orders"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enlace aditivo de Recepción Física (GoodsReceipt) con la Orden de Importación
DO $$ BEGIN
    ALTER TABLE "goods_receipts" ADD COLUMN "order_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "goods_receipts"
        ADD CONSTRAINT "goods_receipts_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "import_orders"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

