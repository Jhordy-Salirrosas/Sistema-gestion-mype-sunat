# Roles: expansión histórica y ruta de corte

## Ruta vigente: parte 5

La cola oficial Prisma está reconciliada. El corte se entrega con las migraciones
normales `20261118000100_roles_expansion_adoption` y
`20261118000200_roles_text_cutover`. Adoptan la expansión existente sin
sobrescribirla y convierten las tres columnas conservando sus datos. La forma
actual del catálogo contiene 73 menús y 365 permisos para cinco roles.

No ejecutar los SQL manuales siguientes para cortar una base ya expandida.
No usar db push, reset ni diff automático. La ventana de despliegue y el cambio
de ROLES_CUSTOM_ENABLED requieren coordinación posterior: no forman parte de
la construcción. Drenar todos los escritores enum antes del migrate deploy.
Consultar `docs/m1/roles-cutover-parte5.md` y la fase 0 aprobada `6b39e702`.

## Referencia histórica: expansión con columnas enum

Los SQL manuales quedan como evidencia y para ensayos locales de compatibilidad,
no como una segunda ruta de producción del corte.

1. Confirmar destino/schema/versiones; backup y restauración ensayada. Revisar dependencias, ADMIN activo, conteos por empresa/rol y overrides del paquete 1. Verificar existencia de sus tres tablas y enum; un merge no significa SQL aplicado. Abortar anomalías, no inferir estado de producción desde seeds.
2. Verificar desde la raíz: `sha256sum -c scripts/manual/roles-administrables.sha256`.
3. En una entrega futura autorizada, aplicar únicamente `roles-administrables-expansion.sql`, con psql `-v ON_ERROR_STOP=1`. Ya incluye transacción y lock_timeout. Crea company_roles, permission_menu_catalog y role_menu_permissions; inicializa cinco roles y 73 rutas por empresa. No cambia users.role ni role de las tablas de módulos/acciones, no recalcula overrides. Repetir el SQL aborta para evitar sobrescribir nombres/permisos.
4. Verificar cinco roles por empresa, 73 menús y 365 permisos por empresa; mismas filas, tipos enum, índices y overrides originales. El registro/seed nuevos inicializan roles+menús dentro de la transacción de empresa. Desplegar solo después del SQL aditivo y mantener ROLES_CUSTOM_ENABLED=false.
5. Reversa de expansión, antes del corte: drenar aplicación nueva, exportar catálogo/permisos y usar roles-administrables-expansion-reverse.sql. Aborta si encuentra rol propio, auditoría ROLE_* o columnas ya convertidas. No elimina datos nuevos para forzar reversa, ni usa DROP CASCADE sobre las tablas existentes. El retiro del binario no equivale a reversa de datos.

La conversión enum→texto y sus FK ahora están construidas en las dos migraciones normales de parte 5; el esquema activo y el cliente generado ya son de texto. La referencia de prisma/cutover documenta el mismo contrato. La habilitación (parte 6) también queda pendiente. El flag solo puede ser efectivo con las tres columnas de texto y sus FKs compuestas validadas; un valor true sobre enum no habilita alta/asignación propias.

Para reproducir los ensayos locales se utiliza ROLES_TEST_DATABASE_URL explícita, host 127.0.0.1/localhost y base roles_*. Las pruebas SQL crean esquemas efímeros aleatorios en esa base y verifican aplicación, FKs, repetición, reversa y rechazo de reversa. Ningún script apunta a un destino remoto ni contiene credenciales compartidas.
