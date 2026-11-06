-- Fase 1: maestros compartidos y campos de inventario.
-- Migración aditiva: no elimina tablas ni columnas existentes.

-- 1. Monedas
CREATE TABLE IF NOT EXISTS "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- 2. Tipos de cambio
CREATE TABLE IF NOT EXISTS "exchange_rates" (
    "id" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL,
    "quote_currency" TEXT NOT NULL,
    "rate" DECIMAL(14,6) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_rates_base_currency_quote_currency_date_key"
    ON "exchange_rates"("base_currency", "quote_currency", "date");
CREATE INDEX IF NOT EXISTS "exchange_rates_date_idx" ON "exchange_rates"("date");

-- 3. Incoterms
CREATE TABLE IF NOT EXISTS "incoterms" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '2020',
    "named_place_required" BOOLEAN NOT NULL DEFAULT true,
    "cost_rules_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incoterms_pkey" PRIMARY KEY ("code")
);

-- 4. Terceros (clientes / proveedores / importadores)
CREATE TABLE IF NOT EXISTS "business_partners" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "doc_number" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'PE',
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "payment_terms" TEXT,
    "credit_limit" DECIMAL(14,2),
    "currency_code" TEXT DEFAULT 'PEN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "business_partners_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "business_partners_company_id_doc_type_doc_number_key"
    ON "business_partners"("company_id", "doc_type", "doc_number");
CREATE INDEX IF NOT EXISTS "business_partners_company_id_legal_name_idx"
    ON "business_partners"("company_id", "legal_name");
CREATE INDEX IF NOT EXISTS "business_partners_company_id_is_active_idx"
    ON "business_partners"("company_id", "is_active");

DO $$ BEGIN
    ALTER TABLE "business_partners"
        ADD CONSTRAINT "business_partners_company_id_fkey"
        FOREIGN KEY ("company_id") REFERENCES "companies"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Direcciones
CREATE TABLE IF NOT EXISTS "partner_addresses" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'PRINCIPAL',
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'PE',
    "postal_code" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_addresses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "partner_addresses_partner_id_idx" ON "partner_addresses"("partner_id");
DO $$ BEGIN
    ALTER TABLE "partner_addresses"
        ADD CONSTRAINT "partner_addresses_partner_id_fkey"
        FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Contactos
CREATE TABLE IF NOT EXISTS "partner_contacts" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_contacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "partner_contacts_partner_id_idx" ON "partner_contacts"("partner_id");
DO $$ BEGIN
    ALTER TABLE "partner_contacts"
        ADD CONSTRAINT "partner_contacts_partner_id_fkey"
        FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Cuentas bancarias del tercero
CREATE TABLE IF NOT EXISTS "partner_bank_accounts" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "bank_country" TEXT NOT NULL DEFAULT 'PE',
    "account_number" TEXT NOT NULL,
    "cci" TEXT,
    "swift" TEXT,
    "iban" TEXT,
    "beneficiary" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'PEN',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_bank_accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "partner_bank_accounts_partner_id_idx"
    ON "partner_bank_accounts"("partner_id");
DO $$ BEGIN
    ALTER TABLE "partner_bank_accounts"
        ADD CONSTRAINT "partner_bank_accounts_partner_id_fkey"
        FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Tipos de documento de importación
CREATE TABLE IF NOT EXISTS "document_types" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'GENERAL',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "allowed_formats" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_types_pkey" PRIMARY KEY ("code")
);

-- 9. Mapeo contable
CREATE TABLE IF NOT EXISTS "accounting_mappings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "process_code" TEXT NOT NULL,
    "role_code" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounting_mappings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_mappings_company_id_process_code_role_code_key"
    ON "accounting_mappings"("company_id", "process_code", "role_code");
CREATE INDEX IF NOT EXISTS "accounting_mappings_company_id_process_code_idx"
    ON "accounting_mappings"("company_id", "process_code");
DO $$ BEGIN
    ALTER TABLE "accounting_mappings"
        ADD CONSTRAINT "accounting_mappings_company_id_fkey"
        FOREIGN KEY ("company_id") REFERENCES "companies"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 10. Campos nuevos de inventario
ALTER TABLE "inventory_products"
    ADD COLUMN IF NOT EXISTS "is_inventory" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "hs_code" TEXT,
    ADD COLUMN IF NOT EXISTS "category" TEXT,
    ADD COLUMN IF NOT EXISTS "brand" TEXT,
    ADD COLUMN IF NOT EXISTS "model" TEXT,
    ADD COLUMN IF NOT EXISTS "barcode" TEXT,
    ADD COLUMN IF NOT EXISTS "tax_affectation" TEXT,
    ADD COLUMN IF NOT EXISTS "weight_kg" DECIMAL(12,4),
    ADD COLUMN IF NOT EXISTS "volume_m3" DECIMAL(12,4),
    ADD COLUMN IF NOT EXISTS "default_supplier_id" TEXT;

CREATE INDEX IF NOT EXISTS "inventory_products_company_id_is_inventory_idx"
    ON "inventory_products"("company_id", "is_inventory");
CREATE INDEX IF NOT EXISTS "inventory_products_default_supplier_id_idx"
    ON "inventory_products"("default_supplier_id");

DO $$ BEGIN
    ALTER TABLE "inventory_products"
        ADD CONSTRAINT "inventory_products_default_supplier_id_fkey"
        FOREIGN KEY ("default_supplier_id") REFERENCES "business_partners"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "inventory_movements"
    ADD COLUMN IF NOT EXISTS "source_module" TEXT,
    ADD COLUMN IF NOT EXISTS "created_by" TEXT,
    ADD COLUMN IF NOT EXISTS "is_test" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "inventory_movements_company_id_source_module_source_reference_id_idx"
    ON "inventory_movements"("company_id", "source_module", "source_reference_id");
CREATE INDEX IF NOT EXISTS "inventory_movements_company_id_is_test_idx"
    ON "inventory_movements"("company_id", "is_test");
