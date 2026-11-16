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
