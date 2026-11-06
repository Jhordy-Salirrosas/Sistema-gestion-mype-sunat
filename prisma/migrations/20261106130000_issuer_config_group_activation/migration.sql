-- NULL keeps all legacy groups inactive; no existing value is reinterpreted.
ALTER TABLE "companies"
  ADD COLUMN "issuer_sol_configured" BOOLEAN,
  ADD COLUMN "issuer_cert_configured" BOOLEAN;
