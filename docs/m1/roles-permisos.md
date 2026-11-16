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

Enforcement: `ActionPermissionsGuard`, con metadatos en los controladores reales, se ejecuta además de AuthGuard/RolesGuard. En ambas rutas de emisión comprueba fecha_emision explícita contra `fechaFiscalLima()`; una fecha distinta sin permiso produce 403 con code `ACTION_PERMISSION_DENIED` y action identificada antes de crear, reservar o encolar. Omitir fecha o indicar hoy no consulta esa acción. Se mantienen las validaciones anteriores: el DTO fiscal de POST `/invoices` sigue requiriendo fecha y coherencia con el payload, por lo que omitirla allí puede seguir produciendo 400 por contrato, sin exigir el permiso. La fecha fiscal explícita se compara por su día literal, sin convertirla a UTC. No se cambian validaciones de notas, saldos, stock ni almacenes.

Migración: `prisma/migrations/20261116110000_role_action_permissions/migration.sql`; copia idéntica `scripts/manual/role-action-permissions.sql`. Instrucciones en `scripts/manual/README-roles-permisos.md`. Se ejecutó el SQL solo sobre un PostgreSQL efímero local, creado con el esquema de la nueva base; no se aplicó a ninguna base compartida.

Validación P1: 6 suites / 48 pruebas dirigidas aprobadas (36 nuevas y 12 regresiones existentes). Incluyen HTTP real de Nest con los controladores y guards de producción, defaults y overrides por empresa, denegación/grant conservando roles, ambas rutas de emisión, fechas en el límite de medianoche de Lima y PostgreSQL real con unicidad concurrente. Build oficial del back aprobado.
