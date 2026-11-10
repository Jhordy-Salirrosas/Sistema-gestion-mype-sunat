# Ferry M1 — Parte 5b: incertidumbre de transporte

Copiar SOLO el manifiesto a las rutas exactas del repo front. No fusionar este árbol back en el front.

## Bases

- Front dev: `793149f86a9f904f7d200bd2e5f08d281bda9610`.
- Front local probado: `8064f6d1ac2418fa4df4ba63f26a32b974e42511` (sin push al repo front).
- Back dev: `f831ec68e9d105e3c4cb2a1f39e1956b51e8488c`.
- Back requerido: `b219bb9e221953672b8a721d442e8ce8136bf6cb`, rama `fix/m1-incertidumbre-transporte`.

## Contrato y comportamiento

El campo existente `resultado_presentacion` puede tener origen `TRANSPORTE_INCIERTO`, código `M1_TRANSPORT_UNCERTAIN` y motivo sanitizado. Se transporta por los mappers existentes. Badge, bitácora, filtros y Monitor presentan «Incertidumbre de transporte», sin afirmar «No llegó a SUNAT» ni «Error de red» para SIN_CONFIRMAR/incierto. El Monitor muestra el motivo y permite la acción existente Reintentar también cuando el estado fiscal es ENVIADO con incertidumbre. El servidor concilia antes de autorizar un reenvío; la UI no publica trabajos ni envía a SUNAT directamente.

El back conserva los estados fiscales, retry-cdr y sus estados admitidos. Consulta inconclusa es resultado pendiente, no fallo/DLQ; nunca autoriza un segundo envío ciego. La excepción de Jhordy del 10 nov permite únicamente invoiceRetryService.ts en Resiliencia, para el puerto estructurado y las conciliaciones. Documentación para aviso a Oliver en docs/m1/auditoria-solucion.md.

## Caso real F001-00000057

La exportación completa de Emma tiene SOLO tres filas: rescate EN_DLQ, rescate ENCOLADO y MAX_REINTENTOS por ISSUER_STATUS_UNCERTAIN. No contiene el bloqueo XSL original ni eventos de transporte. Clase: **EVIDENCIA_INSUFICIENTE**. No se fuerza a «nunca salió». Con beta inconclusa queda pendiente y accionable, sin reenvío ciego ni nueva DLQ por ese resultado. Esto no garantiza reenviar la factura histórica: requiere evidencia adicional o consulta concluyente. La operación real corresponde a Emma tras el despliegue; no se ejecutó aquí.

## Pruebas

- Back: base 267 suites / 2469 pruebas; final **269 suites / 2493 pruebas**, todo aprobado. Cobertura local nueva: 52/52 líneas (100%); combinado líneas/condiciones 93,89% (LCOV + diff, no Sonar remoto); 12 snapshots fiscales intactos; 4 suites / 38 pruebas omitidas sin cambios.
- Front base: 105 archivos / 827 pruebas. Final: **105 archivos / 829 pruebas**, todo aprobado.
- Builds back y front aprobados. Lint back sin errores/avisos. ESLint de los archivos front modificados sin errores; dos avisos preexistentes de Fast Refresh (InvoiceFiltersBar e InvoiceMonitorPage).
- Copia de 12 archivos verificada por SHA-256 contra el front probado.
- Sin migraciones nuevas, PR, merges, despliegues, emisiones ni llamadas reales a SUNAT. Únicamente base local desechable para pruebas.

## Manifiesto

- `src/modules/invoices/components/InvoiceAuditTrail.tsx`
- `src/modules/invoices/components/InvoiceFiltersBar.tsx`
- `src/modules/invoices/components/InvoiceKpiCards.tsx`
- `src/modules/invoices/components/InvoiceStatusBadge.tsx`
- `src/modules/invoices/data/invoiceDemoSchema.ts`
- `src/modules/invoices/lib/invoiceRedError.ts`
- `src/modules/invoices/lib/invoiceResultPresentation.ts`
- `src/modules/invoices/pages/InvoiceMonitorPage.tsx`
- `test/unit/modules/invoices/InvoiceStatusBadge.test.tsx`
- `test/unit/modules/invoices/invoiceCazaBandeja.test.tsx`
- `test/unit/modules/invoices/invoiceMonitorRetry.test.tsx`
- `test/unit/modules/invoices/invoicePulidoPresentacion.test.tsx`
