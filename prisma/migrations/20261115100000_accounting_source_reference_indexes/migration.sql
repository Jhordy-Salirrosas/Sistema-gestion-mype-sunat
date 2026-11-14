-- Índices que faltaban para las consultas por documento de origen.
--
-- `accounting_entries` no tenía índice sobre (source_module, source_reference_id)
-- y esa búsqueda se hace en CADA emisión de comprobante (el puente consulta si
-- ya existe el asiento de la factura, del costo y de la nota) y tres veces más
-- en la auditoría. Sin índice, PostgreSQL resuelve el filtro escaneando todos
-- los asientos de la empresa.
--
-- `collections` tampoco tenía índice por factura, y la cartera y la auditoría
-- filtran por invoice_id.
--
-- Son índices aditivos: no cambian datos ni requieren migrar filas. En una
-- tabla ya grande, conviene crearlos en ventana de mantenimiento (con
-- CREATE INDEX CONCURRENTLY fuera de la transacción de Prisma) para no bloquear
-- escrituras mientras se construyen.

CREATE INDEX IF NOT EXISTS "accounting_entries_company_id_source_module_source_reference_id_idx"
  ON "accounting_entries"("company_id","source_module","source_reference_id");

CREATE INDEX IF NOT EXISTS "collections_company_id_invoice_id_idx"
  ON "collections"("company_id","invoice_id");
