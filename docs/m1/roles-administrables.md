# Roles administrables — paquete 3B

## Fase 0

Bases confirmadas por fetch el 16/11/2026 (America/Lima): back dev `d28ffc80591e3418b230b0163468d26aab22f298`; front main `dcf7864b3bc5e705ffea08ae3884e9bc0523c328`. Rama back `feat/roles-administrables`; ferry sobre esa base front. Especificación: informe `63f67d6c`, secciones 3 y 4, partes 1–4 exclusivamente. Sin PRs, merges, corte ni habilitación de roles propios.

| Suite antes de construir | Archivos aprobados | Archivos omitidos | Pruebas aprobadas | Pruebas omitidas | Fallos |
| --- | ---: | ---: | ---: | ---: | ---: |
| Back | 412 | 20 | 4166 | 105 | 0 |
| Front | 199 | 0 | 1488 | 0 | 0 |

Back: `NODE_OPTIONS=--max-old-space-size=4096 ROLES_TEST_DATABASE_URL=<PostgreSQL local efímero> npm test -- --runInBand`; 12 snapshots aprobados. El primer intento agotó el heap por defecto antes del resumen; la repetición completa con 4 GiB pasó. Se habilitan las integraciones del paquete 1 únicamente contra PostgreSQL Docker local, puerto 55433 ligado a 127.0.0.1, base roles_adm. No se usa ninguna base compartida. Front: `npm test -- --maxWorkers=2`.

Los dos fixtures `invoiceBagsRegistered.test.tsx` e `invoiceFormValidation.test.tsx` ya usan `hoyLima` calculado con Intl/America/Lima en esta base; no se conserva el problema de fecha fija de la entrega anterior. La línea base se midió antes de cambiar código.

## Límites de esta entrega

La expansión conserva los tres campos enum en el esquema activo: el código actual debe operar antes del corte. Se entregará un esquema candidato de texto/FK separado, validado, listo para la parte 5, sin aplicarlo ni generar un cliente activo incompatible con las columnas enum. Alta/asignación propia requiere flag y almacenamiento de texto; ambas permanecen deshabilitadas antes del corte. La parte 5 y la parte 6 requieren otro encargo.

## Parte 1 — contratos y seguridad

Catálogos técnicos `securityCatalog.ts` y `menuCatalog.ts`. Se enumeran los 72 usos RoleProtectedRoute del front, con módulo, patrón de ruta, jerarquía y línea de origen; no se confunden con las 22 listas del sidebar. Los códigos de rol y menu_code son estables; el nombre visible nunca concede permiso. Role continúa siendo code textual en DTO/JWT.

La política conserva un techo de acceso para los cinco roles de sistema en las operaciones que ya tenían @Roles. Un override antiguo de FORCE_RESEND en un operador no elude la restricción ADMIN anterior; EDIT_ISSUE_DATE conserva la delegación explícita del paquete 1. Los cuatro overrides existentes siguen aplicando, incluidos false para ADMIN. Los roles propios no heredan por nombre y están denegados con flag apagado. Administración de seguridad, protección ADMIN y configuración/series son reservadas; operaciones de negocio son delegables una vez habilitados roles propios tras el corte.

### Matriz endpoint → capacidad

Las rutas de archivos/handlers corresponden al snapshot back de fase 0. Cuatro decoradores son de clase (afectan todos sus handlers), quince de método; hay dos casos especiales adicionales.

| Archivo / handler | Capacidad | Acceso de sistema anterior | Clasificación |
| --- | --- | --- | --- |
| `invoiceAccountingRegularizationController.ts::InvoiceAccountingRegularizationController` | `INVOICE_ACCOUNTING_REGULARIZE` | ADMIN | operación delegable |
| `invoiceBatchRetryController.ts::InvoiceBatchRetryController` | `INVOICE_BATCH_RETRY` | ADMIN | operación delegable |
| `invoiceBridgeReprocessController.ts::InvoiceBridgeReprocessController` | `INVOICE_REPROCESS_BRIDGE` | ADMIN | operación delegable |
| `invoiceConfigController.ts::actualizarConfiguracion` | `INVOICE_CONFIG_EDIT` | ADMIN | reservada ADMIN |
| `invoiceConfigController.ts::crearSerie` | `INVOICE_CONFIG_EDIT` | ADMIN | reservada ADMIN |
| `invoiceDetractionController.ts::deposit` | `INVOICE_DETRACTION_REGISTER` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoiceDetractionController.ts::edit` | `INVOICE_DETRACTION_REGISTER` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoiceForcedResendController.ts::InvoiceForcedResendController` | `INVOICE_FORCE_RESEND` | ADMIN | operación delegable |
| `invoiceQueryController.ts::enviarResumen` | `INVOICE_SUMMARY_SEND` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoiceQueryController.ts::enviarBaja` | `INVOICE_SUMMARY_SEND` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoiceQueryController.ts::enviarAnulacionNotas` | `INVOICE_SUMMARY_SEND` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoiceQueryController.ts::consultarAgregado` | `INVOICE_SUNAT_POLL` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoiceQueryController.ts::resolverDlq` | `INVOICE_RESOLVE_DLQ` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoiceQueryController.ts::reintentarCdr` | `INVOICE_RETRY_CDR` | ADMIN | operación delegable |
| `invoiceQueryController.ts::notaCredito` | `INVOICE_NOTES_ISSUE` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoiceQueryController.ts::notaDebito` | `INVOICE_NOTES_ISSUE` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoiceSunatConsultController.ts::consultar` | `INVOICE_SUNAT_POLL` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoicesController.ts::create` | `INVOICE_EMIT` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoicesController.ts::emitir` | `INVOICE_EMIT` | ADMIN, OPERADOR_FACTURACION | operación delegable |
| `invoiceForcedResendService.ts::actor de reenvío forzado` | `INVOICE_FORCE_RESEND` | ADMIN | operación delegable |
| `invoiceDownloadController.ts::reparación XML` | `INVOICE_XML_REPAIR` | ADMIN, CONTADOR, OPERADOR_FACTURACION, OPERADOR_ADUANAS | operación delegable |

Los ocho chequeos de administración de auth permanecen reservados ADMIN; no se delegan mediante nombre o menú. XML: la capacidad gobierna únicamente reparación/generación, no niega la descarga sin efectos de AUDITOR. Los permisos de módulo M1 se conservan como filtro adicional (bypass de escritura ADMIN y can_view para GET).

Equivalencia: prueba independiente de los 21 puntos × 5 roles × 16 combinaciones de los cuatro overrides existentes × 4 combinaciones de can_view/can_write: 6720 comparaciones, sin discrepancias. Prueba adicional de delegación de fecha, denegación ADMIN y rol propio sin permisos. Catálogo de rutas comparado contra snapshot independiente de los 72 usos; unicidad/padres/ciclos verificados. No se detuvo ningún endpoint por falta de equivalencia.

## Parte 2 — expansión compatible con enum

SQL aditivo manual con preflight, transacción y checksums en scripts/manual/; instrucciones y reversa protegida en README-roles-administrables.md. Se ensayaron en PostgreSQL local esquema inicial, expansión, FKs multiempresa, repetición abortada y reversa. No se convirtió ni se aplicó SQL a base compartida. El esquema activo agrega solo modelos de catálogo/menús; los campos existentes siguen enum.

APIs autenticadas: GET /auth/roles (ADMIN, code/name/isSystem), GET /auth/roles/config y GET /auth/permission-catalog; PATCH /auth/roles/:code solo ADMIN modifica name, no code/is_system, y protege nombre ADMIN. POST /auth/roles existe detrás de doble compuerta: ROLES_CUSTOM_ENABLED y almacenamiento users.role de texto. Default false; true sobre enum sigue false. Alta/asignación propia deshabilitadas antes del corte. No hay endpoint de borrado de roles del sistema.

Registro de empresa y seed inicializan cinco roles/360 permisos de menú dentro de su transacción, sin sobrescribir existentes. Renombrado transaccional auditado con actor, empresa, code, antes/después. Ninguna autorización depende del nombre visible.

Verificación P2: build Prisma/Nest aprobado; cuatro archivos / 21 pruebas dirigidas aprobadas, incluidos los cinco escenarios SQL reales y la adaptación de fixtures de seed/registro. Las suites completas se repetirán al cerrar todas las partes.

## Parte 3 — autorización y auditoría

Los 19 decoradores funcionales @Roles fueron sustituidos por RequireCapability/CapabilityGuard según la matriz. El servicio de reenvío también consulta su capacidad; XML consulta INVOICE_XML_REPAIR para conservar descarga sin efectos de AUDITOR. RolesGuard permanece únicamente como compatibilidad de infraestructura; ya no hay @Roles en controladores de producción. El catálogo final contiene 14 acciones de M1: las cuatro del paquete 1 y las capacidades necesarias para los demás puntos de la matriz. `/me` expone allowed efectivo y available para mantener visible una acción estructuralmente disponible pero denegada (p. ej. ADMIN con override false); el editor conserva los valores persistidos sin ampliar el techo histórico de los roles de sistema.

DTOs admiten code textual con formato válido; servicios validan pertenencia a la empresa. Las matrices listan el catálogo por empresa, no un array fijo; roles propios denegados por defecto y no asignables antes de la habilitación. Nuevas mutaciones no pueden cambiar permisos ADMIN; denegaciones históricas se mantienen y requieren revisión, no se convierten silenciosamente en permisos. La API de menús valida rol/menu_code y protege la administración de seguridad.

AuthGuard exige SessionMembershipService: firma identifica sub+companyId y cada petición resuelve usuario activo, empresa activa y rol vigente del catálogo. Claims incompletos abortan antes de cualquier consulta Prisma para evitar filtros undefined. Un JWT anterior no conserva privilegios tras reasignar rol; login y refresh firman el rol actual de la base. No se cambió el formato textual del claim role ni se usa el nombre visible para autorizar. Roles propios requieren flag y las tres columnas de texto con FKs compuestas validadas: true sobre enum o corte parcial sigue deshabilitado.

Actualización de rol/estado serializa por empresa mediante SELECT FOR UPDATE en la transacción; protege último ADMIN activo y propio rol/cuenta. Cambios de nombre, asignaciones y permisos se auditan dentro de la misma transacción: actor, empresa, code, antes/después y digest. Para matrices se registra el estado realmente persistido, no campos adicionales del request; un error de auditoría revierte también la mutación. Los endpoints conservan el chequeo ADMIN del servidor para administrar roles, usuarios y permisos.

### Esquema de corte preparado, no aplicado

`prisma/cutover/auth.prisma` reemplaza únicamente auth.prisma al ejecutar la parte 5: elimina Role, convierte los tres campos a String y agrega tres FK compuestas (company_id, role) → CompanyRole(company_id, code), Restrict en borrado/actualización. Se validó junto con los otros esquemas en un directorio temporal, sin conectar a DB. El esquema activo conserva enum para que la expansión y sus escrituras actuales funcionen antes del corte. No se entrega ni ejecuta conversión como si formara parte de este paquete; no se activa el candidato ni el flag.

### Pruebas de seguridad

Hay pruebas unitarias y HTTP con guards/servicios reales para actor vigente, rol ajeno, nombre sin autoridad, JWT previo, refresh, ADMIN protegido, flag y 72 menús. PostgreSQL local verifica bloqueo concurrente del último ADMIN, auditoría antes/después y rollback conjunto. Los tests antiguos de transporte/negocio adaptan fixtures de pertenencia y verifican capacidades en lugar de inspeccionar metadata @Roles; no se desactivó enforcement de producción. La equivalencia de la matriz se prueba contra snapshots independientes de las bases, incluidos todos los overrides válidos del catálogo anterior. El preflight SQL aborta si existen acciones históricas fuera de esas cuatro: no se afirma equivalencia para datos desconocidos ni se reinterpretan silenciosamente.

Endpoints adicionales de esta parte: GET/PUT `/auth/menu-permissions` (ADMIN), GET `/auth/permissions/me` (sesión vigente) para snapshot propio de rol/nombre, módulos, acciones, menús, inicio permitido y flag. Las preferencias iniciales de los cinco roles son técnicas y no conceden acceso: si la preferida no está visible se elige otra visible o null. El snapshot incluye ayudas de presentación de los accesos de creación M2/M4 para retirar la matriz local sin inventar nuevos permisos HTTP; estos módulos conservan su enforcement de módulo actual, fuera de los 21 puntos M1 de la matriz.

Verificación back de cierre de la parte: 439 archivos detectados, 419 aprobados y 20 omitidos; 4208 pruebas aprobadas y 105 omitidas, cero fallos; 12 snapshots aprobados. Las omisiones son las mismas de fase 0. Pruebas dirigidas adicionales de auditoría/catálogo: dos archivos / once pruebas aprobadas. Build Prisma/Nest y lint aprobados; lint mantiene tres advertencias preexistentes en summaryAggregateStore.ts, summaryPollingCoordinator.ts y supplierCreditNote.spec.ts, sin advertencias nuevas.
