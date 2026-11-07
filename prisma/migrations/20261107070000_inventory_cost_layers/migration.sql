ALTER TABLE "companies" ADD COLUMN "inventory_cost_method" TEXT NOT NULL DEFAULT 'PROMEDIO';

CREATE TABLE "inventory_cost_layers" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "warehouse_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "quantity_remaining" DECIMAL(12,4) NOT NULL,
  "unit_cost" DECIMAL(14,4) NOT NULL,
  "source_movement_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_cost_layers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventory_cost_layers_company_id_warehouse_id_product_id_created_at_idx"
  ON "inventory_cost_layers"("company_id","warehouse_id","product_id","created_at");
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "inventory_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
