# FERRY — Parte 8C

Rama de transporte: `ferry/m1-8c-puente-resumenes`.

Base front: `c146b716d1cbab7b3456e8186625c6f1021cee6a`.
Base back y de esta rama ferry: `311b02aaf709383aff899a1171ece060b612e788`.
Back requerido: rama `fix/m1-8c-puente-resumenes`, commit `d71dc51e135cd8d54120b566649d0102004a953b`.

Este ferry contiene archivos del front en sus rutas originales sobre una base del repositorio back. Trasladar únicamente los once archivos enumerados al repositorio front; no fusionar el árbol del back con el front. Aplicar después del despliegue del back. No hay cambios de dependencias ni migraciones.

C4 conserva la aceptación fiscal y muestra la reversión local pendiente de la RA. C5 muestra progreso, próxima consulta y agotamiento sin reiniciar el presupuesto. C3 muestra la omisión durable del puente en detalle y Monitor, conserva el resultado fiscal y usa `reprocesar-puente`. C1 no necesita cambios front. C2 usa el mensaje que ya presenta el cliente, sin cambios front.

Validación completa del árbol front: **130 suites / 943 pruebas aprobadas**. `npm run build` aprobado. Lint de archivos cambiados sin errores; advertencia existente de Fast Refresh en el Monitor. Back: **307 suites / 2803 pruebas / 12 snapshots aprobados**, 4 suites / 38 pruebas omitidas; build y TypeScript aprobados. Sin emisiones reales ni PRs.

## Commits de origen y archivos por frente

### C4 — origen front `d71c30e668acd858479623fd6f9f715f212b7f11`

- `src/modules/invoices/components/InvoiceAggregateMonitor.tsx`
- `src/modules/invoices/components/InvoiceAuditTrail.tsx`
- `src/modules/invoices/components/InvoiceCdrModal.tsx`
- `src/modules/invoices/components/InvoiceStatusBadge.tsx`
- `src/modules/invoices/lib/invoiceResultPresentation.ts`
- `src/modules/invoices/types/invoiceAggregate.types.ts`
- `test/unit/modules/invoices/invoicePulidoPresentacion.test.tsx`

### C5 — origen front `cd5c8661a4cf1648c3eabffad4f0f123bffd0776`

- `src/modules/invoices/components/InvoiceAggregateMonitor.tsx`
- `src/modules/invoices/types/invoiceAggregate.types.ts`
- `test/unit/modules/invoices/invoice8cAggregateMonitor.test.tsx`

### C3 — origen front `1f6312ea81b0c608c9e527b4a633d7670b4e8a2a`

- `src/modules/invoices/components/InvoiceAuditTrail.tsx`
- `src/modules/invoices/components/InvoiceCdrModal.tsx`
- `src/modules/invoices/components/InvoiceStatusBadge.tsx`
- `src/modules/invoices/lib/invoiceResultPresentation.ts`
- `src/modules/invoices/pages/InvoiceMonitorPage.tsx`
- `src/modules/invoices/services/invoicesApi.ts`
- `test/unit/modules/invoices/invoice8cBridgePending.test.tsx`

## Archivos finales y SHA-256

| Archivo | SHA-256 |
| --- | --- |
| `src/modules/invoices/components/InvoiceAggregateMonitor.tsx` | `c6d32314117d371e2098d96c283e79349545b1f2b52964c108409890490f1966` |
| `src/modules/invoices/components/InvoiceAuditTrail.tsx` | `2f448dcf66c50564fd12eb60c5cbe70440727e61da0c5144589aa11023db5edb` |
| `src/modules/invoices/components/InvoiceCdrModal.tsx` | `0036390bb8fcacc91ed6269aa3dba9de8f0819e4de8facc116787925cf8dbc5b` |
| `src/modules/invoices/components/InvoiceStatusBadge.tsx` | `99f152e6afb3a479ca94c236c847368be4366966e5e8a6359f5f0ee4ac817d57` |
| `src/modules/invoices/lib/invoiceResultPresentation.ts` | `fa73f3b212f5bb74d102a5fe135297889e9980b7d1e0c8e26376f09cf835d5b3` |
| `src/modules/invoices/pages/InvoiceMonitorPage.tsx` | `1d9d42d6eeedd8d4d6bb1e2dc04ec511ce135a7d20fecc564fbb7c753513aa36` |
| `src/modules/invoices/services/invoicesApi.ts` | `ae386e8786aec241af8a9f0c40f366c376f82a16927c4c7ab538a3cbe2143811` |
| `src/modules/invoices/types/invoiceAggregate.types.ts` | `0e8e19eaf663343868889470c224614bd5f565f9068e827e6007e3c949d77a05` |
| `test/unit/modules/invoices/invoice8cAggregateMonitor.test.tsx` | `af27302b1c2368a77f177366b928997caca4e2105b9b8a1b9ca1cd746faf0436` |
| `test/unit/modules/invoices/invoice8cBridgePending.test.tsx` | `27eeed996b47647e9551b41d3857a9f1ec04b81e4b94700d0d7d2035250c831a` |
| `test/unit/modules/invoices/invoicePulidoPresentacion.test.tsx` | `d2bcd0e40945154db27180865f2214fc00145fec6ed2bec51e75751ba562e0f3` |

Los hashes corresponden al contenido final probado, incluidas las actualizaciones sucesivas de un mismo archivo entre frentes. FERRY.md es el manifiesto de traslado y no se copia al producto front.
