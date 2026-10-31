CREATE TABLE "sire_report_uploads" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "book_type" "SireBookType" NOT NULL,
    "archivo_origen" TEXT NOT NULL,
    "tipo_reporte" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "fecha_carga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sire_report_uploads_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "sire_proposals" ADD COLUMN "source_upload_id" TEXT;

CREATE UNIQUE INDEX "sire_report_uploads_company_id_file_hash_key"
ON "sire_report_uploads"("company_id", "file_hash");
CREATE INDEX "sire_report_uploads_company_id_period_book_type_idx"
ON "sire_report_uploads"("company_id", "period", "book_type");

ALTER TABLE "sire_report_uploads"
ADD CONSTRAINT "sire_report_uploads_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sire_proposals"
ADD CONSTRAINT "sire_proposals_source_upload_id_fkey"
FOREIGN KEY ("source_upload_id") REFERENCES "sire_report_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
