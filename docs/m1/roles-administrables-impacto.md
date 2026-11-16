# Roles administrables — fase 0 de impacto

## Alcance, bases y resultado

Informe estático del 16 de noviembre de 2026. **No se construye el mantenedor en este encargo.** Solo cambia este documento; no se modifican código, esquema, migraciones ni pruebas. No se consulta ni modifica una base compartida; el SQL de abajo es una propuesta para una entrega futura, no un script aplicado. Sin PRs ni merges.

- Back: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`, `dev` **`d28ffc80591e3418b230b0163468d26aab22f298`**, merge del paquete 1. Rama documental `docs/roles-administrables-impacto` desde ese SHA.
- Front: `CarlosSoles/Fronted-sistema-mype-sunat`, `main` **`dcf7864b3bc5e705ffea08ae3884e9bc0523c328`**, merge del paquete 2. Inspección de archivos versionados en checkout aislado, sin cambios.
- No se ejecutan suites: no hay implementación que verificar. Los conteos de pruebas de este informe son **referencias estáticas**, no resultados de ejecución ni estimaciones de casos expandidos.

**Resultado:** el cambio alcanza persistencia, dominio/DTO, autorización HTTP, JWT/sesión, defaults, navegación, editores y pruebas. Un CRUD de roles y convertir el enum a texto no bastan: un código nuevo seguiría bloqueado por `RolesGuard`, las listas de rutas y las capacidades locales. Los cuatro permisos de acción actuales tampoco representan todas las operaciones restringidas por rol. La construcción requiere una transición coordinada de autorización y datos.

## Método y unidades del inventario

Se enumeraron los archivos con `git ls-files` de cada SHA y se inspeccionaron con búsqueda y AST TypeScript. Se excluyen documentos, dependencias, compilados, cliente Prisma generado y el espejo `frontend/` del back; la fuente del front es su propio repositorio. Los roles de terceros (`CLIENTE`, `PROVEEDOR`, `TRANSPORTISTA`, etc.) son otro dominio y no pertenecen al enum de usuarios.

Las tablas del anexo distinguen:

- **Tokens:** apariciones de palabras completas `ADMIN|CONTADOR|OPERADOR_FACTURACION|OPERADOR_ADUANAS|AUDITOR|ACCOUNTANT|OPERATOR`, incluidas claves de objetos, comentarios y títulos. **Líneas:** líneas que contienen al menos una de ellas.
- **Literales:** nodos string/template sin interpolación cuyo valor completo es uno de esos códigos; excluye comentarios, títulos más largos y claves sin comillas.
- **Comparaciones:** expresiones AST `===`, `!==`, `==`, `!=` con uno de esos literales a un lado. Las listas `.includes`, `switch`, asignaciones y decoradores se inventarían aparte, no se cuentan como comparaciones.
- **Pruebas con literal:** declaraciones estáticas `it/test/fit/xit/xtest` con callback que contienen un literal de rol en sus argumentos/cuerpo. Una declaración parametrizada cuenta una vez; no se expande `.each`. No se atribuye a cada caso el rol de un `beforeEach` o fixture exterior. Por eso se incluyen también archivos/ocurrencias y no se presenta este número como todas las pruebas afectadas.

Resumen reproducible: búsqueda de palabras completas sobre archivos versionados y recorrido de `StringLiteral`, `NoSubstitutionTemplateLiteral`, `BinaryExpression` y llamadas `Roles(...)` con TypeScript. Las referencias sin literal se listan además por su flujo de datos o importación.

## 1. Back: persistencia y autorización

### Enum y contratos

En `prisma/schema/auth.prisma` hay **un enum Role de cinco valores y exactamente tres campos que lo usan**:

| Modelo/campo | Tabla/columna | Restricción actual |
| --- | --- | --- |
| `User.role` (línea 109) | `users.role` | No nulo; default `OPERADOR_FACTURACION` |
| `RoleModulePermission.role` (127) | `role_module_permissions.role` | Única empresa+rol+módulo; índice empresa+rol |
| `RoleActionPermission.role` (142) | `role_action_permissions.role` | Única empresa+rol+acción; índice empresa+rol |

No hay otros campos `Role` en los `.prisma`. Las tres tablas ya tienen `company_id` y relación con `Company`. `User.email` es único global; no cambia con este diseño. El cliente generado deriva de ese enum: deberá regenerarse, no editarse manualmente.

Copias/validaciones del catálogo: `domain/entities/userEntity.ts` define `UserRole` como unión de cinco strings; `application/services/modulePermissionsService.ts` exporta `ROLES`; `application/dto/updateUserDto.ts` repite `ROLES_USUARIO` y `@IsIn`; `createUserDto.ts` importa `ROLES` para `@IsIn` y el tipo del alta. Los DTO de respuesta usan strings. `userMapper.ts`, `prismaUserRepositoryAdapter.ts` y `createUserService.ts` transportan/persisten el rol; deben mantener el contrato exterior `role: code`. El registro y tres rutas de creación/actualización del repositorio establecen ADMIN explícitamente.

DDL histórico que depende del enum (no se reescribe):

- `prisma/migrations/20261016144319_ta19_modelo_datos_integral/migration.sql`: crea `"Role"` y `users.role`.
- `prisma/migrations/20261114140000_role_module_permissions/migration.sql`: columna `role "Role"`.
- `prisma/migrations/20261116110000_role_action_permissions/migration.sql` y `scripts/manual/role-action-permissions.sql`: columna `role "Role"`.
- `prisma/migrations/20261113120000_user_warehouses/migration.sql`: compara `u.role::text <> 'ADMIN'` al asignar almacén inicial.

### JWT: qué lleva y quién lo consume

`domain/ports/tokenServicePort.ts::TokenPayload` lleva **`sub`, `email`, `companyId`, `role: string`**. Login, registro y refresh (`application/use-cases/{loginUseCase,registerUseCase,refreshTokenUseCase}.ts`) firman `role: user.role`; login/registro también lo devuelven en el usuario. `infrastructure/security/nativeJwtAdapter.ts` firma HS256, agrega `exp` (default 900 segundos) y al verificar firma/exp devuelve un cast de payload: no valida el catálogo ni recarga el rol del usuario desde DB. `AuthGuard` asigna el payload a `request.user`; `currentUserDecorator.ts` lo entrega al controlador.

Consumidores efectivos del rol autenticado:

- `RolesGuard`: lee metadata de método/clase con `getAllAndOverride`, hace `requiredRoles.includes(user.role)` y responde 403 si no coincide. **No hay bypass general de ADMIN** en este guard; si no hay metadata no restringe. `rolesDecorator.ts` tipa sus argumentos con `UserRole`.
- `ModuleWriteInterceptor` global + `ModulePermissionsService`: permisos por empresa/rol. ADMIN evita escritura en ambos; GET/HEAD sí consultan `can_view`, también para ADMIN. Mapa actual de 12 prefijos: inventory/purchases→M8, inventory→M6, purchases/purchase-orders→M8, invoices→M1, customs→M2, sire→M3, accounting/treasury/expenses→M4, sales→M7, warehouses→M6, todos bajo `/api/v1`. Excluye auth/master-data/health y lo no mapeado (p. ej. resilience, dashboards, UX); no equivale a autorización universal de todos los endpoints.
- `ActionPermissionsGuard`: consulta acciones por `companyId` y `role`; para emisión pide la acción de fecha solo si difiere del día fiscal de Lima. `ActionPermissionsService` rechaza un rol no incluido en `ROLES` antes de consultar permisos efectivos.
- `authController.ts`: ocho comparaciones ADMIN para administrar módulos, acciones, usuarios y almacenes; `/me` delega al servicio por rol.
- `warehouseAccessService.ts`: acceso global de ADMIN a almacenes, protección del último ADMIN activo y del propio usuario; la consulta de administradores usa `role: 'ADMIN'`.
- `invoiceForcedResendService.ts`: exige actor ADMIN con `sub`, incluso si se cambiara el guard del controlador. `invoiceDownloadController.ts`: para AUDITOR descarga XML sin la generación/reparación habilitada para los otros roles (argumento final `false`). Ambos requieren revisión explícita, no sustitución textual.

Otros transportes de `TokenPayload` sin decisión por literal: controladores de inventario, compras, ventas y SIRE usan empresa o `sub`; no deben convertirse en permisos por el solo hecho de importar el tipo. `inventoryCatalogsService.ts` también devuelve `u.role` en personas: el consumidor deberá aceptar códigos nuevos. El inventario de literales por archivo y de los 19 `@Roles` está en el anexo A.

### Defaults actuales y semillas

`PERMISOS_POR_ROL` en `modulePermissionsService.ts` tiene 10 módulos:

| Rol | Ver por defecto | Escribir por defecto |
| --- | --- | --- |
| ADMIN | M1–M10 | M1–M10; bypass de escritura |
| CONTADOR | Todos salvo M9 | Todos salvo M9 |
| OPERADOR_FACTURACION | M1, M6, M7, M10 | M1, M7 |
| OPERADOR_ADUANAS | M2, M6, M8 | M2, M6, M8 |
| AUDITOR | M1–M10 | Ninguno |

Las filas persistidas sustituyen defaults; escritura ADMIN tiene la excepción anterior. Un rol desconocido tiene defaults de módulos denegados, pero `list()` solo enumera los cinco de `ROLES`; el PUT también los valida contra esa lista.

`actionPermissionsService.ts::ACTIONS`: `INVOICE_EDIT_ISSUE_DATE`, `INVOICE_FORCE_RESEND`, `INVOICE_REPROCESS_BRIDGE` solo ADMIN por defecto; `INVOICE_RESOLVE_DLQ` ADMIN y OPERADOR_FACTURACION. Una fila persistida denegada manda incluso para ADMIN. `list/replace/forRole` dependen del catálogo fijo.

`prisma/seeds/auth.seed.ts` contiene cinco usuarios demo, uno por rol; debe crear los cinco roles de la empresa **antes** de los usuarios. El registro de una empresa también deberá inicializar sus roles y permisos de sistema dentro de su transacción. No se ejecutó el seed ni se incluyeron credenciales en este informe. No se encontraron otros códigos de estos roles en `scripts/` o `fixtures/` versionados; los fixtures del paquete de permisos están bajo `test/` (anexo C). `authPermissionsHttpHarness.ts` fija ADMIN. `rolesDatabase.ts` crea la conexión efímera de pruebas, pero no contiene un literal de rol. No se infiere de estos archivos el contenido de la base compartida.

## 2. Front: tipos, navegación y editores

`src/modules/auth/types/auth.types.ts::Role` contiene los cinco códigos y **dos alias legacy**: ACCOUNTANT y OPERATOR. Se usa en `AuthUser`, perfiles y el store persistido `src/stores/authStore.ts::UserSession`. No es un enum runtime. Los alias solo existen en el front: no son valores Prisma ni roles del back. La compatibilidad actual no es uniforme: `useRolePermissions` reconoce ambos, mientras `useAuth.isBillingOperator` no reconoce OPERATOR. La migración debe normalizar en un borde de sesión (`ACCOUNTANT→CONTADOR`, `OPERATOR→OPERADOR_FACTURACION`), no crear esos dos roles en DB ni reescribir tokens históricos sin política.

Dependencias de navegación:

- `Sidebar.tsx`: **22 listas de valores `allowedRoles`** (excluidos tipos); subítems heredan la lista del padre si no tienen otra. Filtra además por módulos de `/me`; ADMIN tiene bypass. Un conjunto de módulos visibles vacío hoy permite mostrar entradas según roles. No hay catálogo ni permisos persistidos de menú.
- `appRoutes.tsx`: **72 atributos JSX `allowedRoles`**. `RoleProtectedRoute` cruza la lista fija con `canView` según prefijo; ADMIN omite ambos filtros. Con lista API vacía no aplica la denegación de módulo. Un rol nuevo no entra por tener módulo permitido. La query global `['module-permissions-me']` carece del scope de usuario/empresa usado por los hooks nuevos de M1.
- `roleNavigation.ts`: switch de códigos (Aduanas→customs, Contador/ACCOUNTANT→accounting, demás/default→invoices); lo consumen rutas, guard y login. Un rol sin M1 podría ser enviado a una pantalla prohibida.
- `CommandPalette.tsx` reutiliza `NAV_ITEMS` y sus listas. `KeyboardShortcuts.tsx` define diez listas `roles` (una vacía para ayuda) y un bypass ADMIN. También deben usar el mismo catálogo/visibilidad que sidebar y rutas.
- Etiquetas: `UserNavDropdown.tsx`, `ProfilePage.tsx`, `DemoCredentialsBox.tsx`, `demoSession.ts` tienen códigos/nombres/estilos; un nombre renombrado debe venir del catálogo o perfil, con código como respaldo. `CustomsAccountingPage.tsx` e `InvoiceAuditTrail.tsx` solo contienen menciones textuales de AUDITOR, no comparaciones de autorización.

Editores: `RolePermissionsPage.tsx` recorre `ROLES_PERMISOS` tanto en módulos como en acciones; casillas ADMIN bloqueadas, sus acciones se excluyen del PUT. `modulePermissionsApi.ts` fija la lista de cinco. `UserWarehousesPage.tsx` tiene un select de alta basado en esa lista y otro de edición con cinco `<option>` escritos a mano; `warehousesApi.ts::CreateUserInput.role` vuelve a ser una unión de cinco. Deben listar `GET /auth/roles` de la empresa, mostrar `name`, enviar `code`, manejar carga/error/vacío y conservar la protección ADMIN en servidor y UI. La elección de usuarios no debe depender de los roles presentes en la matriz: un rol recién creado sin permisos también debe aparecer.

`useRolePermissions.ts` conserva siete comparaciones de rol y capacidades locales. Lo consumen seis componentes/páginas: `AccountingEntriesPage`, `DuaDashboardView`, `LandedCostSheetPage`, `PartnersPage`, `ShipmentDetailPage`, `ShipmentsListPage`. Los flujos de solo lectura de LandedCostSheetPage, ShipmentDetailPage y ShipmentsListPage basados en AUDITOR permitirían tratar erróneamente un rol nuevo como escritor si solo se amplía el tipo.

M1 ya usa `/me` de módulos y acciones, pero `useInvoiceWritePermission.ts` aún exige la lista ADMIN/OPERADOR_FACTURACION por los `@Roles` existentes del back. `InvoiceBatchRetry`, `InvoiceBridgeReprocess`, `InvoiceForcedResend` y `InvoiceMonitorPage` consumen `useAuth.isAdmin`; `InvoiceSeriesForm` compara ADMIN directamente. `useAuth.ts` también alimenta `InventoryAdjustmentsPage` y `InventoryTransfersPage`. Estos consumidores indirectos no contienen necesariamente literales y se suman a los 21 archivos del anexo B. `useActionPermissions` y los tipos de filas de permisos ya usan strings para `role`, pero sus catálogos/consumidores requieren el cambio coordinado. No se propone que una mera asignación de menú conceda escritura.

## 3. Diseño propuesto (para decidir, no implementado)

### Modelo y compatibilidad

1. `company_roles(company_id, code, name, is_system)`; PK/única **(company_id, code)**, FK de empresa. Código ASCII mayúsculo estable, 1–64 caracteres, patrón `^[A-Z][A-Z0-9_]*$`; nombre visible no vacío. Renombrar significa cambiar **name**, no code. Sin jerarquía ni múltiples roles por usuario en esta primera propuesta.
2. **Elegir texto con FK compuesta, no texto validado solo por aplicación.** Los tres campos guardan el code, y `(company_id, role)` referencia `(company_id, code)` con `ON DELETE RESTRICT / ON UPDATE RESTRICT`. Impide asignar un rol de otra empresa y huérfanos desde SQL/otros clientes. Las únicas de permisos siguen siendo empresa+rol+módulo/acción. `role_code` es el concepto lógico; se propone conservar el nombre físico y el contrato `role` para evitar un renombrado de columna/API adicional. Prisma pasaría de enum a `String` con relación compuesta. Si se exige llamarlo `role_code`, usar inicialmente `@map("role")`; un renombrado físico sería otra migración.
3. Crear los cinco roles **en cada empresa**, `is_system=true`; no se borran ni se cambia su code/is_system. Se permite renombrar el nombre visible de los otros cuatro. ADMIN conserva code y nombre protegido, gestión de seguridad reservada y al menos un usuario activo por empresa. El servidor debe bloquear el autobloqueo y proteger también las mutaciones de permisos; la UI sola no basta. La futura política ADMIN debe documentar la diferencia actual: módulos/escritura tienen bypass, acciones persistidas no. Propuesta: reservar capacidades de administración/recuperación no delegables y evitar nuevas denegaciones ADMIN desde los endpoints de gestión, sin convertir silenciosamente denegaciones históricas de acciones en concesiones. Preflight separará esas anomalías para decisión explícita.
4. Roles propios: `is_system=false`, sin permisos por defecto. Crear no clona ADMIN ni hereda por parecido de nombre; copia de otro rol, si se ofrece después, debe ser explícita y auditada. Borrado de roles propios no forma parte de la observación; si se incorpora, solo sin referencias y sujeto a FK. No se eliminan usuarios/permisos por cascada al borrar un rol.
5. Catálogos de módulos y acciones siguen siendo técnicos. GET de roles por empresa y POST/PATCH de alta/nombre, solo ADMIN para mutaciones; lista de roles para los editores de seguridad. `/auth/*-permissions[/me]` conserva DTOs `role: code`, pero valida contra roles de la empresa y enumera todos. Los roles de sistema mantienen defaults actuales durante transición; propios denegados en módulos/acciones/menús sin fila. Inicialización de nuevas empresas y seed coordinados. Auditoría: actor, empresa, code, antes/después; no incluye secretos.
6. Menús: catálogo técnico estable `menu_code`, módulo, ruta y jerarquía (no rutas arbitrarias creadas por el ADMIN); tabla propuesta `role_menu_permissions(company_id, role_code, menu_code, can_view)` con FK compuesta al rol y FK al catálogo. El acceso de UI requiere módulo visible **y** menú permitido (herencia explícita y acíclica); acciones/escritura se comprueban aparte en el servidor. Menús nuevos denegados para roles propios hasta asignación. Reconciliar catálogos back/front por versión. El catálogo inicial debe enumerar los 72 usos de rutas y los submenús: no asumir que los 22 arrays son 22 pantallas. Guardar un menú no crea autorización HTTP.
7. Sustituir las restricciones de rol funcionales de los 19 decoradores y los dos casos especiales por capacidades equivalentes, **antes** de habilitar roles propios. Las cuatro acciones actuales no alcanzan para emisión ordinaria, envío/consulta, configuración, reintento masivo, regularización y XML sin efectos; hay que definir ese catálogo adicional y su matriz inicial por endpoint. Las operaciones de administración de seguridad permanecen reservadas a ADMIN. La migración de políticas debe demostrar equivalencia para los cinco roles existentes y permitir delegar las operaciones de negocio al rol propio mediante permisos, sin usar un “rol base” que herede privilegios ocultos.
8. JWT conserva `role` como **code textual**, `companyId` y `sub`; cambiar name no exige renovar token. No introducir nombre visible como autoridad. Resolver usuario activo, empresa y pertenencia al rol al autenticar/autorización para que un cambio de asignación no deje privilegios viejos durante los 900 segundos actuales; cachear solo con invalidación/versionado claro. Un código desconocido o ajeno a la empresa se deniega. Refresh firma desde DB. El front limpia/invalida cachés por usuario/empresa y actualización de permisos; no decide por el nombre.

### Ruta manual de datos y SQL de referencia

La cola oficial Prisma sigue bloqueada por drift según el contexto del encargo. No se ejecutará `migrate deploy`, `migrate reset`, `db push` ni se marcarán migraciones históricas como aplicadas para sortearlo. El SQL futuro vivirá en `scripts/manual/` con checksums e instrucciones, junto a un esquema Prisma coherente; la reconciliación de la cola será una tarea separada. Los siguientes fragmentos son **diseño**, no SQL validado contra la base compartida ni archivos de migración entregados.

**Preflight obligatorio, en el destino autorizado:** backup recuperable de esquema/datos y prueba de restauración; identificar schema y versión real; inventariar `pg_depend`, vistas, funciones, triggers, defaults, índices, FKs y RLS que dependan de `"Role"`/las tres columnas. Si hay consumidores no previstos, abortar y ampliar el plan. Confirmar que las tablas de módulos/acciones del paquete 1 ya existen realmente; un merge no demuestra que se aplicó su SQL. Medir tamaños/tiempo de rewrite y presupuesto de locks en una copia, verificar duplicados/huérfanos y ADMIN activo. Guardar conteos por tabla, empresa y rol, y exportar las filas de permisos para comparar antes/después. No inferir nada de datos productivos a partir de seeds.

```sql
-- Consultas de preflight; public es una hipótesis a confirmar.
SELECT n.nspname, t.typname, e.enumlabel, e.enumsortorder
FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
JOIN pg_enum e ON e.enumtypid=t.oid
WHERE t.typname='Role' ORDER BY n.nspname,e.enumsortorder;
SELECT n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod)
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE a.atttypid='public."Role"'::regtype AND a.attnum>0 AND NOT a.attisdropped;
SELECT 'users' AS tabla,company_id,role::text,count(*) FROM public.users GROUP BY 2,3
UNION ALL SELECT 'modules',company_id,role::text,count(*) FROM public.role_module_permissions GROUP BY 2,3
UNION ALL SELECT 'actions',company_id,role::text,count(*) FROM public.role_action_permissions GROUP BY 2,3;
SELECT company_id,role,module_code,count(*) FROM public.role_module_permissions
GROUP BY 1,2,3 HAVING count(*)>1;
SELECT company_id,role,action_code,count(*) FROM public.role_action_permissions
GROUP BY 1,2,3 HAVING count(*)>1;
SELECT c.id FROM public.companies c WHERE c.is_active
AND EXISTS (SELECT 1 FROM public.users u WHERE u.company_id=c.id AND u.is_active)
AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.company_id=c.id AND u.is_active AND u.role::text='ADMIN');
SELECT company_id,action_code,allowed FROM public.role_action_permissions
WHERE role::text='ADMIN' AND NOT allowed;
-- Todos los company_id deben existir en companies; revisar además pg_depend
-- del tipo y de cada columna (no solo las tres tablas esperadas).
```

Orden recomendado: expansión del catálogo → back compatible con feature flag apagado → front preparado → ventana breve para conversión y cliente Prisma texto → habilitación. No permitir roles propios mientras quede un proceso con cliente Prisma enum. Para evitar doble escritura/triggers en las tres tablas, se propone **ventana controlada**, no una promesa de migración sin interrupción. El catálogo aditivo puede crearse antes; la conversión siguiente se hace con todos los escritores/lectores afectados drenados y el artefacto nuevo listo.

```sql
-- Propuesta del bloque de conversión; futura ejecución con ON_ERROR_STOP.
-- Backup/preflight y revisión de dependencias completados. App y workers drenados.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s'; -- ajustar a la medición real; no insistir sin revisar
LOCK TABLE public.companies, public.users, public.role_module_permissions,
  public.role_action_permissions IN ACCESS EXCLUSIVE MODE;
-- El futuro script debe abortar si los tipos, defaults, constraints o versión
-- del catálogo no coinciden con el preflight aprobado; sin IF NOT EXISTS ciego.
CREATE TABLE public.company_roles (
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (length(code) BETWEEN 1 AND 64 AND code ~ '^[A-Z][A-Z0-9_]*$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  is_system boolean NOT NULL DEFAULT false,
  PRIMARY KEY(company_id,code)
);
INSERT INTO public.company_roles(company_id,code,name,is_system)
SELECT c.id,r.code,r.name,true FROM public.companies c CROSS JOIN (VALUES
 ('ADMIN','Administrador'),('CONTADOR','Contador'),
 ('OPERADOR_FACTURACION','Operador de facturación'),
 ('OPERADOR_ADUANAS','Operador de aduanas'),('AUDITOR','Auditor')
) AS r(code,name);
ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'OPERADOR_FACTURACION';
ALTER TABLE public.role_module_permissions ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.role_action_permissions ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.users ADD CONSTRAINT users_company_role_fk
 FOREIGN KEY(company_id,role) REFERENCES public.company_roles(company_id,code) ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.role_module_permissions ADD CONSTRAINT modules_company_role_fk
 FOREIGN KEY(company_id,role) REFERENCES public.company_roles(company_id,code) ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.role_action_permissions ADD CONSTRAINT actions_company_role_fk
 FOREIGN KEY(company_id,role) REFERENCES public.company_roles(company_id,code) ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT users_company_role_fk;
ALTER TABLE public.role_module_permissions VALIDATE CONSTRAINT modules_company_role_fk;
ALTER TABLE public.role_action_permissions VALIDATE CONSTRAINT actions_company_role_fk;
-- ASSERT futuros: conteos/agrupaciones idénticos, cinco roles por empresa,
-- cero huérfanos, mismas únicas/índices/permisos. Ante diferencia: ROLLBACK.
-- Conservar public."Role" sin usos en esta entrega facilita una reversa limitada.
COMMIT;
```

Si el catálogo se expandió antes, este bloque se separa en dos scripts versionados: el de conversión **no lo vuelve a crear** y verifica su versión/filas. En ambos escenarios se vuelve a sembrar cualquier empresa creada entre expansión y corte con transacción y comparación, no sobrescribiendo nombres/permisos. El plan del catálogo de menús tendrá SQL aditivo separado, preflight de rutas/IDs, FKs y backfill exacto de visibilidad vigente; no debe formar parte de un cast del enum. Los defaults de módulos/acciones se conservan sin recalcular ni borrar overrides; materializarlos, si se elige, requiere comparar los 50 módulos y 20 acciones efectivos por empresa antes/después.

**Reversa:** antes del commit del corte basta rollback transaccional y volver al artefacto previo. Después del commit, drenar de nuevo y prohibir nuevas asignaciones; no desplegar cliente enum contra datos de roles propios. Antes de cualquier cast inverso, comprobar las tres tablas y cualquier tabla nueva de menús contra los cinco códigos; si hay usuarios o permisos con code propio, **abortar reversa automática**. Exportar y acordar reasignación de usuarios y conservación/restauración de permisos, o restaurar backup con tratamiento explícito de escrituras posteriores. No eliminar filas ni transformar un rol propio en OPERADOR_FACTURACION silenciosamente.

```sql
-- Precondición para una reversa limitada (sin roles propios referenciados).
SELECT DISTINCT role FROM (
 SELECT role FROM public.users UNION ALL SELECT role FROM public.role_module_permissions
 UNION ALL SELECT role FROM public.role_action_permissions
) x WHERE role NOT IN ('ADMIN','CONTADOR','OPERADOR_FACTURACION','OPERADOR_ADUANAS','AUDITOR');
-- Debe devolver cero filas; el script futuro lo hará abortar con RAISE EXCEPTION.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.users,public.role_module_permissions,public.role_action_permissions IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.users DROP CONSTRAINT users_company_role_fk;
ALTER TABLE public.role_module_permissions DROP CONSTRAINT modules_company_role_fk;
ALTER TABLE public.role_action_permissions DROP CONSTRAINT actions_company_role_fk;
ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN role TYPE public."Role" USING role::public."Role";
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'OPERADOR_FACTURACION'::public."Role";
ALTER TABLE public.role_module_permissions ALTER COLUMN role TYPE public."Role" USING role::public."Role";
ALTER TABLE public.role_action_permissions ALTER COLUMN role TYPE public."Role" USING role::public."Role";
-- ASSERT conteos, constraints y valores originales, o ROLLBACK.
COMMIT;
-- Conservar catálogo y menú para recuperación/auditoría. No DROP ... CASCADE.
```

DDL aditivo de referencia para menús, después de aprobar el catálogo técnico y de crear `company_roles` (no se ejecuta en esta fase):

```sql
CREATE TABLE public.permission_menu_catalog (
 menu_code text PRIMARY KEY,
 module_code text NOT NULL CHECK (module_code IN ('M1','M2','M3','M4','M5','M6','M7','M8','M9','M10')),
 path_pattern text NOT NULL,
 parent_menu_code text REFERENCES public.permission_menu_catalog(menu_code) ON DELETE RESTRICT
);
CREATE TABLE public.role_menu_permissions (
 company_id text NOT NULL,
 role_code text NOT NULL,
 menu_code text NOT NULL REFERENCES public.permission_menu_catalog(menu_code) ON DELETE RESTRICT,
 can_view boolean NOT NULL DEFAULT false,
 PRIMARY KEY(company_id,role_code,menu_code),
 FOREIGN KEY(company_id,role_code) REFERENCES public.company_roles(company_id,code) ON DELETE RESTRICT ON UPDATE RESTRICT
);
```

El backfill de menús se elaborará desde el inventario de rutas/sidebar, con prueba de equivalencia y control de ciclos; no se concede todo por defecto. Preflight: catálogo con versión/hash y ninguna referencia a códigos/rutas desconocidos; comprobar el cruce con visibilidad de módulos, incluidos padres y subítems. La reversa conserva estas tablas y exporta sus filas: si hay permisos de roles propios se detiene la retirada del catálogo. No borrar tablas con CASCADE para facilitar un rollback del binario. El catálogo no necesita FK al enum antiguo y puede mantenerse durante la reversa limitada.

La consulta inicial se repetirá dentro de la transacción con escritores drenados; las columnas NOT NULL y casts también abortan ante incompatibilidad. Se conserva el tipo enum para esa reversa; su retirada definitiva sería un contrato posterior, con backup y dependencias verificados. Revertir también el contrato del catálogo/menu o retirar datos nuevos necesita otro plan aprobado; no se promete que el rollback del binario revierta cambios de datos.

## 4. Plan de construcción y pruebas futuras

| Parte / orden | Trabajo futuro | Condición para avanzar |
| --- | --- | --- |
| 1. Contratos y seguridad (back) | Catálogo roles/menús, matriz endpoint→capacidad para los 19 `@Roles` y casos especiales; semántica ADMIN/alias; contrato API compatible con code. Clasificar administración reservada frente a operación delegable. | Matriz inicial demuestra equivalencia con los cinco roles, incluidos overrides existentes; sin privilegios heredados por nombre. |
| 2. Expansión (datos + back compatible) | Ensayar SQL aditivo, catálogo de cinco roles por empresa, creación transaccional de empresa/seed, APIs de lectura/renombrado controlado; feature flag de alta/asignación propia apagado. | Preflight real sin anomalías; copia restaurable; el código antiguo sigue operando. |
| 3. Autorización (back) | DTOs validan rol de empresa, servicios enumeran catálogo y deniegan por defecto a propios, FKs/Prisma texto listos. Sustituir reglas funcionales por capacidades y resolver sesión vigente/invalidation. Protección ADMIN en servidor y auditoría. | Tests unitarios + HTTP + PostgreSQL aislado: aislamiento de empresa, código desconocido, último ADMIN, autosuspensión, overrides, JWT anterior/refresh, XML y reenvío. |
| 4. Preparación UI (front) | Roles dinámicos en editores/usuarios; tipos code abiertos; nombres desde API; menú/rutas/paleta/atajos/home desde permisos. Retirar capacidad local y listas funcionales por código; caches con scope. Alta de roles propios todavía deshabilitada. | Tests de equivalencia de cinco roles y alias, rol nuevo sin permisos, carga/error denegados, renombre sin logout, rutas directas y sin menús, caché entre empresas. |
| 5. Corte (datos + despliegue back/front) | Drenar API/workers, ejecutar SQL manual aprobado y verificaciones, desplegar cliente Prisma texto en todos los procesos, preparar/backfill permisos de menú; no aplicar cola Prisma. | Verificar conteos/FKs, login/refresh, cinco roles y clientes desplegados, ninguna instancia enum. Si falla, reversa limitada antes de permitir roles propios. |
| 6. Habilitación y observación | Activar mantenedor para ADMIN y asignación de roles propios; crear, renombrar y asignar módulos/menús/acciones; observar 403 y auditoría. | Suites completas y pruebas de aceptación, sin diferencias de privilegios de sistema no aprobadas. Nuevo rol sin concesiones no opera. |

No se abren pantallas dinámicas contra un back enum ni se permite asignar códigos nuevos durante despliegues mixtos. Si se exige cero interrupción, rediseñar la parte de datos con columnas paralelas, doble escritura verificable y retiro por fases; queda fuera de la alternativa simple propuesta y aumenta el alcance.

### Riesgos y mitigación

| Riesgo | Mitigación propuesta |
| --- | --- |
| Rol válido en UI pero rechazado por Prisma/guard/servicio | Secuencia anterior, feature flag y matriz endpoint/capacidad; ensayar un rol propio real de punta a punta. |
| Escalada por pertenecer a otra empresa o por cambiar name a “Administrador” | FK compuesta, scoping obligatorio, code inmutable, autorización por capacidad/code reservado y pruebas multiempresa. |
| ADMIN se bloquea o se pierde el último administrador | Protección de mutaciones en servidor, transacción/bloqueo para concurrencia del último ADMIN, UI bloqueada, vía de recuperación operativa revisada. No corregir overrides históricos sin revisión. |
| Token/store/caché siguen autorizando tras cambiar el rol | Validación de pertenencia actual, invalidación/versionado por empresa/usuario; refresh desde DB y pruebas con JWT anterior. |
| Menú visible pero ruta/API no permitida; redirección circular | Catálogo compartido, módulo+menú+acción explícitos, home al primer menú realmente permitido y estado “sin accesos”; pruebas de rutas directas/atajos/paleta. |
| Rol desconocido tratado como escritor o API vacía interpretada como acceso | Default deny para propios y durante carga/error; retirar `!isReadOnly` como prueba de capacidad y fallbacks de listas vacías. |
| XML AUDITOR o reenvío forzado cambian sus efectos al retirar literales | Pruebas específicas de efectos laterales, actor, trazabilidad y condiciones existentes; capacidad dedicada si se delega. |
| Drift o dependencia SQL no visible en el repo | Preflight contra destino, inventario de dependencias, copia/restauración y SQL manual versionado con checksums; no ejecutar cola Prisma ni usar CASCADE. |
| Cast/reescritura bloquea tablas o rollback pierde roles nuevos | Medir en copia, ventana drenada y timeouts; conservar enum; corte con flag apagado; abortar reversa si hay códigos propios y acordar tratamiento de datos. |
| Seeds/nuevas empresas sin roles o FKs | Inicialización atómica de cinco roles antes de usuarios; seed idempotente y pruebas de concurrencia/registro. |
| Catálogos/defaults evolucionan y conceden de más | Catálogos técnicos versionados, propios sin herencia y auditoría de cambios; backfill preserva overrides y compara permisos efectivos. |

## Anexo A. Back: conteos por archivo de producción

**20 archivos; 77 tokens; 71 literales; 15 comparaciones; 19 decoradores `@Roles`.** Incluye todos los archivos `src/` con los códigos del inventario (no solo auth). Los conteos de comparaciones y decoradores no son equivalentes a número de endpoints: hay decoradores de clase.

| Archivo | Tokens | Líneas | Literales | Comparaciones | @Roles |
| --- | ---: | ---: | ---: | ---: | ---: |
| `src/modules/auth/application/dto/updateUserDto.ts` | 5 | 1 | 5 | 0 | 0 |
| `src/modules/auth/application/services/actionPermissionsService.ts` | 5 | 4 | 5 | 0 | 0 |
| `src/modules/auth/application/services/modulePermissionsService.ts` | 11 | 7 | 6 | 1 | 0 |
| `src/modules/auth/application/services/warehouseAccessService.ts` | 4 | 3 | 4 | 3 | 0 |
| `src/modules/auth/application/use-cases/registerUseCase.ts` | 1 | 1 | 1 | 0 | 0 |
| `src/modules/auth/domain/entities/userEntity.ts` | 5 | 5 | 5 | 0 | 0 |
| `src/modules/auth/infrastructure/controllers/authController.ts` | 8 | 8 | 8 | 8 | 0 |
| `src/modules/auth/infrastructure/interceptors/moduleWriteInterceptor.ts` | 1 | 1 | 1 | 1 | 0 |
| `src/modules/auth/infrastructure/persistence/prismaUserRepositoryAdapter.ts` | 3 | 3 | 3 | 0 | 0 |
| `src/modules/invoices/application/services/invoiceForcedResendService.ts` | 2 | 1 | 1 | 1 | 0 |
| `src/modules/invoices/infrastructure/controllers/invoiceAccountingRegularizationController.ts` | 1 | 1 | 1 | 0 | 1 |
| `src/modules/invoices/infrastructure/controllers/invoiceBatchRetryController.ts` | 1 | 1 | 1 | 0 | 1 |
| `src/modules/invoices/infrastructure/controllers/invoiceBridgeReprocessController.ts` | 1 | 1 | 1 | 0 | 1 |
| `src/modules/invoices/infrastructure/controllers/invoiceConfigController.ts` | 2 | 2 | 2 | 0 | 2 |
| `src/modules/invoices/infrastructure/controllers/invoiceDetractionController.ts` | 4 | 2 | 4 | 0 | 2 |
| `src/modules/invoices/infrastructure/controllers/invoiceDownloadController.ts` | 1 | 1 | 1 | 1 | 0 |
| `src/modules/invoices/infrastructure/controllers/invoiceForcedResendController.ts` | 1 | 1 | 1 | 0 | 1 |
| `src/modules/invoices/infrastructure/controllers/invoiceQueryController.ts` | 15 | 8 | 15 | 0 | 8 |
| `src/modules/invoices/infrastructure/controllers/invoiceSunatConsultController.ts` | 2 | 1 | 2 | 0 | 1 |
| `src/modules/invoices/infrastructure/controllers/invoicesController.ts` | 4 | 2 | 4 | 0 | 2 |

Los guards `rolesGuard.ts` y `actionPermissionsGuard.ts` no contienen estos literales: consumen metadata/catálogos y por eso su ausencia de la tabla no implica ausencia de impacto. `createUserDto.ts` importa ROLES y tampoco aporta literales propios.

### Ubicación exacta de los 19 decoradores

Rutas bajo `src/modules/invoices/infrastructure/controllers/`. Cuatro son de clase completa y quince de método; deben revisarse todos los handlers de las clases antes de sustituir políticas.

| Archivo:línea | Clase / método | Alcance | Roles |
| --- | --- | --- | --- |
| `invoiceAccountingRegularizationController.ts:15` | `InvoiceAccountingRegularizationController` | clase completa | `ADMIN` |
| `invoiceBatchRetryController.ts:11` | `InvoiceBatchRetryController` | clase completa | `ADMIN` |
| `invoiceBridgeReprocessController.ts:12` | `InvoiceBridgeReprocessController` | clase completa | `ADMIN` |
| `invoiceConfigController.ts:61` | `actualizarConfiguracion` | método | `ADMIN` |
| `invoiceConfigController.ts:83` | `crearSerie` | método | `ADMIN` |
| `invoiceDetractionController.ts:20` | `deposit` | método | `ADMIN`, `OPERADOR_FACTURACION` |
| `invoiceDetractionController.ts:29` | `edit` | método | `ADMIN`, `OPERADOR_FACTURACION` |
| `invoiceForcedResendController.ts:11` | `InvoiceForcedResendController` | clase completa | `ADMIN` |
| `invoiceQueryController.ts:183` | `enviarResumen` | método | `ADMIN`, `OPERADOR_FACTURACION` |
| `invoiceQueryController.ts:203` | `enviarBaja` | método | `ADMIN`, `OPERADOR_FACTURACION` |
| `invoiceQueryController.ts:234` | `enviarAnulacionNotas` | método | `ADMIN`, `OPERADOR_FACTURACION` |
| `invoiceQueryController.ts:244` | `consultarAgregado` | método | `ADMIN`, `OPERADOR_FACTURACION` |
| `invoiceQueryController.ts:302` | `resolverDlq` | método | `ADMIN`, `OPERADOR_FACTURACION` |
| `invoiceQueryController.ts:316` | `reintentarCdr` | método | `ADMIN` |
| `invoiceQueryController.ts:343` | `notaCredito` | método | `ADMIN`, `OPERADOR_FACTURACION` |
| `invoiceQueryController.ts:363` | `notaDebito` | método | `ADMIN`, `OPERADOR_FACTURACION` |
| `invoiceSunatConsultController.ts:18` | `consultar` | método | `ADMIN`, `OPERADOR_FACTURACION` |
| `invoicesController.ts:58` | `create` | método | `ADMIN`, `OPERADOR_FACTURACION` |
| `invoicesController.ts:88` | `emitir` | método | `ADMIN`, `OPERADOR_FACTURACION` |

### Referencias back adicionales sin literal

Los siguientes archivos transportan el tipo o el valor y complementan el inventario anterior (no todos toman decisiones de autorización):

- Auth: `application/mappers/userMapper.ts`, `application/services/createUserService.ts`, `application/use-cases/loginUseCase.ts`, `application/use-cases/refreshTokenUseCase.ts`, `domain/ports/tokenServicePort.ts`, `infrastructure/decorators/currentUserDecorator.ts`, `infrastructure/decorators/rolesDecorator.ts`, `infrastructure/guards/actionPermissionsGuard.ts`, `infrastructure/guards/rolesGuard.ts`, `infrastructure/security/nativeJwtAdapter.ts` (prefijo `src/modules/auth/`). Además, `createUserDto.ts` valida contra el catálogo importado y `AuthGuard` entrega el payload ya descrito.
- Inventario: `src/modules/inventory/application/services/inventoryCatalogsService.ts`, `src/modules/inventory/infrastructure/controllers/inventoryStocksController.ts`.
- Compras/ventas: `src/modules/purchases/infrastructure/controllers/purchaseOrdersController.ts`, `purchasesController.ts` en el mismo directorio; `src/modules/sales/infrastructure/controllers/cashClosuresController.ts`.
- SIRE, prefijo `src/modules/sire/infrastructure/controllers/`: `manualSireConsultationController.ts`, `sireConfigurationController.ts`, `sireController.ts`, `sireMenuController.ts`, `sireReadOnlyPeriodsController.ts`.

## Anexo B. Front: conteos por archivo de producción

**21 archivos; 505 tokens; 470 literales; 33 comparaciones.** Los comentarios y texto visible explican la diferencia entre tokens y literales. Se cuentan archivos versionados aunque una regla de ignore impida encontrarlos con una búsqueda sin `--no-ignore`.

| Archivo | Tokens | Líneas | Literales | Comparaciones |
| --- | ---: | ---: | ---: | ---: |
| `src/components/layout/CommandPalette.tsx` | 2 | 2 | 2 | 2 |
| `src/components/layout/KeyboardShortcuts.tsx` | 40 | 10 | 40 | 1 |
| `src/components/layout/Sidebar.tsx` | 74 | 30 | 71 | 4 |
| `src/components/layout/UserNavDropdown.tsx` | 6 | 6 | 6 | 0 |
| `src/hooks/useAuth.ts` | 7 | 6 | 7 | 7 |
| `src/hooks/useRolePermissions.ts` | 7 | 5 | 7 | 7 |
| `src/modules/auth/components/DemoCredentialsBox.tsx` | 5 | 5 | 5 | 0 |
| `src/modules/auth/pages/ProfilePage.tsx` | 1 | 1 | 1 | 0 |
| `src/modules/auth/pages/RolePermissionsPage.tsx` | 9 | 8 | 6 | 6 |
| `src/modules/auth/pages/UserWarehousesPage.tsx` | 14 | 4 | 9 | 3 |
| `src/modules/auth/services/modulePermissionsApi.ts` | 5 | 1 | 5 | 0 |
| `src/modules/auth/services/warehousesApi.ts` | 5 | 1 | 5 | 0 |
| `src/modules/auth/types/auth.types.ts` | 7 | 7 | 7 | 0 |
| `src/modules/customs/pages/CustomsAccountingPage.tsx` | 1 | 1 | 0 | 0 |
| `src/modules/invoices/components/InvoiceAuditTrail.tsx` | 1 | 1 | 0 | 0 |
| `src/modules/invoices/components/InvoiceSeriesForm.tsx` | 1 | 1 | 1 | 1 |
| `src/modules/invoices/data/demoSession.ts` | 2 | 2 | 1 | 0 |
| `src/modules/invoices/hooks/useInvoiceWritePermission.ts` | 2 | 1 | 2 | 0 |
| `src/routes/RoleProtectedRoute.tsx` | 3 | 3 | 2 | 2 |
| `src/routes/appRoutes.tsx` | 301 | 77 | 286 | 0 |
| `src/routes/roleNavigation.ts` | 12 | 11 | 7 | 0 |

Dependencias adicionales sin códigos escritos en el propio archivo: los seis consumidores de useRolePermissions enumerados en el apartado 2; `src/hooks/useAuth.ts` transmite flags a `InventoryAdjustmentsPage`, `InventoryTransfersPage`, `InvoiceBatchRetry`, `InvoiceBridgeReprocess`, `InvoiceForcedResend` e `InvoiceMonitorPage`; `src/modules/auth/hooks/useLogin.ts` consume roleNavigation; `src/stores/authStore.ts` persiste el tipo; `src/modules/auth/hooks/usePermissionsIdentity.ts` usa el rol en el scope de caché. Los consumidores de acciones/fecha de emisión mantienen el contrato code textual. Estos archivos también deben formar parte de la revisión de construcción, aunque aporten cero literales a la tabla.

## Anexo C. Pruebas y fixtures: conteo estático por archivo

| Repositorio | Archivos de pruebas con tokens de rol | Fixtures con tokens | Literales en pruebas | Literales en fixtures | Declaraciones de prueba con literal |
| --- | ---: | ---: | ---: | ---: | ---: |
| Back | 56 | 1 | 208 | 6 | 80 |
| Front | 37 | 1 | 100 | 15 | 38 |

Back: 236 tokens en esos 57 archivos contando el fixture; front: 135 tokens en 38 archivos contando su fixture. **No son 80/38 casos ejecutados**, ni todo el conjunto transitivamente afectado: un beforeEach puede dar un rol a muchas pruebas sin literales dentro de ellas. El árbol contiene 3102 declaraciones estáticas de pruebas en back y 1123 en front con el método indicado; las expansiones parametrizadas producen otro total. No se modifica ni ejecuta ninguna prueba.

### Back

| Archivo | Tokens | Literales | Declaraciones con literal |
| --- | ---: | ---: | ---: |
| `test/e2e/auth-flow.e2e-spec.ts` | 1 | 1 | 1 |
| `test/e2e/customs/customs-flow.e2e-spec.ts` | 1 | 1 | 0 |
| `test/e2e/customs/customsFlow.spec.ts` | 1 | 1 | 0 |
| `test/e2e/invoices/invoiceQuery.e2e-spec.ts` | 2 | 2 | 0 |
| `test/e2e/invoices/invoices.e2e-spec.ts` | 1 | 1 | 0 |
| `test/e2e/sire/sireDashboardMetrics.e2e-spec.ts` | 2 | 2 | 0 |
| `test/e2e/sire/sireMenu.e2e-spec.ts` | 1 | 1 | 0 |
| `test/e2e/sire/sireMockLifecycle.e2e-spec.ts` | 1 | 1 | 0 |
| `test/e2e/sire/sirePeriodosQueueFailure.e2e-spec.ts` | 1 | 1 | 0 |
| `test/e2e/sire/sireSecurityAudit.e2e-spec.ts` | 1 | 1 | 0 |
| `test/fixtures/authPermissionsHttpHarness.ts` | 6 | 6 | 0 |
| `test/integration/auth/actionPermissions.database.spec.ts` | 7 | 6 | 3 |
| `test/integration/auth/actionPermissions.http.spec.ts` | 7 | 6 | 3 |
| `test/integration/auth/moduleView.database.spec.ts` | 9 | 8 | 3 |
| `test/integration/auth/moduleView.http.spec.ts` | 5 | 4 | 4 |
| `test/integration/auth/users.database.spec.ts` | 7 | 7 | 3 |
| `test/integration/auth/users.http.spec.ts` | 2 | 1 | 0 |
| `test/integration/invoices/batch-retry.integration.spec.ts` | 1 | 1 | 0 |
| `test/integration/invoices/issuer-config.integration.spec.ts` | 3 | 2 | 1 |
| `test/integration/invoices/outbox.integration.spec.ts` | 1 | 1 | 0 |
| `test/unit/auth/actionPermissionsGuard.spec.ts` | 2 | 2 | 1 |
| `test/unit/auth/actionPermissionsService.spec.ts` | 14 | 13 | 5 |
| `test/unit/auth/authController.spec.ts` | 27 | 25 | 8 |
| `test/unit/auth/authGuard.spec.ts` | 1 | 1 | 1 |
| `test/unit/auth/authSeed.spec.ts` | 5 | 5 | 1 |
| `test/unit/auth/changePasswordUseCase.spec.ts` | 1 | 1 | 0 |
| `test/unit/auth/createUserService.spec.ts` | 3 | 2 | 1 |
| `test/unit/auth/getProfileUseCase.spec.ts` | 2 | 2 | 1 |
| `test/unit/auth/loginUseCase.spec.ts` | 4 | 4 | 2 |
| `test/unit/auth/modulePermissionsService.spec.ts` | 14 | 13 | 5 |
| `test/unit/auth/moduleWriteInterceptor.spec.ts` | 6 | 5 | 4 |
| `test/unit/auth/nativeJwtAdapter.spec.ts` | 4 | 4 | 3 |
| `test/unit/auth/prismaUserRepositoryAdapter.spec.ts` | 4 | 4 | 3 |
| `test/unit/auth/refreshTokenUseCase.spec.ts` | 1 | 1 | 0 |
| `test/unit/auth/registerUseCase.spec.ts` | 3 | 2 | 2 |
| `test/unit/auth/rolesGuard.spec.ts` | 4 | 4 | 2 |
| `test/unit/auth/updateProfileUseCase.spec.ts` | 1 | 1 | 0 |
| `test/unit/auth/warehouseAccessService.spec.ts` | 11 | 10 | 3 |
| `test/unit/common/decorators.spec.ts` | 1 | 1 | 1 |
| `test/unit/inventory/customsToInventoryIntegration.spec.ts` | 1 | 0 | 0 |
| `test/unit/inventory/inventoryControllersAdditional.spec.ts` | 1 | 1 | 1 |
| `test/unit/invoices/8f-roles.spec.ts` | 20 | 20 | 4 |
| `test/unit/invoices/8f-validation-inputs.spec.ts` | 1 | 1 | 1 |
| `test/unit/invoices/invoiceBatchRetryRoute.spec.ts` | 4 | 3 | 1 |
| `test/unit/invoices/issuerConfigController.spec.ts` | 5 | 4 | 2 |
| `test/unit/invoices/m1-cierre-forzado.spec.ts` | 4 | 2 | 1 |
| `test/unit/invoices/m1-cierre-series-admin.spec.ts` | 5 | 4 | 1 |
| `test/unit/invoices/m1-reproceso-puente.spec.ts` | 4 | 3 | 1 |
| `test/unit/invoices/p9-summary-roles.spec.ts` | 7 | 6 | 1 |
| `test/unit/invoices/parte7-permisos.spec.ts` | 5 | 5 | 1 |
| `test/unit/purchases/purchasesController.spec.ts` | 2 | 2 | 1 |
| `test/unit/sire/manualSireConsultationController.spec.ts` | 1 | 1 | 0 |
| `test/unit/sire/sireConfigurationController.spec.ts` | 1 | 1 | 0 |
| `test/unit/sire/sireController.spec.ts` | 4 | 4 | 4 |
| `test/unit/sire/sireControllerEndpoints.spec.ts` | 1 | 1 | 0 |
| `test/unit/sire/sireMenuController.spec.ts` | 1 | 1 | 0 |
| `test/unit/sire/sireReadOnlyPeriodsController.spec.ts` | 1 | 1 | 0 |

### Front

| Archivo | Tokens | Literales | Declaraciones con literal |
| --- | ---: | ---: | ---: |
| `test/fixtures/permissionsServer.ts` | 15 | 15 | 0 |
| `test/unit/hooks/useRolePermissions.test.tsx` | 10 | 5 | 5 |
| `test/unit/layout/keyboardShortcuts.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/auth/actionPermissionsApi.test.ts` | 2 | 2 | 2 |
| `test/unit/modules/auth/authContext.test.tsx` | 2 | 2 | 2 |
| `test/unit/modules/auth/createUser.test.tsx` | 6 | 5 | 2 |
| `test/unit/modules/auth/protectedRoutes.test.tsx` | 8 | 5 | 2 |
| `test/unit/modules/auth/roleActionEditor.test.tsx` | 9 | 4 | 1 |
| `test/unit/modules/auth/useActionPermissions.test.tsx` | 6 | 5 | 3 |
| `test/unit/modules/invoices/EnviarResumenDiarioBoton.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/clientesRoute.test.tsx` | 18 | 18 | 9 |
| `test/unit/modules/invoices/invoice8cBridgePending.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceAddFocus.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceBagsRegistered.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceBajaEnvio.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceBatchRetry.test.tsx` | 4 | 4 | 1 |
| `test/unit/modules/invoices/invoiceCazaForm.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceCierreForzado.test.tsx` | 3 | 2 | 2 |
| `test/unit/modules/invoices/invoiceCierreSeries.test.tsx` | 2 | 1 | 1 |
| `test/unit/modules/invoices/invoiceEmptyRow.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceFormValidation.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceIdempotencyForm.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceLineFields.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceMonitorReal.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceMonitorRetry.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceNotasErrorVisible.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceNoteQuantities.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoicePageAddSearch.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoicePageKeyboard.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoicePageReferenceIgv.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoicePulidoClienteEmision.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/invoiceReprocesoPuente.test.tsx` | 5 | 4 | 1 |
| `test/unit/modules/invoices/invoiceServerPermissions.test.tsx` | 9 | 7 | 2 |
| `test/unit/modules/invoices/invoiceTa63Selector.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/p9-close.test.tsx` | 11 | 11 | 3 |
| `test/unit/modules/invoices/p9-form-wiring.test.tsx` | 3 | 3 | 2 |
| `test/unit/modules/invoices/pulidosRucEmisor.test.tsx` | 1 | 1 | 0 |
| `test/unit/modules/invoices/rucForms.test.tsx` | 1 | 1 | 0 |

## Decisión pendiente

**Con este informe se decide si se construye.** La propuesta recomienda FK compuesta por empresa, code estable y name renombrable, roles de sistema protegidos, permisos funcionales y de menús explícitos, JWT compatible y corte manual controlado. Su implementación, SQL definitivo, pruebas y aplicación a datos requieren un encargo posterior. Esta fase 0 termina con el informe; no habilita el mantenedor ni modifica datos.
