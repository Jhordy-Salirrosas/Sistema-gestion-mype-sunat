-- No elimina ni reasigna usuarios. Si existen duplicados, detener y resolverlos antes de aplicar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" GROUP BY "email" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Existen correos repetidos en users; resuelva los duplicados antes de aplicar la unicidad global.';
  END IF;
END $$;
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
DROP INDEX "users_company_id_email_key";
