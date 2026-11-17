-- Cierre del catalogo de cuentas (modulo 1.3, segunda parte)
--
-- Quedaban seis cuentas huerfanas:
--   33404  Planta productora en produccion - Valor razonable
--   38352  Revaluacion
--   38472  Herramientas - Revaluacion
--   38473  Unidades de reemplazo - costo
--   38474  Unidades de reemplazo - Revaluacion
--   70521  Ventas inafectas del IGV
--
-- Decisiones:
-- - 33404 cuelga de 330 "Planta productora", que ya existe. Su padre anterior,
--   3340, no tiene sentido: 334 es "Unidades de transporte".
-- - 70521 cuelga de 70 "Ventas"; 705 y 7052 no existen.
-- - 383 y 384 no existian bajo 38 "Otros activos": se crean, junto con las
--   cuentas 3835 y 3847 que esperaban sus hijas.
--
-- No se toca la columna level: en todo el catalogo equivale al largo del codigo.

BEGIN;

INSERT INTO accounting_accounts (id, code, name, element, nature, parent_code, level, is_active)
VALUES
  (gen_random_uuid()::text, '383',  'Revaluacion de otros activos',          'Activo inmovilizado', 'Deudora', '38',  3, true),
  (gen_random_uuid()::text, '3835', 'Revaluacion',                          'Activo inmovilizado', 'Deudora', '383', 4, true),
  (gen_random_uuid()::text, '384',  'Unidades de reemplazo',                'Activo inmovilizado', 'Deudora', '38',  3, true),
  (gen_random_uuid()::text, '3847', 'Herramientas y unidades de reemplazo', 'Activo inmovilizado', 'Deudora', '384', 4, true)
ON CONFLICT (code) DO NOTHING;

UPDATE accounting_accounts SET parent_code = '330'  WHERE code = '33404';
UPDATE accounting_accounts SET parent_code = '70'   WHERE code = '70521';
UPDATE accounting_accounts SET parent_code = '3835' WHERE code = '38352';
UPDATE accounting_accounts SET parent_code = '3847' WHERE code IN ('38472', '38473', '38474');

COMMIT;
