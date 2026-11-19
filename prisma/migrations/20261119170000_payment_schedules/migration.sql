ALTER TABLE "national_purchases" ADD COLUMN "due_date" TIMESTAMP(3);
CREATE TYPE "PurchasePaymentScheduleStatus" AS ENUM ('PROGRAMADO', 'PAGADO', 'ANULADO');
CREATE TABLE "purchase_payment_schedules" (
  "id" TEXT NOT NULL, "company_id" TEXT NOT NULL, "purchase_id" TEXT NOT NULL,
  "scheduled_date" TIMESTAMP(3) NOT NULL, "amount" DECIMAL(14,2) NOT NULL,
  "status" "PurchasePaymentScheduleStatus" NOT NULL DEFAULT 'PROGRAMADO',
  "notes" TEXT, "created_by" TEXT, "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_payment_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "purchase_payment_schedules_company_id_scheduled_date_idx" ON "purchase_payment_schedules"("company_id","scheduled_date");
CREATE INDEX "purchase_payment_schedules_purchase_id_idx" ON "purchase_payment_schedules"("purchase_id");
ALTER TABLE "purchase_payment_schedules" ADD CONSTRAINT "purchase_payment_schedules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_payment_schedules" ADD CONSTRAINT "purchase_payment_schedules_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "national_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
