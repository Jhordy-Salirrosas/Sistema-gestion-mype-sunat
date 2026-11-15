CREATE TABLE "role_module_permissions" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "module_code" TEXT NOT NULL,
  "can_view" BOOLEAN NOT NULL DEFAULT true,
  "can_write" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "role_module_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "role_module_permissions_company_id_role_module_code_key" ON "role_module_permissions"("company_id","role","module_code");
CREATE INDEX "role_module_permissions_company_id_role_idx" ON "role_module_permissions"("company_id","role");
ALTER TABLE "role_module_permissions" ADD CONSTRAINT "role_module_permissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
