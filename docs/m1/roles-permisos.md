# Roles y permisos — Semana Cueva, paquete 1

## Fase 0 actualizada y base autorizada

Repositorio `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`. Rama `feat/roles-permisos`, rehecha desde **`569183747586d87526a29d5dbe2d23615ed2663a`**, sin merges. Se conserva este informe de fase 0 y se actualiza conforme a la resolución del encargo. El registro inicial sobre `03890af8` detectó la ausencia del paquete previo y pasó 395 archivos / 4042 pruebas, con 20 archivos / 105 pruebas omitidos. Esa base fue sustituida expresamente por el usuario antes de construir.

Suite completa sobre la nueva base, **antes de cambiar código**:

| Resultado | Archivos/suites | Pruebas |
| --- | ---: | ---: |
| Aprobados | 401 | 4061 |
| Omitidos por configuración | 20 | 105 |
| Fallos | 0 | 0 |

Comando: `NODE_OPTIONS=--max-old-space-size=4096 npm test -- --maxWorkers=2 --workerIdleMemoryLimit=512MB`. Prisma generado antes de Jest. Las integraciones opcionales sin base externa conservan su omisión; no se afirma que la corrida haya utilizado bases compartidas.

## Auth confirmado en la nueva base

- `prisma/schema/auth.prisma`: enum Role de cinco valores (ADMIN, CONTADOR, OPERADOR_FACTURACION, OPERADOR_ADUANAS, AUDITOR); `RoleModulePermission`/`role_module_permissions`, único por company_id/role/module_code, con can_view/can_write.
- `ModulePermissionsService`: matriz `PERMISOS_POR_ROL` de M1–M10, consulta efectiva con defaults por rol y actualización por empresa.
- `ModuleWriteInterceptor`: comprobación de escritura POST/PUT/PATCH/DELETE sobre prefijos existentes; ADMIN queda exceptuado; GET todavía no se comprueba.
- `RolesGuard`: aplica `@Roles` del método o clase. GET `/auth/module-permissions/me` autenticado; GET/PUT `/auth/module-permissions` solo ADMIN. GET `/auth/users` solo ADMIN; aún no existe POST.

## Resoluciones de los límites identificados en fase 0

1. P1/P2 se construirán sobre el paquete de permisos por módulo presente en la nueva base autorizada.
2. P3 usará **correo único global**, autorizado expresamente, porque login identifica al usuario solamente por correo. El esquema inicial tiene `@@unique([company_id, email])`; el registro ya normaliza a minúsculas y consulta correo global antes de crear.
3. Auditoría previa a preparar la migración: se revisaron `prisma/seed.ts`, `prisma/seeds/`, scripts de seed, `fixtures/`, `test/fixtures/`, integración y el flujo e2e de auth. El único seed que persiste usuarios es `prisma/seeds/auth.seed.ts`: cinco correos distintos, todos en `DEMO_COMPANY`. Las fixtures de auth en memoria se indexan por correo global. No se encontraron filas conocidas coexistentes de usuarios con el mismo correo en distintas empresas. Correos de terceros/proveedores no pertenecen a `User` y no se cambian. No se inspeccionó ni modificó una base compartida.
4. No hay datos conocidos del repositorio que obliguen a detener P3. Su SQL comprobará duplicados antes de crear el índice global y abortará sin eliminar usuarios si los hubiera en la base de destino. El seed se adaptará al selector único global, sin reasignar usuarios de otra empresa.

## Catálogo y defaults de P1 (diseño autorizado)

| Acción M1 | Roles permitidos sin fila persistida |
| --- | --- |
| INVOICE_EDIT_ISSUE_DATE | ADMIN |
| INVOICE_FORCE_RESEND | ADMIN |
| INVOICE_RESOLVE_DLQ | ADMIN, OPERADOR_FACTURACION |
| INVOICE_REPROCESS_BRIDGE | ADMIN |

Los tres últimos defaults reflejan los `@Roles` actuales de los controladores de reenvío forzado, resolución DLQ y reproceso de puente, respectivamente. Los `@Roles` se conservarán como requisito adicional al permiso por acción. Fecha omitida o igual a hoy en America/Lima no exigirá INVOICE_EDIT_ISSUE_DATE.

## Implementación y validación por parte

La línea base se registró antes de construir. Se mantiene un commit por P1, P2 y P3, sin PRs ni merges. Las migraciones Prisma y sus copias SQL manuales se entregarán en el repositorio y no se aplicarán a bases compartidas.

### P1 construido — permisos por acción

`RoleActionPermission` se relaciona con Company y usa la clave única company_id/role/action_code, allowed y updated_at. Catálogo cerrado de las cuatro acciones anteriores; un rol desconocido no obtiene permisos. Las filas persistidas prevalecen sobre los defaults, incluida una denegación explícita para ADMIN. Se conservan los `@Roles`: conceder una acción a un rol fuera de ellos no habilita la operación.

Administración: GET `/api/v1/auth/action-permissions/me` devuelve las cuatro acciones efectivas del rol autenticado. GET `/api/v1/auth/action-permissions` devuelve las veinte combinaciones y PUT recibe un arreglo de `{role, actionCode, allowed}`; ambos requieren ADMIN y toman la empresa del token. PUT actualiza las filas enviadas, sin borrar otras; rechaza rol/acción desconocidos, allowed no booleano y combinaciones duplicadas antes de escribir. Un company_id ajeno en el cuerpo no modifica la empresa efectiva. Ejemplo: `[{"role":"OPERADOR_FACTURACION","actionCode":"INVOICE_EDIT_ISSUE_DATE","allowed":true}]`.

Enforcement: `ActionPermissionsGuard`, con metadatos en los controladores reales, se ejecuta además de AuthGuard/RolesGuard. En ambas rutas de emisión comprueba fecha_emision explícita contra `fechaFiscalLima()`; una fecha distinta sin permiso produce 403 con un mensaje que identifica la acción antes de crear, reservar o encolar. La excepción incluye code `ACTION_PERMISSION_DENIED` y action; el filtro HTTP global existente expone el mensaje en detail/message, sin cambiar su formato de respuesta. Omitir fecha o indicar hoy no consulta esa acción. Se mantienen las validaciones anteriores: el DTO fiscal de POST `/invoices` sigue requiriendo fecha y coherencia con el payload, por lo que omitirla allí puede seguir produciendo 400 por contrato, sin exigir el permiso. La fecha fiscal explícita se compara por su día literal, sin convertirla a UTC. No se cambian validaciones de notas, saldos, stock ni almacenes.

Migración: `prisma/migrations/20261116110000_role_action_permissions/migration.sql`; copia idéntica `scripts/manual/role-action-permissions.sql`. Instrucciones en `scripts/manual/README-roles-permisos.md`. Se ejecutó el SQL solo sobre un PostgreSQL efímero local, creado con el esquema de la nueva base; no se aplicó a ninguna base compartida.

Validación P1: 6 suites / 48 pruebas dirigidas aprobadas (36 nuevas y 12 regresiones existentes). Incluyen HTTP real de Nest con los controladores y guards de producción, defaults y overrides por empresa, denegación/grant conservando roles, ambas rutas de emisión, fechas en el límite de medianoche de Lima y PostgreSQL real con unicidad concurrente. Build oficial del back aprobado.

### P2 construido — lectura en el servidor

El mapa `MODULO_POR_RUTA` conserva exactamente sus doce entradas: inventory/purchases→M8; inventory→M6; purchases y purchase-orders→M8; invoices→M1; customs→M2; sire→M3; accounting/treasury/expenses→M4; sales→M7; warehouses→M6. Los prefijos se comparan por segmento completo y sin query string, manteniendo la prioridad de inventory/purchases. No se agregan prefijos.

GET comprueba `can_view` efectivo antes de ejecutar el handler; HEAD aplica la misma comprobación porque Express puede resolverlo con el handler GET. Un rol con write=true y view=false recibe 403 al leer y conserva la escritura permitida. ADMIN también respeta una denegación de lectura persistida; su excepción anterior de escritura no cambia. Auth y master-data se excluyen expresamente, al igual que health. Resilience/M5, seguridad/auth/M9, UX/M10, dashboards y cualquier prefijo no listado quedan fuera del mapa; su autenticación/guards existentes continúan vigentes. Estas exclusiones también están documentadas en el interceptor.

Validación P2: cuatro suites / 33 pruebas dirigidas aprobadas y ocho regresiones HTTP de P1, sin fallos. Incluyen las doce rutas mapeadas, subruta específica de compras, 403 sin ejecutar el handler, defaults de auditor, overrides por empresa, accesos compartidos, HEAD y PostgreSQL local real. No hay migración en esta parte.

### P3 construido — alta ADMIN y correo único global

POST `/api/v1/auth/users` utiliza AuthGuard y la misma comprobación explícita ADMIN que GET `/auth/users`. Recibe `{name,email,password,role}` y toma companyId exclusivamente del token. Valida nombre de 3–150 caracteres, correo, uno de los cinco roles y la política de contraseña del registro (`PasswordStrengthRule`), sin recortar ni modificar la contraseña. Recorta nombre/correo y guarda el correo en minúsculas; rechaza propiedades ajenas al DTO mediante la validación global existente.

El servicio crea un usuario activo con el hasher nativo existente y devuelve id, companyId, email, fullName, role e isActive, sin password ni password_hash. Comprueba correo ocupado globalmente (también variantes de mayúsculas) y transforma una colisión de índice concurrente en 409. El usuario puede iniciar sesión inmediatamente con email/password y recibe la empresa y el rol creados; no se asignan almacenes automáticamente ni se alteran las reglas de acceso a ellos. La búsqueda de correo del repositorio de login/registro recorta y convierte la entrada a minúsculas, sin agregar un identificador de empresa al contrato de login.

`User.email` pasa a `@unique` y se retira `@@unique([company_id,email])`. Migración `20261116120000_users_email_global/migration.sql` y copia idéntica `scripts/manual/users-email-global.sql`: preflight de duplicados existentes, índice global nuevo y retirada del compuesto. No borra ni reasigna datos; ante duplicados aborta. Se documenta aplicación manual transaccional y checksums en `scripts/manual/README-roles-permisos.md` y `scripts/manual/roles-permisos.sha256`. Solo se ejecutó en PostgreSQL efímero local.

El seed demo usa el selector único email junto con company_id como condición adicional; antes de actualizar rechaza un correo perteneciente a otra empresa. La condición adicional del upsert evita reasignar o sobrescribir un usuario ajeno incluso si aparece entre la consulta y el upsert. Los cinco correos y sus roles se conservan. No se encontró un conjunto de datos persistentes conocido que obligara a detener esta parte.

Validación P3 dirigida: seis suites / 44 pruebas aprobadas, incluyendo regresiones del repositorio y del seed. HTTP real comprueba ADMIN/401/403, DTO, exclusión del hash, empresa del token, duplicados globales y dos solicitudes concurrentes. PostgreSQL local verifica índice entre empresas, altas concurrentes y login inmediato con hasher/repositorio/JWT reales. El SQL se ensayó además en un esquema efímero con duplicados deliberados: abortó conservando las dos filas y el índice previo; sin el fixture duplicado conservó la fila original, sustituyó el índice y rechazó duplicados entre empresas. Build oficial aprobado. Ninguna parte quedó detenida tras las dos resoluciones autorizadas.

## Validación completa de cierre

| Capa back | Base `5691837475` | Cierre |
| --- | ---: | ---: |
| Archivos/suites aprobados | 401 | 411 |
| Pruebas aprobadas | 4061 | 4159 |
| Archivos/suites omitidos | 20 | 20 |
| Pruebas omitidas | 105 | 105 |
| Fallos | 0 | 0 |

Incremento: diez archivos y 98 pruebas (P1: 36; P2: 27; P3: 35). Los 12 snapshots siguen aprobados. El único cambio frente a la configuración de la línea base es habilitar `ROLES_TEST_DATABASE_URL` para las doce pruebas nuevas de PostgreSQL efímero local. Se mantuvieron omitidas las integraciones antiguas que requieren su entorno específico; no se ejecutó nada contra una base compartida.

La primera corrida completa detectó siete fixtures antiguos incompletos. Se adaptaron seis módulos de pruebas para registrar el servicio de acciones con los defaults reales y se fijó la fecha actual de Lima en las pruebas cuyo objeto es el rol, no la edición de fecha. El fixture e2e de aduanas ahora representa una matriz de módulos vacía, conservando los defaults reales. No se desactivaron guards de producción ni se cambiaron las intenciones de las comprobaciones de roles, empresa o flujo aduanero. Las siete suites afectadas pasaron 43 pruebas dirigidas; la repetición completa posterior pasó 411 archivos / 4159 pruebas.

Los SQL manuales son idénticos a sus migraciones y sus dos checksums se verificaron. El diff de esquema generado por Prisma confirma exclusivamente la tabla de acciones, su clave/índice/FK y el cambio del índice compuesto de correo a índice global; no hay otros cambios de esquema. No se modifican enum Role, frontend, ferry ni payload fiscal. Se conserva un commit por parte y el de fase 0; sin PRs, merges, despliegues ni aplicación de SQL a bases compartidas.

Build oficial (`prisma generate` + `nest build`) y lint (`oxlint src/ test/`) finales aprobados después de la suite. Lint conserva dos advertencias preexistentes en summaryAggregateStore.ts y summaryPollingCoordinator.ts, fuera del cambio. `git diff --check` y los checksums SQL están aprobados.
