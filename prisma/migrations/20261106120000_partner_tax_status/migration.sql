CREATE TYPE "PartnerTaxIndicator" AS ENUM ('RETENCION', 'PERCEPCION', 'BUEN_CONTRIBUYENTE');

CREATE TABLE "partner_tax_status" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "indicator" "PartnerTaxIndicator" NOT NULL,
    "value" BOOLEAN NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partner_tax_status_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "partner_tax_status_partner_id_indicator_valid_from_idx"
  ON "partner_tax_status"("partner_id", "indicator", "valid_from");

ALTER TABLE "partner_tax_status"
  ADD CONSTRAINT "partner_tax_status_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
