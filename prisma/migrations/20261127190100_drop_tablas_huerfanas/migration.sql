-- Elimina las tablas que quedaron fuera del esquema y que nadie consulta.
--
-- "Invoice" y "TransactionHistory" son remanentes del renombrado a "invoices" y
-- "transaction_history" (migración 20261016144319_ta19_modelo_datos_integral).
-- En una base creada desde cero no existen: por eso el DROP es IF EXISTS.
-- "kardex_movements" la creó esa misma migración y el esquema ya no la declara.
--
-- El orden importa: TransactionHistory tiene FK hacia Invoice.

DROP TABLE IF EXISTS "TransactionHistory";
DROP TABLE IF EXISTS "Invoice";
DROP TABLE IF EXISTS "kardex_movements";

-- El tipo sólo lo usaba kardex_movements.movement_type.
DROP TYPE IF EXISTS "KardexMovementType";
