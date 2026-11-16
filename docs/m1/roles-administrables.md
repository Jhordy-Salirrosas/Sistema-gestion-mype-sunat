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

La expansión conserva los tres campos enum en el esquema activo: el código actual debe operar antes del corte. Se entregará un esquema candidato de texto/FK separado, validado, listo para la parte 5, sin aplicarlo ni generar un cliente activo incompatible con las columnas enum. Alta/asignación propia requiere flag y las tres columnas de texto con FKs compuestas validadas; ambas permanecen deshabilitadas antes del corte. La parte 5 y la parte 6 requieren otro encargo.

## Parte 1 — contratos y seguridad

Catálogos técnicos `securityCatalog.ts` y `menuCatalog.ts`. Se enumeran los 72 usos RoleProtectedRoute del front, con módulo, patrón de ruta, jerarquía y línea de origen; no se confunden con las 22 listas del sidebar. Los códigos de rol y menu_code son estables; el nombre visible nunca concede permiso. Role continúa siendo code textual en DTO/JWT.

La intersección anterior entre @Roles y las acciones del paquete 1 se representa mediante permisos de acceso adicionales, con los mismos defaults iniciales. Un override antiguo de FORCE_RESEND en un operador sigue inactivo si no tiene el acceso adicional; EDIT_ISSUE_DATE conserva su delegación explícita. No hay un techo funcional inmutable para los roles de sistema: una concesión posterior explícita se decide por filas de permisos, sin cambiar el nombre o el código del rol. Los cuatro overrides existentes, incluidos false para ADMIN, se conservan. Roles propios denegados con flag apagado. Administración de seguridad, protección ADMIN y configuración/series son reservadas; operaciones de negocio son delegables mediante permisos; su asignación a roles propios sigue bloqueada hasta el corte y la habilitación.

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

Los accesos adicionales son permisos administrables, no listas inmutables de roles:

| Acción | Acceso adicional requerido | Default del acceso |
| --- | --- | --- |
| INVOICE_FORCE_RESEND | INVOICE_FORCE_RESEND_ACCESS | ADMIN |
| INVOICE_REPROCESS_BRIDGE | INVOICE_REPROCESS_BRIDGE_ACCESS | ADMIN |
| INVOICE_RESOLVE_DLQ | INVOICE_RESOLVE_DLQ_ACCESS | ADMIN, OPERADOR_FACTURACION |

Los permisos anteriores se mantienen sin reescribir filas. Por ejemplo, un FORCE_RESEND=true antiguo de OPERADOR_FACTURACION sigue sin autorizar mientras ACCESS sea false; una concesión explícita de ACCESS posterior habilita la operación. Del mismo modo CONTADOR puede recibir INVOICE_EMIT mediante una concesión nueva. PostgreSQL local prueba ambos casos, además de la equivalencia inicial completa. El snapshot calcula allowed efectivo y la UI confía en ese valor, sin componer permisos por su cuenta. El catálogo informa las dependencias para que el editor muestre qué accesos adicionales hacen falta.

Los ocho chequeos de administración de auth permanecen reservados ADMIN; no se delegan mediante nombre o menú. XML: la capacidad gobierna únicamente reparación/generación, no niega la descarga sin efectos de AUDITOR. Los permisos de módulo M1 se conservan como filtro adicional (bypass de escritura ADMIN y can_view para GET).

Equivalencia: prueba independiente de los 21 puntos × 5 roles × 16 combinaciones de los cuatro overrides existentes × 4 combinaciones de can_view/can_write: 6720 comparaciones, sin discrepancias. Prueba adicional de delegación de fecha, denegación ADMIN y rol propio sin permisos. Catálogo de rutas comparado contra snapshot independiente de los 72 usos; unicidad/padres/ciclos verificados. No se detuvo ningún endpoint por falta de equivalencia.

## Parte 2 — expansión compatible con enum

SQL aditivo manual con preflight, transacción y checksums en scripts/manual/; instrucciones y reversa protegida en README-roles-administrables.md. Se ensayaron en PostgreSQL local esquema inicial, expansión, FKs multiempresa, repetición abortada y reversa. No se convirtió ni se aplicó SQL a base compartida. El esquema activo agrega solo modelos de catálogo/menús; los campos existentes siguen enum.

APIs autenticadas: GET /auth/roles (ADMIN, code/name/isSystem), GET /auth/roles/config y GET /auth/permission-catalog; PATCH /auth/roles/:code solo ADMIN modifica name, no code/is_system, y protege nombre ADMIN. POST /auth/roles existe detrás de doble compuerta: ROLES_CUSTOM_ENABLED y almacenamiento users.role de texto. Default false; true sobre enum sigue false. Alta/asignación propia deshabilitadas antes del corte. No hay endpoint de borrado de roles del sistema.

Registro de empresa y seed inicializan cinco roles/360 permisos de menú dentro de su transacción, sin sobrescribir existentes. Renombrado transaccional auditado con actor, empresa, code, antes/después. Ninguna autorización depende del nombre visible.

Verificación P2: build Prisma/Nest aprobado; cuatro archivos / 21 pruebas dirigidas aprobadas, incluidos los cinco escenarios SQL reales y la adaptación de fixtures de seed/registro. Las suites completas se repetirán al cerrar todas las partes.

## Parte 3 — autorización y auditoría

Los 19 decoradores funcionales @Roles fueron sustituidos por RequireCapability/CapabilityGuard según la matriz. El servicio de reenvío también consulta su capacidad; XML consulta INVOICE_XML_REPAIR para conservar descarga sin efectos de AUDITOR. RolesGuard permanece únicamente como compatibilidad de infraestructura; ya no hay @Roles en controladores de producción. El catálogo final contiene 17 acciones de M1: las cuatro del paquete 1 y las capacidades necesarias para los demás puntos de la matriz, incluidos tres accesos adicionales para preservar su intersección histórica. `/me` expone allowed efectivo y available para mantener visible una acción estructuralmente disponible pero denegada (p. ej. ADMIN con override false); el editor conserva valores persistidos y permite nuevas concesiones explícitas, sin restricciones funcionales permanentes por rol de sistema.

DTOs admiten code textual con formato válido; servicios validan pertenencia a la empresa. Las matrices listan el catálogo por empresa, no un array fijo; roles propios denegados por defecto y no asignables antes de la habilitación. Nuevas mutaciones no pueden cambiar permisos ADMIN; denegaciones históricas se mantienen y requieren revisión, no se convierten silenciosamente en permisos. La API de menús valida rol/menu_code y protege la administración de seguridad.

AuthGuard exige SessionMembershipService: firma identifica sub+companyId y cada petición resuelve usuario activo, empresa activa y rol vigente del catálogo. Claims incompletos abortan antes de cualquier consulta Prisma para evitar filtros undefined. Un JWT anterior no conserva privilegios tras reasignar rol; login y refresh firman el rol actual de la base. No se cambió el formato textual del claim role ni se usa el nombre visible para autorizar. Roles propios requieren flag y las tres columnas de texto con FKs compuestas validadas: true sobre enum o corte parcial sigue deshabilitado.

Actualización de rol/estado serializa por empresa mediante SELECT FOR UPDATE en la transacción; protege último ADMIN activo y propio rol/cuenta. Cambios de nombre, asignaciones y permisos se auditan dentro de la misma transacción: actor, empresa, code, antes/después y digest. Para matrices se registra el estado realmente persistido, no campos adicionales del request; un error de auditoría revierte también la mutación. Los endpoints conservan el chequeo ADMIN del servidor para administrar roles, usuarios y permisos.

### Esquema de corte preparado, no aplicado

`prisma/cutover/auth.prisma` reemplaza únicamente auth.prisma al ejecutar la parte 5: elimina Role, convierte los tres campos a String y agrega tres FK compuestas (company_id, role) → CompanyRole(company_id, code), Restrict en borrado/actualización. Se validó junto con los otros esquemas en un directorio temporal, sin conectar a DB. El esquema activo conserva enum para que la expansión y sus escrituras actuales funcionen antes del corte. No se entrega ni ejecuta conversión como si formara parte de este paquete; no se activa el candidato ni el flag.

### Pruebas de seguridad

Hay pruebas unitarias y HTTP con guards/servicios reales para actor vigente, rol ajeno, nombre sin autoridad, JWT previo, refresh, ADMIN protegido, flag y 72 menús. PostgreSQL local verifica bloqueo concurrente del último ADMIN, auditoría antes/después y rollback conjunto. Los tests antiguos de transporte/negocio adaptan fixtures de pertenencia y verifican capacidades en lugar de inspeccionar metadata @Roles; no se desactivó enforcement de producción. La equivalencia de la matriz se prueba contra snapshots independientes de las bases, incluidos todos los overrides válidos del catálogo anterior. El preflight SQL aborta si existen acciones históricas fuera de esas cuatro: no se afirma equivalencia para datos desconocidos ni se reinterpretan silenciosamente.

Endpoints adicionales de esta parte: GET/PUT `/auth/menu-permissions` (ADMIN), GET `/auth/permissions/me` (sesión vigente) para snapshot propio de rol/nombre, módulos, acciones, menús, inicio permitido y flag. Las preferencias iniciales de los cinco roles son técnicas y no conceden acceso: si la preferida no está visible se elige otra visible o null. El snapshot incluye ayudas de presentación de los accesos de creación M2/M4 para retirar la matriz local sin inventar nuevos permisos HTTP; estos módulos conservan su enforcement de módulo actual, fuera de los 21 puntos M1 de la matriz.

Verificación back de cierre de la parte: 439 archivos detectados, 419 aprobados y 20 omitidos; 4214 pruebas aprobadas y 105 omitidas, cero fallos; 12 snapshots aprobados. Las omisiones son las mismas de fase 0. Pruebas dirigidas adicionales de auditoría/catálogo: dos archivos / once pruebas aprobadas. Build Prisma/Nest y lint aprobados; lint mantiene tres advertencias preexistentes en summaryAggregateStore.ts, summaryPollingCoordinator.ts y supplierCreditNote.spec.ts, sin advertencias nuevas.

## Parte 4 — front en ferry

El ferry sobre front dcf7864b agrega cliente de roles/catálogos/menús, mantenedor de nombres y snapshot efectivo. Editor de módulos/acciones/menús y usuarios recorren roles de la empresa y muestran name enviando code; no enumeran cinco opciones locales. ADMIN sigue protegido en UI y servidor. La creación/asignación propia está deshabilitada; la UI depende del flag servidor, sin un interruptor local de activación.

Role pasa a código abierto. ACCOUNTANT/OPERATOR quedan reservados en API y CHECK SQL: no pueden crearse como roles propios, aun después de habilitar el flag. Solo se normalizan en el borde de sesión a sus códigos canónicos; no se crean como roles DB. Sidebar, rutas, paleta, atajos e inicio usan el snapshot `/auth/permissions/me`; se retiran las 72 listas allowedRoles y las listas funcionales del menú/atajos. Carga, error o respuesta inválida deniegan, sin usar ADMIN como fallback. Un usuario sin accesos tiene una pantalla estable, no un bucle de redirección.

useRolePermissions es fachada de datos del servidor; no contiene matriz local. M1 combina escritura M1 e INVOICE_EMIT, además de las acciones específicas y las condiciones operativas anteriores. Las ayudas de enlaces de creación M2/M4 mantienen la presentación anterior y no son nuevas reglas HTTP: estos módulos siguen su enforcement vigente. La identidad ADMIN permanece solo donde representa administración/protección reservada. El nombre visible no interviene en ninguna decisión de acceso.

Cachés nuevas y de los editores/usuarios incluyen empresa, usuario y rol; se invalidan al guardar. El snapshot se refresca cada 30 segundos y actualiza nombre/rol de sesión sin logout ni cambio de formato JWT. Las dos rutas `/kardex/*` ahora usan M6 también en la UI: antes quedaban fuera de su mapa de módulos, aunque sus API ya son `/inventory/kardex`. Con override can_view=false ahora se cierra la ruta en UI en vez de ofrecer una pantalla cuyo back la rechaza; no se agregan prefijos al interceptor. Los defaults de los cinco roles/aliases conservan sus decisiones iniciales.

Pruebas nuevas/adaptadas cubren los cinco roles y dos aliases, 72 decisiones de ruta por identidad, catálogo dinámico con code propio, rol sin permisos aunque se llame Administrador, carga/error incluso con caché previa, menús guardados sin modificar módulos/acciones, ADMIN protegido, alta propia apagada, scope de usuario/empresa y renombrado visible sin renovar sesión. Los fixtures de fecha y la regla fiscal permanecen idénticos a la base. Los tests de otros flujos aíslan los permisos con respuestas API de fixture; las pruebas específicas ejecutan hooks/guards reales. No se ocultan fallos ni se agregan omisiones.

Verificación de navegador con respuestas locales: renombrar, guardar menú, ADMIN bloqueado y creación propia deshabilitada; escritorio 1366 px y móvil 360 px, cero errores de página y ancho de documento 360 px en móvil. Se revisó la legibilidad de los formularios. Harness/capturas temporales fuera del ferry, sin llamadas a servicios externos.

### Inventario de los 72 usos de rutas

Los códigos se tomaron de appRoutes.tsx de dcf7864b y se comparan contra un snapshot independiente. La jerarquía aparece tanto en menuCatalog.ts como en el catálogo SQL; no se dedujo el número de pantallas a partir de las listas del sidebar. Código de menú y ruta son técnicos; el administrador asigna visibilidad, no crea rutas arbitrarias.

| menu_code | Módulo | Ruta | Padre |
| --- | --- | --- | --- |
| `MENU_INVOICES_DASHBOARD` | M1 | `/invoices/dashboard` | — |
| `MENU_INVOICES_DETRACCIONES` | M1 | `/invoices/detracciones` | — |
| `MENU_INVOICES_REPORTES_VENTAS` | M1 | `/invoices/reportes/ventas` | — |
| `MENU_INVOICES_FACTURAS` | M1 | `/invoices/facturas` | — |
| `MENU_INVOICES_CLIENTES` | M1 | `/invoices/clientes` | — |
| `MENU_INVOICES_EMISION` | M1 | `/invoices/emision` | — |
| `MENU_INVOICES_NOTAS` | M1 | `/invoices/notas` | — |
| `MENU_INVOICES_BAJAS` | M1 | `/invoices/bajas` | — |
| `MENU_INVOICES_MONITOR` | M1 | `/invoices/monitor` | — |
| `MENU_INVOICES_CONFIGURACION` | M1 | `/invoices/configuracion` | — |
| `MENU_INVOICES_CONFIGURACION_PRECIOS` | M1 | `/invoices/configuracion/precios` | `MENU_INVOICES_CONFIGURACION` |
| `MENU_USUARIOS_ALMACENES` | M9 | `/usuarios/almacenes` | — |
| `MENU_USUARIOS_PERMISOS` | M9 | `/usuarios/permisos` | — |
| `MENU_SALES` | M7 | `/sales` | — |
| `MENU_SALES_POS` | M7 | `/sales/pos` | `MENU_SALES` |
| `MENU_SALES_HISTORIAL` | M7 | `/sales/historial` | `MENU_SALES` |
| `MENU_SALES_DEVOLUCIONES` | M7 | `/sales/devoluciones` | `MENU_SALES` |
| `MENU_SALES_COTIZACIONES` | M7 | `/sales/cotizaciones` | `MENU_SALES` |
| `MENU_SALES_PEDIDOS` | M7 | `/sales/pedidos` | `MENU_SALES` |
| `MENU_SALES_CAJA` | M7 | `/sales/caja` | `MENU_SALES` |
| `MENU_SALES_REPORTES` | M7 | `/sales/reportes` | `MENU_SALES` |
| `MENU_CUSTOMS` | M2 | `/customs` | — |
| `MENU_CUSTOMS_DASHBOARD` | M2 | `/customs/dashboard` | `MENU_CUSTOMS` |
| `MENU_CUSTOMS_ORDERS` | M2 | `/customs/orders` | `MENU_CUSTOMS` |
| `MENU_CUSTOMS_SUPPLIERS` | M2 | `/customs/suppliers` | `MENU_CUSTOMS` |
| `MENU_CUSTOMS_PARTNERS` | M2 | `/customs/partners` | `MENU_CUSTOMS` |
| `MENU_CUSTOMS_CONFIG` | M2 | `/customs/config` | `MENU_CUSTOMS` |
| `MENU_CUSTOMS_SHIPMENTS` | M2 | `/customs/shipments` | `MENU_CUSTOMS` |
| `MENU_CUSTOMS_SHIPMENTS_ID` | M2 | `/customs/shipments/:id` | `MENU_CUSTOMS_SHIPMENTS` |
| `MENU_CUSTOMS_DECLARATIONS` | M2 | `/customs/declarations` | `MENU_CUSTOMS` |
| `MENU_CUSTOMS_DECLARATIONS_NEW` | M2 | `/customs/declarations/new` | `MENU_CUSTOMS_DECLARATIONS` |
| `MENU_CUSTOMS_SETTLEMENTS` | M2 | `/customs/settlements` | `MENU_CUSTOMS` |
| `MENU_CUSTOMS_LANDED_COST` | M2 | `/customs/landed-cost` | `MENU_CUSTOMS` |
| `MENU_CUSTOMS_SHIPMENTS_ID_LANDED_COST` | M2 | `/customs/shipments/:id/landed-cost` | `MENU_CUSTOMS_SHIPMENTS_ID` |
| `MENU_CUSTOMS_ACCOUNTING` | M2 | `/customs/accounting` | `MENU_CUSTOMS` |
| `MENU_CUSTOMS_INVENTORY_KARDEX` | M2 | `/customs/inventory/kardex` | `MENU_CUSTOMS` |
| `MENU_CUSTOMS_LEGACY` | M2 | `/customs/legacy` | `MENU_CUSTOMS` |
| `MENU_PURCHASES_DASHBOARD` | M8 | `/purchases/dashboard` | `MENU_PURCHASES` |
| `MENU_PURCHASES_PAYABLES` | M8 | `/purchases/payables` | `MENU_PURCHASES` |
| `MENU_PURCHASES` | M8 | `/purchases` | — |
| `MENU_PURCHASES_ORDERS` | M8 | `/purchases/orders` | `MENU_PURCHASES` |
| `MENU_INVENTORY_DASHBOARD` | M6 | `/inventory/dashboard` | — |
| `MENU_INVENTORY_STOCKS` | M6 | `/inventory/stocks` | — |
| `MENU_INVENTORY_MOVEMENTS` | M6 | `/inventory/movements` | — |
| `MENU_INVENTORY_TRANSFERS` | M6 | `/inventory/transfers` | — |
| `MENU_INVENTORY_ADJUSTMENTS` | M6 | `/inventory/adjustments` | — |
| `MENU_INVENTORY_OPENING` | M6 | `/inventory/opening` | — |
| `MENU_INVENTORY_CONFIG` | M6 | `/inventory/config` | — |
| `MENU_KARDEX_GENERAL` | M6 | `/kardex/general` | — |
| `MENU_KARDEX_PRODUCTO` | M6 | `/kardex/producto` | — |
| `MENU_SIRE_CONFIGURACION` | M3 | `/sire/configuracion` | — |
| `MENU_SIRE_IMPORTAR` | M3 | `/sire/importar` | — |
| `MENU_SIRE_PERIODOS` | M3 | `/sire/periodos` | — |
| `MENU_SIRE_CONCILIACION` | M3 | `/sire/conciliacion` | — |
| `MENU_SIRE_CIERRE` | M3 | `/sire/cierre` | — |
| `MENU_SIRE_HISTORIAL` | M3 | `/sire/historial` | — |
| `MENU_ACCOUNTING_DASHBOARD` | M4 | `/accounting/dashboard` | `MENU_ACCOUNTING` |
| `MENU_ACCOUNTING` | M4 | `/accounting` | — |
| `MENU_ACCOUNTING_LEDGER` | M4 | `/accounting/ledger` | `MENU_ACCOUNTING` |
| `MENU_ACCOUNTING_INCOME_STATEMENT` | M4 | `/accounting/income-statement` | `MENU_ACCOUNTING` |
| `MENU_ACCOUNTING_TRIAL_BALANCE` | M4 | `/accounting/trial-balance` | `MENU_ACCOUNTING` |
| `MENU_ACCOUNTING_BALANCE_SHEET` | M4 | `/accounting/balance-sheet` | `MENU_ACCOUNTING` |
| `MENU_ACCOUNTING_AUDITORIA` | M4 | `/accounting/auditoria` | `MENU_ACCOUNTING` |
| `MENU_SALES_COBRANZAS` | M7 | `/sales/cobranzas` | `MENU_SALES` |
| `MENU_COLLECTIONS` | M7 | `/collections` | — |
| `MENU_PURCHASES_EXPENSES` | M8 | `/purchases/expenses` | `MENU_PURCHASES` |
| `MENU_EXPENSES` | M4 | `/expenses` | — |
| `MENU_ACCOUNTING_RULES` | M4 | `/accounting/rules` | `MENU_ACCOUNTING` |
| `MENU_ACCOUNTING_PLAN_CUENTAS` | M4 | `/accounting/plan-cuentas` | `MENU_ACCOUNTING` |
| `MENU_ACCOUNTING_PERIODS` | M4 | `/accounting/periods` | `MENU_ACCOUNTING` |
| `MENU_ACCOUNTING_TAX_BOOKS` | M4 | `/accounting/tax-books` | `MENU_ACCOUNTING` |
| `MENU_ACCOUNTING_PLE` | M4 | `/accounting/ple` | `MENU_ACCOUNTING` |

## Pendiente para el corte y la habilitación (partes 5–6, no ejecutadas)

1. Revisar destino/drift/dependencias/datos reales y backups recuperables; verificar SQL del paquete 1 aplicado. El preflight de expansión debe pasar sin saltar errores; scripts y checksums manuales están en scripts/manual/. No se aplicó nada fuera del PostgreSQL local efímero.
2. Coordinar expansión/despliegue del back preparado y front compatible. El front nuevo no debe publicarse contra un back que carezca de `/auth/permissions/me`; ante 404/error deniega, no recurre a una matriz local. Drenar registro de empresas durante la transición de escritores antiguos a los que inicializan el catálogo; revisar empresas creadas durante esa ventana.
3. Parte 5: preparar y ensayar SQL de conversión de las tres columnas, defaults, índices y FK compuestas; medir locks/reescritura, ventana controlada y reversa. Activar candidato Prisma/generar cliente texto en todos los procesos solo con el corte coordinado. No ejecutar la cola oficial Prisma bloqueada por drift ni db push; su reconciliación es otra tarea.
4. Mantener ROLES_CUSTOM_ENABLED=false durante todo el corte. Verificar equivalencia efectiva de datos/overrides, integridad por empresa, JWT/refresh, lectores/escritores y ausencia de clientes enum. Los cinco roles del sistema no se borran; code es inmutable y ADMIN se protege. Reversas con roles propios requieren revisión explícita/exportación, nunca reasignación o borrado silencioso.
5. Parte 6: habilitación explícita posterior al corte, aceptación y observación; la doble compuerta comprueba texto y FKs validadas. Nada de este paquete activa roles propios en una base compartida o de producción.

## Conteos finales y entrega

| Suite completa | Archivos detectados antes → después | Aprobados antes → después | Omitidos antes → después | Pruebas aprobadas antes → después | Pruebas omitidas | Fallos |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Back | 432 → 439 | 412 → 419 | 20 → 20 | 4166 → 4214 | 105 → 105 | 0 → 0 |
| Front | 199 → 201 | 199 → 201 | 0 → 0 | 1488 → 1509 | 0 → 0 | 0 → 0 |

Incremento: 7 archivos y 48 pruebas de back; 2 archivos y 21 pruebas de front. Back conserva 12 snapshots aprobados. Ambas suites completas terminan con código 0; mismas omisiones del back, ninguna nueva. Builds Prisma/Nest y TypeScript/Vite aprobados; lint back sin advertencias nuevas (tres preexistentes ya identificadas). `git diff --check`, checksums SQL y del ferry verificados.

Ferry: **72 archivos, 31 de código y 41 de pruebas/soporte**, sin dependencias nuevas. SHA256SUMS contiene 73 entradas (frontend/ y FERRY.md); el delta coincide byte por byte con el checkout front autorizado. El inventario sustituye el espejo heredado: sus eliminaciones en el diff del back no son borrados que deban aplicarse al front. FERRY.md detalla APIs, aplicación y prerrequisitos. No contiene harnesses, builds, node_modules, capturas ni archivos de entorno.

Solo se construyeron las partes 1–4; no hay PRs, merges, despliegue, corte ni habilitación. Rama de revisión: feat/roles-administrables.
