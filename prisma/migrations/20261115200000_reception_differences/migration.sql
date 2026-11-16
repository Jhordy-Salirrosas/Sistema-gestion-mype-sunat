ALTER TABLE "national_purchases" ADD COLUMN "has_differences" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "purchase_reception_differences" (
  "id" TEXT NOT NULL, "purchase_id" TEXT NOT NULL, "item_id" TEXT NOT NULL, "sku" TEXT NOT NULL,
  "received_quantity" DECIMAL(12,4) NOT NULL, "rejected_quantity" DECIMAL(12,4) NOT NULL,
  "reason" TEXT NOT NULL, "notes" TEXT, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_reception_differences_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "purchase_reception_differences_purchase_id_idx" ON "purchase_reception_differences"("purchase_id");
ALTER TABLE "purchase_reception_differences" ADD CONSTRAINT "purchase_reception_differences_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "national_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
