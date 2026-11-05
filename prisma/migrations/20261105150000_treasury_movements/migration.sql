-- CreateTable
CREATE TABLE "treasury_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "movement_date" TIMESTAMP(3) NOT NULL,
    "direction" TEXT NOT NULL,
    "document_reference" TEXT,
    "counterpart_name" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'PEN',
    "exchange_rate" DECIMAL(14,6),
    "source_module" TEXT NOT NULL,
    "source_reference_id" TEXT,
    "payment_method" TEXT NOT NULL DEFAULT 'TRANSFERENCIA',
    "bank_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasury_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treasury_movements_company_id_movement_date_idx" ON "treasury_movements"("company_id", "movement_date");

-- CreateIndex
CREATE INDEX "treasury_movements_company_id_direction_idx" ON "treasury_movements"("company_id", "direction");

-- AddForeignKey
ALTER TABLE "treasury_movements" ADD CONSTRAINT "treasury_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

