-- Contabilidad: cuentas de tesorería de la empresa y subcuentas de caja/banco.
--
-- Hasta ahora los asientos de cobro/pago usaban la cuenta hardcodeada '101'
-- (caja) o '1041' (banco) según el medio de pago, sin que la empresa pudiera
-- elegir. La tabla nueva permite alias operativos sobre subcuentas del PCGE.

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

ALTER TABLE "company_treasury_accounts"
  ADD CONSTRAINT "company_treasury_accounts_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Subcuentas que el catálogo base no traía y que el módulo necesita para que
-- tesorería pueda elegir caja o banco. El PCGE 2019 deja la apertura de
-- divisionarias a criterio de la empresa; aquí se declaran para que la
-- validación de cuentas (que exige cuenta existente y hoja) las acepte.
INSERT INTO "accounting_accounts" ("id","code","name","element","nature","parent_code","level","is_active")
VALUES
  (gen_random_uuid()::text, '1011', 'Caja principal',   'Activo', 'Deudora', '101', 4, true),
  (gen_random_uuid()::text, '1012', 'Caja chica',       'Activo', 'Deudora', '101', 4, true),
  (gen_random_uuid()::text, '1013', 'Caja secundaria',  'Activo', 'Deudora', '101', 4, true),
  (gen_random_uuid()::text, '1043', 'Cuenta corriente 3', 'Activo', 'Deudora', '104', 4, true)
ON CONFLICT ("code") DO NOTHING;

-- Nota: 1041 y 1042 ya existen en el catálogo con su nombre oficial del PCGE
-- ("Cuentas corrientes operativas" y "Cuentas corrientes para fines
-- específicos"). El nombre del banco concreto se configura en
-- `company_treasury_accounts.name`, no se renombra la cuenta del PCGE.
