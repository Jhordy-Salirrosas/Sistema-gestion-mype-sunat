-- Contabilidad: datos informativos del asiento manual que el detalle muestra.
--
-- `observation` es una nota libre del contador y `responsible` la persona o
-- área que registró el asiento. Ninguno de los dos entra en la glosa del PLE:
-- son datos de trazabilidad interna.
--
-- Ambas columnas son opcionales, así que los asientos existentes (generados
-- por el puente de ventas, compras o importaciones) quedan en NULL.

ALTER TABLE "accounting_entries"
  ADD COLUMN IF NOT EXISTS "observation" TEXT,
  ADD COLUMN IF NOT EXISTS "responsible" TEXT;
