# Paquete 3B: expansión de roles (sin corte)

No aplicar a una base compartida como parte de este encargo. SQL ensayado únicamente con PostgreSQL efímero local. La cola oficial Prisma sigue bloqueada por drift; no ejecutar migrate deploy, reset ni db push.

1. Confirmar destino/schema/versiones; backup y restauración ensayada. Revisar dependencias, ADMIN activo, conteos por empresa/rol y overrides del paquete 1. Verificar existencia de sus tres tablas y enum; un merge no significa SQL aplicado. Abortar anomalías, no inferir estado de producción desde seeds.
2. Verificar desde la raíz: `sha256sum -c scripts/manual/roles-administrables.sha256`.
3. En una entrega futura autorizada, aplicar únicamente `roles-administrables-expansion.sql`, con psql `-v ON_ERROR_STOP=1`. Ya incluye transacción y lock_timeout. Crea company_roles, permission_menu_catalog y role_menu_permissions; inicializa cinco roles y 72 rutas por empresa. No cambia users.role ni role de las tablas de módulos/acciones, no recalcula overrides. Repetir el SQL aborta para evitar sobrescribir nombres/permisos.
4. Verificar cinco roles por empresa, 72 menús y 360 permisos por empresa; mismas filas, tipos enum, índices y overrides originales. El registro/seed nuevos inicializan roles+menús dentro de la transacción de empresa. Desplegar solo después del SQL aditivo y mantener ROLES_CUSTOM_ENABLED=false.
5. Reversa de expansión, antes del corte: drenar aplicación nueva, exportar catálogo/permisos y usar roles-administrables-expansion-reverse.sql. Aborta si encuentra rol propio, auditoría ROLE_* o columnas ya convertidas. No elimina datos nuevos para forzar reversa, ni usa DROP CASCADE sobre las tablas existentes. El retiro del binario no equivale a reversa de datos.

La conversión enum→texto, FKs sobre los tres campos existentes, validación de escritores y despliegue mixto corresponden al corte (parte 5), fuera de este paquete. El esquema candidato se entrega por separado; no se aplica aquí. La habilitación (parte 6) también queda pendiente. El flag solo puede ser efectivo con almacenamiento real de texto; un valor true sobre enum no habilita alta/asignación propias.

Para reproducir los ensayos locales se utiliza ROLES_TEST_DATABASE_URL explícita, host 127.0.0.1/localhost y base roles_*. Las pruebas SQL crean esquemas efímeros aleatorios en esa base y verifican aplicación, FKs, repetición, reversa y rechazo de reversa. Ningún script apunta a un destino remoto ni contiene credenciales compartidas.
