ALTER TYPE "DiscrepancyType" ADD VALUE 'DUPLICADO_LLAVE';

CREATE TYPE "SireDuplicateSource" AS ENUM ('LOCAL', 'SIRE', 'AMBOS');

ALTER TABLE "sire_discrepancies"
ADD COLUMN "duplicate_source" "SireDuplicateSource",
ADD COLUMN "taxable_base_difference" DECIMAL(14, 2),
ADD COLUMN "igv_difference" DECIMAL(14, 2);
