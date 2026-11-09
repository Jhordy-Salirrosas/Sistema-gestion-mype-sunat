-- CreateTable
CREATE TABLE "invoice_aggregates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "kind" VARCHAR(2) NOT NULL,
    "identifier" VARCHAR(32) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "reference_date" VARCHAR(10) NOT NULL,
    "generation_date" VARCHAR(10) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RESERVED',
    "issuer_ruc" VARCHAR(11) NOT NULL,
    "environment" TEXT NOT NULL,
    "xml" TEXT,
    "xml_hash" TEXT,
    "zip_base64" TEXT,
    "members" JSONB NOT NULL,
    "ticket" TEXT,
    "transport_uncertain" BOOLEAN NOT NULL DEFAULT false,
    "result" JSONB,
    "error" TEXT,
    "job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_aggregates_company_id_state_created_at_idx" ON "invoice_aggregates"("company_id", "state", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_aggregates_company_id_kind_identifier_key" ON "invoice_aggregates"("company_id", "kind", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_aggregates_company_id_kind_fingerprint_key" ON "invoice_aggregates"("company_id", "kind", "fingerprint");

