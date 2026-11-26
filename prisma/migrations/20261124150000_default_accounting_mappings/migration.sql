-- Matriz global de cuentas PCGE por empresa, proceso y rol.
--
-- Es aditiva y no sobrescribe configuraciones existentes: cada empresa puede
-- mantener sus cuentas y solo recibe los roles que todavía no tenía definidos.
-- El servicio AccountingMappingService usa esta tabla como fuente principal y
-- deja las reglas históricas por proceso como overrides.

INSERT INTO "accounting_mappings" (
  "id", "company_id", "process_code", "role_code", "account_code",
  "is_active", "created_at", "updated_at"
)
SELECT
  md5(c."id" || ':' || v."process_code" || ':' || v."role_code"),
  c."id", v."process_code", v."role_code", v."account_code",
  true, now(), now()
FROM "companies" c
CROSS JOIN (VALUES
  ('VENTA', 'CXC', '12121'),
  ('VENTA', 'IGV', '40111'),
  ('VENTA', 'INGRESO', '70121'),
  ('VENTA', 'VENTA_EXONERADA', '70321'),
  ('VENTA', 'VENTA_INAFECTA', '70521'),
  ('VENTA', 'ICBPER', '74111'),
  ('VENTA', 'DETRACCION', '12129'),
  ('VENTA', 'RETENCION', '40114'),
  ('VENTA', 'DESCUENTO', '74'),
  ('VENTA', 'COSTO_VENTA', '69111'),
  ('VENTA', 'INVENTARIO', '20111'),
  ('COMPRA', 'COMPRA', '60111'),
  ('COMPRA', 'IGV', '40111'),
  ('COMPRA', 'CXP', '42121'),
  ('COMPRA', 'INVENTARIO', '20111'),
  ('IMPORTACION', 'FOB_EXTERIOR', '6011'),
  ('IMPORTACION', 'FLETE_INT', '60911'),
  ('IMPORTACION', 'SEGURO_INT', '60912'),
  ('IMPORTACION', 'AD_VALOREM', '60913'),
  ('IMPORTACION', 'TDA', '60915'),
  ('IMPORTACION', 'AGENCIA_ADUANA', '60914'),
  ('IMPORTACION', 'IGV_IMPORTACION', '40111'),
  ('IMPORTACION', 'PERCEPCION_IGV', '40113'),
  ('IMPORTACION', 'CXP_EXTERIOR', '42122'),
  ('IMPORTACION', 'CXP_LOCAL', '42121'),
  ('IMPORTACION', 'BANCOS', '1041'),
  ('IMPORTACION', 'TRANSITO', '2811'),
  ('IMPORTACION', 'VARIACION_EXISTENCIAS', '6111'),
  ('IMPORTACION', 'ALMACEN_FINAL', '20111'),
  ('SIRE_VENTAS', 'CXC', '121'),
  ('SIRE_VENTAS', 'VENTAS', '121'),
  ('SIRE_VENTAS', 'IGV', '40111'),
  ('SIRE_VENTAS', 'INGRESO', '701'),
  ('SIRE_VENTAS', 'BASE_VENTAS', '701'),
  ('SIRE_VENTAS', 'BASE', '701'),
  ('SIRE_COMPRAS', 'CXP', '421'),
  ('SIRE_COMPRAS', 'COMPRAS', '421'),
  ('SIRE_COMPRAS', 'IGV', '40111'),
  ('SIRE_COMPRAS', 'COMPRA', '6011'),
  ('SIRE_COMPRAS', 'BASE_COMPRAS', '6011'),
  ('SIRE_COMPRAS', 'BASE', '6011')
) AS v("process_code", "role_code", "account_code")
ON CONFLICT ("company_id", "process_code", "role_code") DO NOTHING;
