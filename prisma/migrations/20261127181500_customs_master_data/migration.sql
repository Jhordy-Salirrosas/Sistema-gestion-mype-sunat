-- Migracion pendiente: tablas del esquema que nunca tuvieron migracion.
-- Generado a partir del estado real de Supabase el 2026-11-27.
--
-- Estas tablas YA EXISTEN en la base y tienen datos. Por eso la migracion
-- NO debe ejecutarse sobre esta base: se marca como aplicada con
--   npx prisma migrate resolve --applied <nombre-de-la-carpeta>
-- y sirve para que una base nueva (o CI) se pueda crear desde cero.

-- customs_offices  (17 filas en Supabase)
CREATE TABLE "customs_offices" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN DEFAULT true NOT NULL,
    "created_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "customs_offices_pkey" PRIMARY KEY (code)
);

-- authorized_banks  (5 filas en Supabase)
CREATE TABLE "authorized_banks" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN DEFAULT true NOT NULL,
    "created_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "authorized_banks_pkey" PRIMARY KEY (code)
);

-- vuce_entities  (7 filas en Supabase)
CREATE TABLE "vuce_entities" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "is_active" BOOLEAN DEFAULT true NOT NULL,
    "created_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "vuce_entities_pkey" PRIMARY KEY (code)
);

-- import_quotations  (1 filas en Supabase)
CREATE TABLE "import_quotations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "quotation_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target_incoterm" TEXT DEFAULT 'FOB'::text,
    "target_currency" TEXT DEFAULT 'USD'::text,
    "status" TEXT DEFAULT 'EN_NEGOCIACION'::text NOT NULL,
    "awarded_proforma_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "items" JSONB DEFAULT '[]'::jsonb,
    CONSTRAINT "import_quotations_pkey" PRIMARY KEY (id)
);

-- import_proformas  (3 filas en Supabase)
CREATE TABLE "import_proformas" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "supplier_name" TEXT NOT NULL,
    "supplier_country" TEXT DEFAULT 'CN'::text NOT NULL,
    "proforma_number" TEXT NOT NULL,
    "incoterm" TEXT DEFAULT 'FOB'::text NOT NULL,
    "origin_port" TEXT,
    "currency_code" TEXT DEFAULT 'USD'::text NOT NULL,
    "total_fob" NUMERIC(14,2) NOT NULL,
    "estimated_freight" NUMERIC(14,2) DEFAULT 0.00,
    "estimated_insurance" NUMERIC(14,2) DEFAULT 0.00,
    "total_cif" NUMERIC(14,2) DEFAULT 0.00,
    "lead_time_days" INTEGER DEFAULT 30,
    "payment_terms" TEXT,
    "validity_date" TIMESTAMP(3) WITHOUT TIME ZONE,
    "status" TEXT DEFAULT 'EN_EVALUACION'::text NOT NULL,
    "rejection_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "import_proformas_pkey" PRIMARY KEY (id)
);

-- import_proforma_items  (3 filas en Supabase)
CREATE TABLE "import_proforma_items" (
    "id" TEXT NOT NULL,
    "proforma_id" TEXT NOT NULL,
    "product_id" TEXT,
    "sku" TEXT,
    "description" TEXT NOT NULL,
    "quantity" NUMERIC(14,4) NOT NULL,
    "unit_price" NUMERIC(14,4) NOT NULL,
    "total_fob" NUMERIC(14,2) NOT NULL,
    "unit_code" TEXT DEFAULT 'NIU'::text NOT NULL,
    "hs_code" TEXT,
    "created_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "import_proforma_items_pkey" PRIMARY KEY (id)
);
ALTER TABLE "import_quotations" ADD CONSTRAINT "import_quotations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE "import_proformas" ADD CONSTRAINT "import_proformas_quotation_id_fkey" FOREIGN KEY (quotation_id) REFERENCES import_quotations(id) ON DELETE CASCADE;
ALTER TABLE "import_proformas" ADD CONSTRAINT "import_proformas_supplier_id_fkey" FOREIGN KEY (supplier_id) REFERENCES foreign_suppliers(id) ON DELETE SET NULL;
ALTER TABLE "import_proforma_items" ADD CONSTRAINT "import_proforma_items_proforma_id_fkey" FOREIGN KEY (proforma_id) REFERENCES import_proformas(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX import_quotations_company_id_quotation_number_key ON public.import_quotations USING btree (company_id, quotation_number);
CREATE INDEX import_proformas_quotation_id_idx ON public.import_proformas USING btree (quotation_id);
CREATE INDEX import_proforma_items_proforma_id_idx ON public.import_proforma_items USING btree (proforma_id);
