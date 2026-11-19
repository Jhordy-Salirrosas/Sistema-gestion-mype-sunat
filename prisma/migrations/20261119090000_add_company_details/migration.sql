-- Datos editables de la empresa y cache del padrón RUC.
--
-- `trade_name` conserva el nombre comercial configurado por la empresa, con
-- respaldo en `companies.trade_name`. `nombre_comercial` guarda el dato
-- devuelto por el proveedor RUC (Decolecta) para que también esté disponible
-- cuando la consulta se resuelve desde caché.

ALTER TABLE "company_configurations"
  ADD COLUMN IF NOT EXISTS "trade_name" TEXT;

ALTER TABLE "padron_ruc_cache"
  ADD COLUMN IF NOT EXISTS "nombre_comercial" TEXT;
