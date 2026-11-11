ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "detraccion_deposited_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "detraccion_deposited_amount" DECIMAL(14,2);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "detraccion_constancia" TEXT;
