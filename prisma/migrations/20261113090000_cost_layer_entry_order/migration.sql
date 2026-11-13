ALTER TABLE "inventory_cost_layers" ADD COLUMN IF NOT EXISTS "entry_order" BIGSERIAL;
CREATE INDEX IF NOT EXISTS "inventory_cost_layers_company_id_warehouse_id_product_id_entry_order_idx" ON "inventory_cost_layers"("company_id","warehouse_id","product_id","entry_order");
