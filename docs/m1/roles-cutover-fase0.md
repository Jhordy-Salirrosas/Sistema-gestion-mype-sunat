# Roles administrables — fase 0 de cutover y habilitación

## Alcance, bases y veredicto

Fecha: 17/11/2026, America/Lima. Rama documental: `docs/roles-cutover-fase0`.
Back main confirmado por fetch: **`d4d362f602452caee2ae26648d3971597904d4c4`**.
Front main inspeccionado solo en lectura: **`21c662f8b7adaf56988c48275667a4c44b6d81d4`**,
CarlosSoles/Fronted-sistema-mype-sunat. El espejo frontend del back no se usó
como fuente del inventario del front.

**Solo análisis, plan y ensayos locales.** Este commit modifica únicamente
este documento. No entrega código, esquema, migraciones ni pruebas nuevas;
no cambia variables, servicios o datos de producción/compartidos; no crea PR
ni merge. Los SQL propuestos se ensayaron exclusivamente en PostgreSQL 17
local efímero con datos sintéticos, fuera del árbol versionado de migraciones.

El historial de producción reconciliado 80/80, sus checksums y la ejecución
de `prisma migrate deploy` en el build de Render son hechos aportados por el
encargo; no se accedió a producción para verificarlos. En local se reprodujeron
las 80 migraciones del repositorio. **La ruta prevista es ahora Prisma normal**;
las instrucciones antiguas que indican una cola bloqueada ya no gobiernan el
corte. No se reescribirá ninguna de esas 80 migraciones ni su checksum.

Veredicto: el corte es viable mediante dos migraciones nuevas revisadas,
adopción de expansión y conversión conservadora. La habilitación no es solo
cambiar una variable. Antes hay que resolver los siguientes puntos:

1. Producción informa 72 menús/360 permisos por empresa; el código actual y el
   SQL manual ya tienen **73** por `/accounting/guia`. Adoptar ese delta sin
   sobrescribir los 360 permisos ni nombres renombrados.
2. El diff automático Prisma propone **DROP COLUMN/ADD COLUMN** en los tres
   campos role. Además contiene cambios ajenos. No es un SQL de corte seguro.
3. El cliente enum vigente falla al escribir después del corte. Deben drenarse
   el runtime anterior de Render y todos los workers/escritores relacionados
   antes de que el build aplique la conversión.
4. El front actual tiene dos filtros locales ADMIN en inventario que no están
   en la paleta/rutas. Hay que decidir y alinear esa política antes de habilitar.

## 1. Línea base y documentos contrastados

| Ejecución sin cambios de código | Archivos | Aprobados | Omitidos | Pruebas aprobadas | Pruebas omitidas | Fallos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Suite completa back, PostgreSQL local | 479 | 469 | 10 | 4596 | 63 | 0 |
| Integraciones auth, con ROLES_TEST_DATABASE_URL local | 10 | 10 | 0 | 65 | 0 | 0 |

La segunda corrida se solapa con la primera: **no se suman** sus conteos.
Activa también las integraciones de roles que requieren su variable específica.
La suite completa conserva 12 snapshots aprobados. Build Prisma/Nest aprobado.
Comando de la suite: `CI=true TEST_DATABASE_URL=<local> RUN_INTEGRATION_TESTS=required
NODE_OPTIONS=--max-old-space-size=6144 npm test -- --runInBand`; el build se
realizó antes, como exige la regresión HTTP ES2023. Se generó el cliente activo
enum, sin sustituirlo por el candidato. No se ejecutó suite del front: se hizo
inventario estático, sin cambios allí.

Fuentes de diseño:

- `docs/m1/roles-administrables-impacto.md` **no está en este main**. Se releyó
  mediante `git show 63f67d6c:docs/m1/roles-administrables-impacto.md`, de la
  rama documental anterior; no se reconstruyó ni modificó aquel informe.
- `docs/m1/roles-administrables.md`, `prisma/cutover/auth.prisma`, su README,
  `scripts/manual/roles-administrables-expansion.sql` y su reversa.
- El candidato validó con los otros archivos Prisma actuales en un directorio
  temporal. Su diferencia en auth sigue siendo la prevista: tres strings,
  tres FK compuestas, relaciones inversas y retiro del enum. Deben actualizarse
  sus comentarios de transición y las acciones de FK descritas más abajo.

## 2. Persistencia y consumidores vigentes

### Columnas

Hay exactamente tres columnas que usan el enum Prisma/PostgreSQL Role:

| Modelo/campo | Tabla/columna | Estado y destino |
| --- | --- | --- |
| User.role | users.role | Role NOT NULL, default OPERADOR_FACTURACION → text NOT NULL, mismo default textual |
| RoleModulePermission.role | role_module_permissions.role | Role NOT NULL → text NOT NULL; conservar única empresa/rol/módulo e índice empresa/rol |
| RoleActionPermission.role | role_action_permissions.role | Role NOT NULL → text NOT NULL; conservar única empresa/rol/acción e índice empresa/rol |

Referencias: `prisma/schema/auth.prisma:3,110,128,143`. Ningún otro campo del
esquema usa ese enum. CompanyRole.code y RoleMenuPermission.role_code ya son
texto; esta última ya tiene FK (company_id,role_code) al catálogo. Los roles
de terceros y `accounting_mappings.role_code` son otros dominios: no convertirlos.
Email único global, hashes, IDs, empresa, actividad y refresh tokens se preservan.

### Back: flujo completo

Rutas siguientes relativas a `src/`, salvo indicación distinta:

| Consumidor | Estado y requisito de corte |
| --- | --- |
| `modules/auth/{domain/entities/userEntity,domain/ports/tokenServicePort,application/mappers/userMapper}.ts` | UserRole y claim role ya son strings/codes; no renombrar el contrato exterior |
| `modules/auth/application/dto/{createUserDto,updateUserDto,roleCatalogDto}.ts` | Código técnico con validación sintáctica; pertenencia/asignabilidad se resuelve en servicios, no por una lista enum en el DTO |
| `modules/auth/infrastructure/persistence/prismaUserRepositoryAdapter.ts` | Lee/escribe rol, registro y creación empresarial; inicializa catálogo antes de usuarios; regenerar cliente texto |
| `modules/auth/application/services/createUserService.ts`, `warehouseAccessService.ts` | Alta/asignación por ADMIN, pertenencia empresarial, flag, almacenes; puentes `as never` por el cliente enum deberán retirarse al activar el esquema texto |
| `modules/auth/application/use-cases/{loginUseCase,registerUseCase,refreshTokenUseCase,getProfileUseCase}.ts` | Login/registro/refresh firman o devuelven role como code; refresh obtiene usuario de DB y vuelve a firmar desde su rol vigente |
| `modules/auth/infrastructure/security/nativeJwtAdapter.ts`, `infrastructure/guards/authGuard.ts` | JWT HS256 y exp mantienen formato; AuthGuard valida firma y delega a membresía antes de poblar request.user |
| `modules/auth/application/services/sessionMembershipService.ts` | Cada petición recarga usuario/empresa activos y rol DB; ignora el privilegio de un claim de rol antiguo; rol ajeno/no habilitado produce 401 |
| `modules/auth/infrastructure/guards/{rolesGuard,capabilityGuard,actionPermissionsGuard}.ts` | RolesGuard mantiene comparación exacta por code para reservas; CapabilityGuard consulta acciones efectivas; fecha de emisión conserva su guard específico |
| `modules/auth/infrastructure/interceptors/moduleWriteInterceptor.ts` | Mapa vigente de 12 prefijos, GET/HEAD can_view y escrituras can_write; ADMIN mantiene su bypass de escritura; auth/master-data/health y prefijos no mapeados quedan fuera como hoy |
| `common/interceptors/configurationAdminInterceptor.ts` | Configuración global reservada a ADMIN, también fuera de M1; no se delega por asignar un menú |
| `modules/auth/application/services/{modulePermissionsService,actionPermissionsService,menuPermissionsService,roleCatalogService}.ts` | Enumeran catálogo empresarial; overrides, defaults, permisos de acceso adicionales y flag deciden derechos; roles propios sin concesiones denegados |
| `modules/auth/infrastructure/controllers/{authController,rolesController}.ts` | Ocho comprobaciones ADMIN en auth; helper ADMIN para gestión de roles/menús; snapshot y catálogos ya existen |
| `modules/auth/application/services/warehouseAccessService.ts:61` | Lock transaccional de companies para cambios de rol/actividad, no autobloqueo, último ADMIN activo protegido; acceso global de almacenes solo para ADMIN |
| `modules/auth/application/services/securityAudit.ts` | Actor, empresa, code, antes/después y digest en audit_logs; preservar auditoría, no reescribirla para el corte |
| `modules/inventory/application/services/inventoryCatalogsService.ts:613` | Transporta role en personas; no es un nuevo chequeo de autorización por sí mismo |
| `prisma/seeds/auth.seed.ts:82`, repositorio de usuarios | Cinco roles de sistema y menús antes de usuarios, dentro de la transacción; no ejecutar el seed demo en producción |

El claim continúa siendo `{sub,email,companyId,role:string}`; login conserva
900 s de access token y refresh la política de rotación vigente. Un cambio de
asignación no conserva permisos del token anterior: la membresía carga DB en
cada request. Un renombre cambia name, no code, firma ni permisos.

`SYSTEM_ROLES` conserva los cinco códigos, y ACCOUNTANT/OPERATOR siguen
reservados como alias de entrada del front, nunca roles nuevos de empresa.
El constante ROLES de módulos sobrevive como compatibilidad, pero list/replace
ya recorren CompanyRole. Los `as never` de rol en repositorio, alta,
warehouseAccessService y servicios de módulos/acciones son puentes de tipado,
no autorización: no deben ocultar incompatibilidades después del corte.

### Los 19 decoradores del impacto y los dos casos especiales

Los **19 @Roles antiguos ya fueron sustituidos por RequireCapability**, no
hay que volver a convertirlos. Cuatro son de clase, quince de método. Se
contrasta metadata real con `test/fixtures/legacyEndpointRoles.json` y
`test/unit/auth/securityCatalog.spec.ts`. Inventario actual:

| Archivo/handler (controllers de invoices) | Línea | Capacidad |
| --- | ---: | --- |
| `invoiceConfigController.ts::actualizarConfiguracion` | 61 | `INVOICE_CONFIG_EDIT` |
| `invoiceConfigController.ts::crearSerie` | 83 | `INVOICE_CONFIG_EDIT` |
| `invoiceForcedResendController.ts::InvoiceForcedResendController` | 11 | `INVOICE_FORCE_RESEND` |
| `invoiceQueryController.ts::enviarResumen` | 183 | `INVOICE_SUMMARY_SEND` |
| `invoiceQueryController.ts::enviarBaja` | 203 | `INVOICE_SUMMARY_SEND` |
| `invoiceQueryController.ts::enviarAnulacionNotas` | 234 | `INVOICE_SUMMARY_SEND` |
| `invoiceQueryController.ts::consultarAgregado` | 244 | `INVOICE_SUNAT_POLL` |
| `invoiceQueryController.ts::resolverDlq` | 302 | `INVOICE_RESOLVE_DLQ` |
| `invoiceQueryController.ts::reintentarCdr` | 316 | `INVOICE_RETRY_CDR` |
| `invoiceQueryController.ts::notaCredito` | 343 | `INVOICE_NOTES_ISSUE` |
| `invoiceQueryController.ts::notaDebito` | 363 | `INVOICE_NOTES_ISSUE` |
| `invoiceBridgeReprocessController.ts::InvoiceBridgeReprocessController` | 12 | `INVOICE_REPROCESS_BRIDGE` |
| `invoicesController.ts::create` | 58 | `INVOICE_EMIT` |
| `invoicesController.ts::emitir` | 88 | `INVOICE_EMIT` |
| `invoiceDetractionController.ts::deposit` | 20 | `INVOICE_DETRACTION_REGISTER` |
| `invoiceDetractionController.ts::edit` | 29 | `INVOICE_DETRACTION_REGISTER` |
| `invoiceAccountingRegularizationController.ts::InvoiceAccountingRegularizationController` | 15 | `INVOICE_ACCOUNTING_REGULARIZE` |
| `invoiceBatchRetryController.ts::InvoiceBatchRetryController` | 11 | `INVOICE_BATCH_RETRY` |
| `invoiceSunatConsultController.ts::consultar` | 18 | `INVOICE_SUNAT_POLL` |

Los casos especiales también están migrados: `invoiceForcedResendService.ts:21`
exige INVOICE_FORCE_RESEND para el actor; `invoiceDownloadController.ts:45`
consulta INVOICE_XML_REPAIR para decidir si puede generar/reparar XML. AUDITOR
conserva descarga sin ese efecto. Las acciones FORCE_RESEND, RESOLVE_DLQ y
REPROCESS_BRIDGE mantienen su intersección con sus respectivos *_ACCESS.
INVOICE_CONFIG_EDIT sigue reservada a ADMIN, aun con override true de otro rol.

Hay además **tres @Roles actuales**, posteriores al inventario original:
`invoiceCommercialDefaultsController.ts:12` (save),
`sunatConnectionTestController.ts:8` (clase) y
`configurationHubController.ts:21` (clase), todos ADMIN. No se borran ni se
reinterpretan como operaciones delegables. Conservan RolesGuard.

### Front actual y diferencias respecto al impacto original

| Consumidor | Estado actual |
| --- | --- |
| `modules/auth/types/auth.types.ts`, `stores/authStore.ts`, `modules/auth/lib/roleCode.ts` | Role abierto; normaliza ACCOUNTANT/OPERATOR al entrar/hidratar sesión; guarda roleName |
| `modules/auth/services/{rolesApi,permissionsApi,modulePermissionsApi,actionPermissionsApi,warehousesApi}.ts` | Contratos por code; catálogo/nombre desde API; alta/asignación/edición existentes |
| `modules/auth/hooks/{useServerPermissions,usePermissionsIdentity,useActionPermissions}.ts` | Snapshot `/auth/permissions/me`; claves por usuario/empresa/rol; carga/error denegados; actualiza nombre sin logout; maneja 429 con pausa |
| `hooks/useRolePermissions.ts`, `modules/invoices/hooks/useInvoiceWritePermission.ts` | Fachadas del servidor, sin matriz local de cinco roles; M1 requiere módulo y capacidad |
| `routes/{RoleProtectedRoute,appRoutes,roleNavigation}.tsx/.ts` | Navegación e inicio desde snapshot; no 72 listas de roles como en el informe antiguo |
| `components/layout/{Sidebar,CommandPalette,KeyboardShortcuts}.tsx` | Menús/atajos desde servidor; excepción residual del sidebar indicada abajo |
| `modules/auth/pages/RolePermissionsPage.tsx`, `components/RoleMaintainer.tsx` | Roles dinámicos; módulos/acciones/menús; ADMIN bloqueado; creación y edición de propios depende de config.customRolesEnabled |
| `modules/auth/pages/UserWarehousesPage.tsx` | Roles de API; filtra propios si el flag es false; asignación empresarial y almacenes |
| `hooks/useAuth.ts`, `components/layout/UserNavDropdown.tsx`, `modules/auth/pages/ProfilePage.tsx` | isAdmin por code reservado; etiqueta desde roleName con code de respaldo |

Excepción encontrada: `Sidebar.tsx:178–179,286` contiene dos listas
`allowedRoles:['ADMIN']` para `/inventory/adjustments` y `/inventory/opening`.
La paleta filtra solo canNavigate y las rutas usan el servidor. El back de
inventario no incorpora un guard ADMIN equivalente en esos handlers; conserva
el filtro de módulo/almacén. **Decisión pendiente antes de parte 6:** retirar
las listas locales y seguir el catálogo, o aprobar una reserva administrativa
explícita con enforcement y equivalencia en las tres superficies. No ampliar
silenciosamente privilegios de sistema ni presentar un rol como delegable si
el sidebar lo oculta. Esta fase no modifica esas rutas.

`roles-config` tiene caché y no recibe push por cambiar Render. La certificación
requiere recarga/inicio limpio para leer el nuevo flag; no asumir que una
pestaña abierta verá el cambio de inmediato. La navegación por menú no es
por sí sola permiso de escritura ni cobertura de todos los endpoints del back.

## 3. Diseño de las migraciones Prisma normales

### Preparación y adopción: primera migración nueva

No usar el viejo SQL de expansión directamente: aborta si las tablas ya existen.
No usar CREATE TABLE IF NOT EXISTS sin validar el objeto existente. Propuesta:

1. Preflight de versión, 80 historiales/checksums aprobados, ausencia de fila
   fallida, enum exacto de cinco valores y solo sus tres columnas conocidas;
   inspeccionar dependencias, vistas, defaults, tamaños, índices, roles ajenos
   o huérfanos, ADMIN activo y catálogos. No inferir esto solo del historial.
2. En transacción con lock_timeout=5s y statement_timeout=120s: si no existe
   ninguna de las tres tablas de expansión, crear el DDL completo compatible;
   si existen las tres, validar columnas, tipos, null/defaults, PK/únicas,
   CHECKs, FK y sus acciones contra el perfil revisado. Si existe solo una
   parte o la forma difiere, abortar sin reconstruir/sobrescribir.
3. Validar códigos/nombres de sistema, cinco roles por empresa, pertenencia y
   matriz rectangular previa. Conservar nombres renombrados y todos los
   valores booleanos. No resolver diferencias con TRUNCATE, DROP o UPDATE
   masivo. No sustituir nombres existentes por sus defaults.
4. Comparar códigos, módulo, ruta y padre del catálogo con el código actual.
   Aceptar exactamente el catálogo anterior de 72 o el actual de 73; el único
   faltante permitido es MENU_ACCOUNTING_GUIA. Cualquier otra diferencia se
   revisa antes del corte.
5. Añadir solo MENU_ACCOUNTING_GUIA, módulo M4, ruta `/accounting/guia`, padre
   MENU_ACCOUNTING, si falta. Añadir sus cinco permisos por empresa si faltan:
   ADMIN/CONTADOR/AUDITOR true, operadores false. ON CONFLICT DO NOTHING tras
   verificar el contrato conserva cualquier fila ya existente y sus overrides.
   Resultado esperado: 73 menús/365 permisos por empresa de cinco roles;
   los 360 originales permanecen iguales. Usar el catálogo antes de inicializar
   nuevas empresas: initializeCompanyRoles ya intenta crear 73 filas por rol.
6. Esta migración nueva registra la adopción en Prisma. No marcar como aplicada
   una migración que no se ha ejecutado ni modificar las 80 anteriores.

Las FK manuales de CompanyRole→Company, padre de menú y permiso→menú tienen
ON UPDATE NO ACTION, mientras el candidato deja el default Prisma CASCADE.
Preservar la política real: explicitar NoAction en esas tres relaciones del
esquema aprobado para el corte. Las FK compuestas de rol serán Restrict.
No arrastrar alteraciones de FK de otros módulos para alinear todo el proyecto.

### Conversión: segunda migración nueva

Ya adoptada la expansión, convertir exclusivamente las tres columnas. Mantener
los nombres/columnas/unicidad de los ocho índices de esas tres tablas. SQL
central ensayado (propuesta, **no ejecutar en producción en esta fase**):

```sql
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
LOCK TABLE public.companies, public.company_roles,
  public.permission_menu_catalog, public.role_menu_permissions,
  public.users, public.role_module_permissions, public.role_action_permissions
  IN ACCESS EXCLUSIVE MODE;
-- Repetir preflight dentro del lock: tipos, dependencias, pertenencia y ADMIN.
ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'OPERADOR_FACTURACION';
ALTER TABLE public.role_module_permissions
  ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.role_action_permissions
  ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.users ADD CONSTRAINT users_company_id_role_fkey
  FOREIGN KEY(company_id,role) REFERENCES public.company_roles(company_id,code)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.role_module_permissions
  ADD CONSTRAINT role_module_permissions_company_id_role_fkey
  FOREIGN KEY(company_id,role) REFERENCES public.company_roles(company_id,code)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.role_action_permissions
  ADD CONSTRAINT role_action_permissions_company_id_role_fkey
  FOREIGN KEY(company_id,role) REFERENCES public.company_roles(company_id,code)
  ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT users_company_id_role_fkey;
ALTER TABLE public.role_module_permissions
  VALIDATE CONSTRAINT role_module_permissions_company_id_role_fkey;
ALTER TABLE public.role_action_permissions
  VALIDATE CONSTRAINT role_action_permissions_company_id_role_fkey;
DROP TYPE public."Role"; -- RESTRICT implícito; nunca CASCADE.
COMMIT;
```

No hay una etapa pública con FK sin validar: NOT VALID y VALIDATE están en la
misma transacción. El preflight incluye las dependencias del tipo y su array;
una dependencia inesperada aborta. No borrar/recrear role: el SQL automático
visto en local lo propone incluso para users, con su default; en permisos no
nulos no preserva las asignaciones/overrides. No aplicar el diff global, que
además propone borrar kardex_movements y cambios ajenos. Historial reconciliado
no equivale a datamodel completo alineado con DDL: son controles distintos.

El artefacto de parte 5 activará el auth.prisma candidato revisado, relaciones
inversas y cliente texto; actualizará el test que todavía exige esquema activo
enum y retirará puentes de tipado. Conservará contratos/validaciones/guards.
Las dos migraciones deberán reproducirse en shadow/fresh y sobre expansión
previa; su SQL revisado será el que aplique `migrate deploy` en el build.
No se propone migrate dev contra producción, db push, reset ni resolve manual
para saltar diferencias conocidas.

### Ensayos realizados y límites

Laboratorio local con las 80 migraciones oficiales, una empresa sintética,
cinco usuarios (uno por rol), cinco overrides de módulo, cinco de acción,
cinco CompanyRole y matriz de 72 menús/360 permisos. Se renombró CONTADOR y
se persistió una denegación de menú para verificar que no se pierden.

| Comprobación | Resultado observado |
| --- | --- |
| Candidato Prisma combinado con esquema main | Válido, sin cambiar esquema activo |
| Conversión SQL conservadora | 32,18 ms con este fixture pequeño |
| Usuarios, módulos, acciones, catálogo de roles y 360 permisos | Conteos y huellas de filas idénticos antes/después de convertir |
| Tres columnas + tres FK compuestas | text; las tres FK validadas |
| Ocho índices originales | Mismos nombres, columnas y unicidad |
| Rol inexistente / de otra empresa | Rechazados, SQLSTATE 23503 |
| Reversa con referencias a rol propio | Abortada explícitamente, sin conversión parcial |
| Reversa con datos de sistema | 15,75 ms; huellas originales intactas |
| Reaplicación tras reversa | Correcta |
| Adopción del menú 73 | 365 filas; huella de los 360 originales intacta; renombre y denegación conservados |
| Dos migraciones temporales vía migrate deploy, expansión previa | 82/82 aplicadas; checksums coincidentes |
| Las mismas migraciones desde una base vacía | 82/82 aplicadas, sin colisiones de tablas |
| Repetir migrate deploy tras aplicación | Sin migraciones pendientes |
| Expansión parcial, columna inesperada o ruta/módulo alterado | Preflight aborta (P0001) y revierte el ensayo |
| Escritor que retiene lock de users | Aborta por lock_timeout a los ~5 s (55P03); las tres columnas permanecen enum |
| Cliente enum actual contra DB convertida | Lee roles de sistema; escribir falla P2039 / SQLSTATE 42704, tipo public.Role ausente |

Las propuestas temporales del laboratorio se llamaron
20261119000100_roles_expansion_adoption y 20261119000200_roles_text_cutover;
no existen en prisma/migrations de esta rama. Los identificadores finales se
fijarán al construir. Checksums de las dos propuestas temporales ensayadas (no son migraciones de
esta rama ni identificadores aprobados de release):

- Adopción: `bbfde5fcb66bd5831f7ae7f0f66fd2c29dcc157956f322b5c477cdddd6bfb10b`.
- Conversión: `e06d3dbc5b074a4b8331a9f7a08b3335cff665d71c56e9976c69db3ec0ce60e8`.

No se afirma que estos tiempos midan producción: faltan
sus volúmenes, sesiones, dependencias y locks. El ensayo no sustituye la
certificación del artefacto con cliente texto ni su prueba HTTP antes/después.

## 4. Interruptor y secuencia coordinada, con reversa por paso

La variable **ROLES_CUSTOM_ENABLED** pertenece al entorno del servidor Render,
no a VITE ni a localStorage. Solo el string exacto `true` habilita la primera
compuerta. `roleCatalogService.ts:21–28` exige además tres columnas text y una
FK compuesta validada al catálogo por tabla. Hoy verifica cardinalidad de FK,
no el orden/nombre exacto de sus columnas: antes de habilitar se debe comprobar
el contrato exacto (company_id,role)→(company_id,code); endurecer y probar ese
predicado en parte 5 para no aceptar una FK compuesta equivocada como evidencia.
La creación requiere también ADMIN; la asignación vuelve a validar empresa y
flag. Las altas/asignaciones siguen apagadas durante todo el corte.

El flag es **global**, no por tenant. No hay canary switch empresarial. La
habilitación se coordina con los demás ADMIN y no se asignan roles propios
hasta comprobar que todas las instancias/servicios están en el mismo estado.

| Paso | Acción / evidencia para avanzar | Reversa y condición |
| --- | --- | --- |
| 0. Preparar | Aprobar SQL/checksums nuevos, artefactos y versión de front; resolver menú 73 y dos filtros locales; backup/PITR recuperable; preflight firmado; flag false en todos los procesos; rollback preparado y probado | Cancelar ventana: no hay DDL aplicado; no alterar historial/flag |
| 1. Drenar | Ventana de mantenimiento explícita; bloquear tráfico relacionado, nuevos registros y cambios de roles/permisos; detener runtime anterior, workers, cron y escritores enum; confirmar ausencia de sesiones/locks de esos procesos | Reabrir con artefacto enum anterior solo si las columnas siguen enum; si hubo DDL, seguir la rama correspondiente de los pasos siguientes |
| 2. Desplegar parte 5 | Artefacto texto compilado/testeado antes; ejecutar migrate deploy normal como último paso exitoso de build antes de iniciar tráfico; revisar orden real del build Render; verificar journal, tipos y FK | Si falla adopción, su transacción revierte; si conversión falla, confirmar rollback y estado antes de `migrate resolve --rolled-back` de esa migración fallida; no marcarla aplicada. La adopción ya confirmada puede permanecer compatible con enum |
| 3. Verificar con flag false | Todos los procesos con cliente texto; hashes/filas/índices, 73 menús y overrides; cinco roles equivalentes; POST roles y asignar propios siguen 403; health y colas normales | Si DB ya es texto, preferir restaurar artefacto texto bueno. No arrancar binario enum sobre ella. Si se requiere volver a enum, aplicar una migración compensatoria nueva, con el preflight de reversa, y después desplegar el artefacto enum |
| 4. Habilitar parte 6 | Aprobación operativa explícita; configurar ROLES_CUSTOM_ENABLED=true en Render; completar reinicio/despliegue de todos los procesos; GET roles/config y permissions/me muestran true; recargar front | Restaurar false y desplegar. Usuarios propios quedan denegados: si se requiere continuidad, reasignar antes a roles de sistema mediante ADMIN y con autorización/auditoría. Esto es reversa lógica; no convierte columnas |
| 5. Certificar | Usar empresa/cuentas canarias y lista de sección 5; actor ADMIN de rescate activo; comprobar auditoría y no mezclar flag/config de cachés | Ante fallo, detener nuevas altas/asignaciones; restaurar datos de certificación con ADMIN; aplicar reversa lógica del paso 4. No restaurar una copia completa que borre operaciones de negocio posteriores |
| 6. Cerrar | Reabrir operaciones, monitorizar 401/403, P2039, FK, error rate, colas y auditoría; registrar SHAs/variables/journal/evidencias y responsables | Si surge incidencia, mantener DB texto y cortar habilitación primero; restaurar enum solo con migración compensatoria y preflight sin referencias propias |

El build debe aplicar la migración **después de compilar correctamente** y
antes de iniciar el nuevo runtime. Aun así el proceso anterior debe estar
drenado: Render puede mantenerlo atendiendo mientras construye. Cambiar solo
Git o hacer rollback de deploy no revierte automáticamente el esquema.
Un fallo tras COMMIT requiere avanzar con un artefacto texto sano o ejecutar
una compensación explícita, nunca editar/eliminar una fila aplicada de Prisma.

### Reversa física

Con tráfico/escritores drenados y flag false: comprobar que users.role,
role_module_permissions.role y role_action_permissions.role contienen solo
los cinco códigos de sistema; exportar/auditar cualquier referencia propia
antes de decidir una reasignación o eliminación. No hacerla silenciosamente.
Recrear el tipo Role de cinco valores, retirar las tres FK nuevas, retirar el
default de users.role, convertir con `USING role::public."Role"`, reponer el
default enum y confirmar la transacción. Las tablas de expansión, nombres,
menús, permisos de menú e historial se conservan. CompanyRole propios sin
referencias en esas tres columnas no obligan a borrar el catálogo ni auditoría.

Antes de roles propios la reversa es mecánica y fue ensayada. Después de
habilitar puede estar bloqueada y requerir una decisión de datos. Se entrega
como **nueva migración compensatoria**, no como edición del SQL ya aplicado;
un nuevo intento de corte usaría otra migración posterior. Backup completo
solo es opción tras revisar RPO y operaciones desde su punto de restauración;
no descartar documentos fiscales, cobros ni asientos para revertir roles.

## 5. Plan de equivalencia y certificación posterior

### Antes/después, automatizado al construir

1. Mismo fixture y snapshot efectivo por empresa/usuario antes y después:
   IDs, email, hash, actividad y rol; filas de módulos/acciones/menús y nombres;
   diffs vacíos salvo el menú adicional explícitamente aprobado. Probar tanto
   expansión de 72 como 73, instalación nueva, forma parcial/incompatible,
   huérfanos, locks, interrupción y reintento del journal.
2. ADMIN, CONTADOR, OPERADOR_FACTURACION, OPERADOR_ADUANAS y AUDITOR:
   defaults y overrides true/false, incluida denegación persistida ADMIN y su
   excepción de escritura por módulo. Reejecutar la matriz independiente de
   21 puntos × 5 roles × 16 overrides × 4 matrices M1 = **6720** decisiones.
   Conservar tres *_ACCESS y operaciones reservadas; ningún privilegio por name.
3. Comparar las 73 decisiones de menú actuales y sus padres; conservar las 72
   históricas/overrides. Probar sidebar, rutas directas, paleta y atajos juntos;
   resolver los dos filtros ADMIN antes de afirmar equivalencia completa.
4. Login/JWT/refresh con cinco roles, alias front, sesiones existentes,
   cambio de asignación con token anterior, usuario/empresa inactivos,
   pertenencia cruzada, renombre sin logout y caché por identidad.
5. Flag false antes/después del DDL; flag true con enum o FK ausente/no validada/
   incorrecta sigue denegado. Cliente texto real contra PostgreSQL convertido:
   crear rol sin permisos, asignar por ADMIN, grants explícitos de módulo/menú/
   acción y denegaciones; nombre Administrador no concede acceso.
6. Dos cambios ADMIN concurrentes, autobloqueo, cambios de nombre/code ADMIN,
   auditoría actor/empresa/antes/después y rollback conjunto. Sin falsos verdes
   por saltar las integraciones ROLES_TEST_DATABASE_URL.
7. Suite completa back y front, builds y checksums de ambas nuevas migraciones;
   regenerar cliente texto en todos los artefactos. Actualizar la prueba que
   ahora certifica que el activo todavía es enum, sin perder su intención.

### Certificaciones en vivo, solo después de la aprobación y despliegue

| Certificación | Resultado esperado / protección |
| --- | --- |
| Login por los cinco roles | Mismos accesos que el snapshot previo, sin conceder por nombre; tokens anteriores mantienen formato y usan membresía DB vigente |
| GET `/auth/permissions/me` y `/auth/roles/config` | Role.code/name correctos, módulos/acciones/menús equivalentes, homePath permitido; false durante corte y true solo tras habilitación completa |
| Crear rol propio con ADMIN canario | Code nuevo inmutable, name renombrable, isSystem=false; inicialmente sin accesos; no permitir ADMIN/ACCOUNTANT/OPERATOR reservados |
| Asignarlo a usuario de prueba | Empresa correcta y auditada; nunca cambiar el rol del propio actor; preparar acceso a almacén cuando el flujo lo requiera |
| Conceder módulos/menús/acción | Snapshot y UI coherentes, no herencia por nombre, ningún acceso a configuración/seguridad reservada; certificar efectos peligrosos por snapshot/pruebas locales, no emitir o anular documentos reales |
| Cambio con token anterior y refresh | Request siguiente usa el rol actual; refresh firma DB y rota; no retiene privilegios previos |
| Renombrar sin logout | Cambia etiqueta vía snapshot/recarga, mismo code y derechos; sin cierre de sesión |
| Anti-bloqueo | Autobloqueo rechazado sin cambios. Caso estricto de último ADMIN: empresa canaria autorizada, dos ADMIN de prueba y dos intentos concurrentes sobre el otro; solo uno puede prosperar y queda al menos uno activo; el superviviente restaura las cuentas. No despromover ADMIN reales de la empresa de negocio |
| Separación y auditoría | Rol ajeno, no ADMIN y grants reservados producen denegación; actor/empresa/code/antes/después en auditoría, sin datos de contraseña |

Si no existe una empresa canaria autorizada, no simular el último ADMIN sobre
cuentas reales: mantener esa prueba en PostgreSQL local y dejar la certificación
viva correspondiente pendiente. Las cuentas/roles de prueba sin endpoint de
borrado se conservan sin asignación o inactivos según el plan autorizado; no
inventar DELETE ni borrar auditoría para limpiar la certificación.

## 6. Riesgos, checklist y duración

| Riesgo | Mitigación / criterio de no-go |
| --- | --- |
| Expansión existente sin historial Prisma | Migración de adopción con validación de forma y datos; probar 0/3 tablas y presencia parcial; no CREATE ciego |
| 72/360 en DB frente a 73/365 en código | Añadir solo guía y cinco permisos por empresa, sin sobrescribir lo previo; si hay más diferencias, detener |
| Diff automático destructivo o cambios ajenos | SQL enum→text explícito y revisión de allowlist de tablas; no aplicar el diff global |
| Clientes enum durante build o después de habilitar | Mantenimiento/drenaje de web, workers, cron y herramientas; cliente texto verificado antes de abrir tráfico |
| Defaults/nombres/overrides alterados | Huellas y snapshots antes/después, sin UPDATE masivo; datos de ADMIN denegados no se corrigen a true automáticamente |
| FK compuesta equivocada o sin validar | Verificar atributos y acciones exactas; endurecer compuerta; abortar habilitación si falta el contrato |
| Dos listas locales ADMIN del front | Resolver política y certificar sidebar/paleta/ruta directa antes de activar |
| Flag global, rollout mixto y caché | Esperar todos los procesos; recargar catálogos/config del front; cuentas canarias antes de asignaciones generales |
| Bloqueo, reescritura o build fallido | lock_timeout/statement_timeout, tamaños y sesiones antes de ventana, compilación antes de DDL, rollback/roll-forward preparados |
| Reversa con roles propios o nuevos negocios | Exportación/autorización de reasignaciones; compensación de roles, no restauración ciega de toda la base |

Checklist previo a la ventana:

- [ ] Responsable de ejecución, observación y reversa, contacto de aprobación,
      ventana y comunicación de mantenimiento confirmados.
- [ ] SHAs back/front fijados; si main o las migraciones cambian, actualizar
      ensayo/preflight; 80/80 y checksums verificados en el destino real.
- [ ] Orden exacto del build Render y todos sus procesos/escritores inventariados;
      no asumir que el deploy detuvo al proceso viejo.
- [ ] Backup/PITR y restauración comprobables; snapshots/huellas de usuarios y
      permisos guardados de forma segura, sin publicar hashes de contraseñas.
- [ ] Tipos, defaults, dependencias del enum/array, PK/FK/índices, tamaños,
      cardinalidades, huérfanos y ADMIN activo revisados; drift ajeno inventariado.
- [ ] Adopción 72→73 aprobada, filtros del front resueltos y pruebas de cliente
      texto/HTTP/equivalencia completas en verde.
- [ ] ROLES_CUSTOM_ENABLED=false en todos los procesos; catálogo canario,
      cuentas por rol, almacenes y ADMIN de rescate preparados.
- [ ] Migraciones nuevas y compensación revisadas con checksums; procedimiento
      para fallo transaccional y journal fallido acordado, sin saltar errores.
- [ ] Matriz de certificación y criterios de abortar/cerrar firmados; observar
      errores 401/403, 42704/P2039, FK, locks, colas y auditoría.

Estimación de planificación, no medida de producción: preparación y backups
fuera de ventana; **45–60 min para corte y equivalencia**, **30–45 min para
habilitación/certificación** en una segunda etapa, con **20–30 min de reserva
para reversa**. El mantenimiento de cada etapa incluye drenaje (5–10 min),
build/inicio de Render (estimación 10–20 min) y verificaciones. Los 32,18 ms
locales solo describen cinco usuarios: no permiten prometer el tiempo de lock
real. Ajustar la ventana tras preflight de volumen y ensayo del artefacto final.

## Decisión pendiente

Este informe permite decidir el procede para construir las partes 5–6, con
los ajustes y condiciones anteriores. **No autoriza ejecutar el corte ni
habilitar ROLES_CUSTOM_ENABLED en esta fase.** Se detiene aquí y se espera
el procede; no se ha cambiado código, esquema, pruebas ni migraciones del repo.
