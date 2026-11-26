-- La pantalla de credenciales SIRE usa /sire/credenciales en el frontend.
-- Se registra en el catálogo técnico para que las instalaciones existentes
-- puedan conceder el menú sin depender de un nuevo alta de empresa.
INSERT INTO "permission_menu_catalog" ("menu_code", "module_code", "path_pattern")
VALUES ('MENU_SIRE_CREDENCIALES', 'M3', '/sire/credenciales')
ON CONFLICT ("menu_code") DO NOTHING;
