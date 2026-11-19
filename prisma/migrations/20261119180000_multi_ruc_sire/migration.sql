-- Multi-RUC: las credenciales SIRE viven solo en `sire_configurations`.
--
-- Las columnas SOL de `companies` pertenecen al emisor de comprobantes
-- (facturación), no a SIRE. Se renombran para dejar explícita esa separación
-- y se eliminan las credenciales SIRE duplicadas de la empresa.

ALTER TABLE "companies"
  RENAME COLUMN "sol_user" TO "sunat_issuer_username";

ALTER TABLE "companies"
  RENAME COLUMN "sol_pass_encrypted" TO "sunat_issuer_password_enc";

ALTER TABLE "companies"
  DROP COLUMN IF EXISTS "sire_client_id_enc";

ALTER TABLE "companies"
  DROP COLUMN IF EXISTS "sire_client_secret_enc";
