ALTER TABLE "companies"
  ADD COLUMN "issuer_environment" TEXT,
  ADD COLUMN "issuer_config_activated_at" TIMESTAMP(3),
  ADD COLUMN "issuer_config_version" TEXT;
CREATE TABLE "issuer_certificates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "company_id" TEXT NOT NULL,
  "encrypted_content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "issuer_certificates_company_id_idx" ON "issuer_certificates"("company_id");
