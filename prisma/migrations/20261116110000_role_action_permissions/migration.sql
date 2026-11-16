CREATE TABLE "role_action_permissions" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "action_code" TEXT NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "role_action_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "role_action_permissions_company_id_role_action_code_key" ON "role_action_permissions"("company_id", "role", "action_code");
CREATE INDEX "role_action_permissions_company_id_role_idx" ON "role_action_permissions"("company_id", "role");
ALTER TABLE "role_action_permissions" ADD CONSTRAINT "role_action_permissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
