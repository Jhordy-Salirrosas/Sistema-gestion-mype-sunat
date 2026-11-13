CREATE TABLE "user_warehouses" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "warehouse_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_warehouses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_warehouses_user_id_warehouse_id_key" ON "user_warehouses"("user_id","warehouse_id");
CREATE INDEX "user_warehouses_warehouse_id_idx" ON "user_warehouses"("warehouse_id");
ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Los usuarios existentes no-admin conservan ALM-01; el ADMIN ve todos.
INSERT INTO "user_warehouses" ("id","user_id","warehouse_id")
SELECT gen_random_uuid()::text, u.id, w.id
FROM "users" u
JOIN "inventory_warehouses" w ON w.company_id = u.company_id AND w.warehouse_code = 'ALM-01'
WHERE u.role::text <> 'ADMIN'
ON CONFLICT DO NOTHING;
