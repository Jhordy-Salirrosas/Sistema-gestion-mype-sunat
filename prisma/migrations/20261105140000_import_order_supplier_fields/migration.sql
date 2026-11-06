-- Fase 3: Ampliación de campos de Proveedor Extranjero (SUNAT Formato B / OMC)
-- Migración aditiva.

DO $$ BEGIN
    ALTER TABLE "import_orders" ADD COLUMN "supplier_tax_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "import_orders" ADD COLUMN "supplier_address" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "import_orders" ADD COLUMN "supplier_condition" TEXT DEFAULT 'FABRICANTE';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "import_orders" ADD COLUMN "is_related" BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "import_orders" ADD COLUMN "supplier_email" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "import_orders" ADD COLUMN "supplier_phone" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

