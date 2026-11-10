# Ferry M1 — Pulido final del recorrido (5A–5D)

Entrega para copiar únicamente los archivos del manifiesto a sus rutas exactas en el repositorio front. No fusionar el árbol del back con el front.

## Bases y dependencias

- Front dev base: `640d4b88ef8cfd81e7241874f184a13a5bf48cf1`.
- Front local probado: `e0aeb0d340cc7119a39f801eadfbc79248f75f4f`.
- Back dev base: `f8cea8c56314e61b575ed463b473ecbc50ccee37`.
- Back requerido: `020387acd96b8c55164c909833ae551b2474ecda`, rama `fix/m1-pulido-recorrido`.
- Commits back por parte: `caad503` (5A), `8df2cae` (5B), `4c35444` (5C), `020387a` (5D y cierre documental).
- Commits front locales: `9c55f05`, `a3af7c8`, `e6d5d4d`, `e0aeb0d`.

## Contenido

- 5A: neto confirmado (aceptados/observados, ventas menos NC más ND) y conteo explícito de todos los comprobantes registrados. Sin cambiar la bandeja.
- 5B: presentación de `resultado_presentacion` para distinguir validación local, rechazo SUNAT y origen no confirmado, sin cambiar estados fiscales ni históricos.
- 5C: acción del Monitor para DLQ mediante retry-cdr existente; el back persiste incertidumbre antes de publicar y mueve efectivamente a la cola principal sin duplicar trabajos activos. La conciliación previa al reenvío se conserva.
- 5D: solo pruebas de regresión; no reproducible en dev. Selección con clic, teclado/Enter y texto sin confirmar en ambos formularios (6 casos), sin cambiar producción.

La excepción quirúrgica en `queue.service.ts`, camino `reenqueueInvoiceIfIdle`, fue autorizada por Jhordy el 10 de noviembre de 2026 para aviso a Oliver. Está documentada en `docs/m1/auditoria-solucion.md` del back. Sin rescate automático de la DLQ.

## Verificación

- Back base: 264 suites / 2445 pruebas aprobadas. Final: 267 suites / 2469 pruebas aprobadas, cero fallos; 4 suites / 38 pruebas omitidas sin cambios. 12 snapshots fiscales intactos.
- Front base: 102 archivos / 811 pruebas. Final: 105 archivos / 827 pruebas, todo aprobado.
- Build de ambos repos aprobado. Lint back sin errores ni avisos; lint de archivos front modificados sin errores y con un aviso preexistente de Fast Refresh en el Monitor.
- Cobertura local de líneas nuevas instrumentadas del back: 38/38 (100%); líneas y condiciones combinadas: 93.58%, calculadas con LCOV y diff contra la base. No equivale a un resultado remoto de Sonar.
- Los 16 archivos copiados fueron verificados por SHA-256 contra el front probado.

Sin migraciones nuevas, emisiones, llamadas reales a SUNAT, PR, fusiones ni despliegues. El rescate real de F001-00000057 lo ejecutará Emma tras el despliegue; no se ejecutó aquí.

## Manifiesto

- `src/modules/invoices/components/InvoiceAuditTrail.tsx`
- `src/modules/invoices/components/InvoiceCdrModal.tsx`
- `src/modules/invoices/components/InvoiceStatusBadge.tsx`
- `src/modules/invoices/components/InvoiceTableRow.tsx`
- `src/modules/invoices/data/invoiceDemoSchema.ts`
- `src/modules/invoices/lib/invoiceApiMapper.ts`
- `src/modules/invoices/lib/invoiceMapper.ts`
- `src/modules/invoices/lib/invoiceMetricsPeriodo.ts`
- `src/modules/invoices/lib/invoiceResultPresentation.ts`
- `src/modules/invoices/pages/InvoiceMonitorPage.tsx`
- `src/modules/invoices/pages/InvoicesDashboardPage.tsx`
- `src/modules/invoices/types/invoice.types.ts`
- `test/unit/modules/invoices/invoiceMonitorRetry.test.tsx`
- `test/unit/modules/invoices/invoicePulidoClienteEmision.test.tsx`
- `test/unit/modules/invoices/invoicePulidoDashboard.test.tsx`
- `test/unit/modules/invoices/invoicePulidoPresentacion.test.tsx`
