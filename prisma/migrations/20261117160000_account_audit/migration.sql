-- Auditoria de la inactivacion de cuentas (modulo 1.1)
--
-- Saber quien inactivo una cuenta y cuando es parte de la trazabilidad del
-- plan contable. Es idempotente.

ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "inactive_at" TIMESTAMP(3);
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "inactive_by" TEXT;
