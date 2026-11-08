CREATE TYPE "SirePeriodQueryStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "sire_period_queries" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "job_id" TEXT,
  "book_code" TEXT NOT NULL,
  "status" "SirePeriodQueryStatus" NOT NULL DEFAULT 'PENDING',
  "result" TEXT,
  "error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "sire_period_queries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sire_period_queries_job_id_key"
ON "sire_period_queries"("job_id");

CREATE INDEX "sire_period_queries_company_id_created_at_idx"
ON "sire_period_queries"("company_id", "created_at");

ALTER TABLE "sire_period_queries"
ADD CONSTRAINT "sire_period_queries_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
