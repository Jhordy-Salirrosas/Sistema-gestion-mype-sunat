-- Contabilidad: distribución de gastos y cobros entre varias cuentas.

CREATE TABLE IF NOT EXISTS "expense_distributions" (
  "id" TEXT NOT NULL,
  "expense_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
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

-- Idempotente: si la tabla ya existe, la migración no falla al recrear la clave.
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
  "collection_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
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
