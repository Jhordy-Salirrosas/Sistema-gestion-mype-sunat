-- ============================================================================
-- Contabilidad: migraciones pendientes en producción
--
-- Aplica las tres migraciones del PR de contabilidad de una sola vez y de forma
-- idempotente (se puede ejecutar varias veces sin error).
--
--   Supabase → SQL Editor → pegar todo → Run
--
-- Después de ejecutarlo, registra las migraciones como aplicadas para que
-- `prisma migrate deploy` no intente correrlas de nuevo:
--
--   npx prisma migrate resolve --applied 20261114130000_accounting_treasury_accounts
--   npx prisma migrate resolve --applied 20261114140000_accounting_distributions
--   npx prisma migrate resolve --applied 20261115100000_accounting_source_reference_indexes
--
-- (Si prefieres el camino normal, con DATABASE_URL/DIRECT_URL configuradas basta
--  `npx prisma migrate deploy`, que hace lo mismo y registra solo.)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. company_treasury_accounts: cuentas de caja/banco por empresa
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "company_treasury_accounts" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'BANCO',
  "currency" TEXT NOT NULL DEFAULT 'PEN',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_treasury_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_treasury_accounts_company_id_code_key"
  ON "company_treasury_accounts"("company_id","code");
CREATE INDEX IF NOT EXISTS "company_treasury_accounts_company_id_is_active_idx"
  ON "company_treasury_accounts"("company_id","is_active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_treasury_accounts_company_id_fkey'
  ) THEN
    ALTER TABLE "company_treasury_accounts"
      ADD CONSTRAINT "company_treasury_accounts_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Subcuentas de caja que el catálogo base no traía.
INSERT INTO "accounting_accounts" ("id","code","name","element","nature","parent_code","level","is_active")
VALUES
  (gen_random_uuid()::text, '1011', 'Caja principal',     'Activo', 'Deudora', '101', 4, true),
  (gen_random_uuid()::text, '1012', 'Caja chica',         'Activo', 'Deudora', '101', 4, true),
  (gen_random_uuid()::text, '1013', 'Caja secundaria',    'Activo', 'Deudora', '101', 4, true),
  (gen_random_uuid()::text, '1043', 'Cuenta corriente 3', 'Activo', 'Deudora', '104', 4, true)
ON CONFLICT ("code") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Distribución de gastos y cobros
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "expense_distributions" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "expense_id" TEXT NOT NULL,
  "account_code" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "percentage" DECIMAL(5,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_distributions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "expense_distributions_expense_id_account_code_key"
  ON "expense_distributions"("expense_id","account_code");
CREATE INDEX IF NOT EXISTS "expense_distributions_company_id_account_code_idx"
  ON "expense_distributions"("company_id","account_code");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expense_distributions_expense_id_fkey') THEN
    ALTER TABLE "expense_distributions"
      ADD CONSTRAINT "expense_distributions_expense_id_fkey"
      FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "collection_distributions" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "collection_id" TEXT NOT NULL,
  "account_code" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "percentage" DECIMAL(5,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collection_distributions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "collection_distributions_collection_id_account_code_key"
  ON "collection_distributions"("collection_id","account_code");
CREATE INDEX IF NOT EXISTS "collection_distributions_company_id_account_code_idx"
  ON "collection_distributions"("company_id","account_code");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collection_distributions_collection_id_fkey') THEN
    ALTER TABLE "collection_distributions"
      ADD CONSTRAINT "collection_distributions_collection_id_fkey"
      FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Índices de consulta por documento de origen
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "accounting_entries_company_id_source_module_source_reference_id_idx"
  ON "accounting_entries"("company_id","source_module","source_reference_id");
CREATE INDEX IF NOT EXISTS "collections_company_id_invoice_id_idx"
  ON "collections"("company_id","invoice_id");

COMMIT;

-- ---------------------------------------------------------------------------
-- 4. Configuración de la empresa (arregla la auditoría y el PLE)
-- ---------------------------------------------------------------------------
-- Estas dos sentencias repuntan reglas que quedaron en cuentas de mayor. Sin
-- ellas la auditoría sigue marcando "la cuenta PCGE 611 es de mayor y tiene
-- subcuentas" y el asiento automático no cuadra con el PCGE.
UPDATE "accounting_rules"
   SET "account_code" = '6111'
 WHERE "account_code" = '611' AND "is_active" = true;

UPDATE "accounting_rules"
   SET "account_code" = '7599'
 WHERE "account_code" = '759' AND "is_active" = true;

-- RUC de la empresa de demostración: 20601234567 no supera el módulo 11, así que
-- el PLE rechaza cualquier exportación. Descomenta y ajusta si esa empresa es
-- solo de pruebas. Si es una empresa real, corrige su RUC real.
-- UPDATE "companies" SET "ruc" = '20000000001' WHERE "ruc" = '20601234567';

-- Verificación: deben aparecer las tres tablas y los dos índices.
SELECT 'company_treasury_accounts' AS objeto, to_regclass('public.company_treasury_accounts') IS NOT NULL AS existe
UNION ALL SELECT 'expense_distributions', to_regclass('public.expense_distributions') IS NOT NULL
UNION ALL SELECT 'collection_distributions', to_regclass('public.collection_distributions') IS NOT NULL
UNION ALL SELECT 'idx accounting_entries por origen', to_regclass('public.accounting_entries_company_id_source_module_source_reference_id_idx') IS NOT NULL
UNION ALL SELECT 'idx collections por factura', to_regclass('public.collections_company_id_invoice_id_idx') IS NOT NULL;
