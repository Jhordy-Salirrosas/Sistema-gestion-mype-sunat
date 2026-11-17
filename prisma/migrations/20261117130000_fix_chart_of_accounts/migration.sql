-- Correccion del catalogo de cuentas (modulo 1.3)
--
-- 1) Dos cuentas tenian el elemento guardado como numero ("2" y "4") en lugar
--    del nombre del PCGE, y la 2811 habia quedado como raiz del arbol.
-- 2) Faltaban cuentas padre intermedias: sus hijas aparecian sueltas.
--
-- Es idempotente: se puede ejecutar mas de una vez sin duplicar ni fallar.

BEGIN;

-- 1) Elementos y jerarquia mal grabados -------------------------------------
UPDATE accounting_accounts
   SET element = 'Activo realizable'
 WHERE code = '2811' AND element = '2';

UPDATE accounting_accounts
   SET parent_code = '281', level = 4
 WHERE code = '2811' AND parent_code IS NULL;

UPDATE accounting_accounts
   SET element = 'Pasivo'
 WHERE code = '4212' AND element = '4';

-- 2) Padres faltantes con nombre verificado --------------------------------
INSERT INTO accounting_accounts (id, code, name, element, nature, parent_code, level, is_active)
VALUES
  (gen_random_uuid()::text, '1121', 'Inversiones financieras - Otras',            'Activo', 'Deudora', '112', 4, true),
  (gen_random_uuid()::text, '603',  'Materiales auxiliares, suministros y repuestos', 'Gastos', 'Deudora', '60',  3, true),
  (gen_random_uuid()::text, '604',  'Envases y embalajes',                         'Gastos', 'Deudora', '60',  3, true),
  (gen_random_uuid()::text, '609',  'Costos vinculados con las compras',           'Gastos', 'Deudora', '60',  3, true),
  (gen_random_uuid()::text, '6881', 'Desvalorizacion de edificaciones',            'Gastos', 'Deudora', '688', 4, true)
ON CONFLICT (code) DO NOTHING;

-- 3) Enlazar las hijas que quedaron huerfanas -------------------------------
UPDATE accounting_accounts SET parent_code = '1121' WHERE code IN ('11211', '11212');
UPDATE accounting_accounts SET parent_code = '603'  WHERE code IN ('6031', '6032', '6033');
UPDATE accounting_accounts SET parent_code = '604'  WHERE code IN ('6041', '6042');
UPDATE accounting_accounts SET parent_code = '609'  WHERE code IN ('6091', '6092', '6093', '6094');
UPDATE accounting_accounts SET parent_code = '6881' WHERE code IN ('68812', '68813');

COMMIT;
