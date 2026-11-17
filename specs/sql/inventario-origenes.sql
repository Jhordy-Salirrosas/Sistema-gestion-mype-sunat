-- Inventario de orígenes (source_module) realmente existentes en la base.
--
-- Ejecutar en el SQL Editor de Supabase y compartir el resultado: puede haber
-- códigos históricos que ya no se escriben en el código y que igual hay que
-- traducir en la columna ORIGEN.

-- 1. Todos los valores distintos, con cuántos asientos tiene cada uno.
SELECT "source_module" AS origen, count(*) AS asientos
FROM "accounting_entries"
GROUP BY "source_module"
ORDER BY asientos DESC;

-- 2. Comprobar si el período del asiento coincide con el mes de su fecha
--    contable (el número de asiento se numera por período, no por fecha).
SELECT count(*) AS asientos_desfasados
FROM "accounting_entries"
WHERE to_char("entry_date"::date, 'YYYY-MM') <> "period";

-- 3. Detalle de los desfasados, para decidir qué hacer con ellos.
SELECT "period", "entry_number", "entry_date"::date AS fecha_contable, "source_module"
FROM "accounting_entries"
WHERE to_char("entry_date"::date, 'YYYY-MM') <> "period"
ORDER BY "entry_date"
LIMIT 50;

-- 4. Asientos de anulación, para la etiqueta del punto 8.
SELECT "source_module" AS origen, "source_reference_id", count(*) AS asientos
FROM "accounting_entries"
WHERE "source_reference_id" LIKE 'ANUL%'
GROUP BY "source_module", "source_reference_id"
ORDER BY asientos DESC
LIMIT 20;
