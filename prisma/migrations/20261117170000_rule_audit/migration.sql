-- Auditoría de las reglas de contabilización (fase D.5)
--
-- Permite responder quién cambió una regla y cuándo, igual que ya se hace con
-- la inactivación de cuentas y la reapertura de períodos. Es idempotente.

ALTER TABLE "accounting_rules" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);
ALTER TABLE "accounting_rules" ADD COLUMN IF NOT EXISTS "updated_by" TEXT;
