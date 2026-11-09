# Ferry M1 — agregados RA/RC (2A y 2B)

Rama de transporte front en el repositorio back. Copiar únicamente los archivos enumerados, en sus rutas exactas, al clon front; no integrar el resto del back como front.

Base front: `204d3da6e620f80d0533debc8b629e2bf3a3a574`.

- 2A: commit front local `4fbd9d7`; depende de back `4ee06ba` y su migración aditiva `20261110000000_m1_invoice_aggregates` (aplicación compartida por Emma). Selección RA, motivos y Monitor. Pruebas: 99 archivos / 784 pruebas.
- 2B: commit front local `7903a1d`; depende de back `a5e5c57` sobre 2A. RC con confirmación y motivo real, false explícito de reenviable respetado, Monitor RA/RC. Pruebas finales: 99 archivos / 785 pruebas; build y lint de archivos modificados aprobados.

Backend final: 252 suites / 2222 pruebas aprobadas (3 suites / 18 pruebas omitidas), 6 snapshots; XSD+XSL reales locales para RA y RC firmados con certificado ficticio. Sin llamadas reales a SUNAT. Sin PR, fusiones ni despliegue.

Restos: incertidumbre sin ticket requiere conciliación externa, nunca reenvío automático; credenciales/RUC coherentes y aplicación de la migración son requisitos previos de integración. Detalle en docs/m1/auditoria-solucion.md del backend.

Manifest acumulativo (archivos front):

- `src/modules/invoices/components/EnviarBajaPanel.tsx`
- `src/modules/invoices/components/EnviarResumenDiarioBoton.tsx`
- `src/modules/invoices/components/InvoiceAggregateMonitor.tsx`
- `src/modules/invoices/lib/invoiceResumenes.ts`
- `src/modules/invoices/pages/InvoiceBajasPage.tsx`
- `src/modules/invoices/pages/InvoiceMonitorPage.tsx`
- `src/modules/invoices/services/invoicesApi.ts`
- `src/modules/invoices/types/invoiceAggregate.types.ts`
- `test/unit/modules/invoices/EnviarResumenDiarioBoton.test.tsx`
- `test/unit/modules/invoices/invoiceBajaEnvio.test.tsx`
- `test/unit/modules/invoices/invoiceMonitorRetry.test.tsx`
- `test/unit/modules/invoices/invoiceResumenes.test.ts`
