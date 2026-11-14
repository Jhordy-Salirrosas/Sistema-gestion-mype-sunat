-- Credenciales de la empresa para SUNAT/SIRE.
--
-- Cada contribuyente tiene su propio client_id/client_secret de la API SIRE y
-- su propio usuario SOL con clave. Se guardan cifradas (AES-256-GCM); el texto
-- plano nunca se persiste ni se encola.
CREATE TABLE "sire_configurations" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "client_id_enc" TEXT,
  "client_secret_enc" TEXT,
  "sol_user_enc" TEXT,
  "sol_password_enc" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sire_configurations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sire_configurations_company_id_key"
ON "sire_configurations"("company_id");

ALTER TABLE "sire_configurations"
ADD CONSTRAINT "sire_configurations_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
