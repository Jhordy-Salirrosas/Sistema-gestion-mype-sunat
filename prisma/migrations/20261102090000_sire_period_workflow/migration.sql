CREATE TYPE "SirePeriodState" AS ENUM (
  'PROPUESTA',
  'PROCESANDO_REEMPLAZO',
  'PROCESANDO_PRELIMINAR',
  'PROCESANDO_ELIMINACION',
  'CON_PRELIMINAR',
  'PROCESANDO_GENERACION',
  'GENERADO',
  'ERROR'
);

CREATE TYPE "SireRecordOrigin" AS ENUM ('SUNAT', 'USUARIO');

CREATE TYPE "SireTicketOperation" AS ENUM (
  'REEMPLAZO',
  'REGISTRO_PRELIMINAR',
  'ELIMINACION_PRELIMINAR',
  'GENERACION'
);

CREATE TABLE "sire_periods" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "book_type" "SireBookType" NOT NULL,
  "state" "SirePeriodState" NOT NULL DEFAULT 'PROPUESTA',
  "ticket" TEXT,
  "ticket_operation" "SireTicketOperation",
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sire_periods_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "sire_proposals"
ADD COLUMN "period_id" TEXT,
ADD COLUMN "origin" "SireRecordOrigin" NOT NULL DEFAULT 'SUNAT',
ADD COLUMN "excluded_at" TIMESTAMP(3),
ADD COLUMN "excluded_by" TEXT;

CREATE UNIQUE INDEX "sire_periods_company_id_period_book_type_key"
ON "sire_periods"("company_id", "period", "book_type");
CREATE INDEX "sire_periods_state_ticket_idx"
ON "sire_periods"("state", "ticket");

ALTER TABLE "sire_periods"
ADD CONSTRAINT "sire_periods_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sire_proposals"
ADD CONSTRAINT "sire_proposals_period_id_fkey"
FOREIGN KEY ("period_id") REFERENCES "sire_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
