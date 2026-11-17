-- Auditoria del cierre y la reapertura de periodos (modulo 4.2)
--
-- El cierre de un mes es un acto contable: hay que poder responder quien lo
-- cerro, quien lo reabrio y por que. Es idempotente.

ALTER TABLE "accounting_periods" ADD COLUMN IF NOT EXISTS "closed_by" TEXT;
ALTER TABLE "accounting_periods" ADD COLUMN IF NOT EXISTS "reopened_at" TIMESTAMP(3);
ALTER TABLE "accounting_periods" ADD COLUMN IF NOT EXISTS "reopened_by" TEXT;
ALTER TABLE "accounting_periods" ADD COLUMN IF NOT EXISTS "reopen_reason" TEXT;
