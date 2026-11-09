# Ferry M1 — agregados RA/RC

Parte 2A. Copiar únicamente los archivos front enumerados, en sus rutas exactas, al clon front. No copiar el resto del repositorio back.

Base front: `204d3da6e620f80d0533debc8b629e2bf3a3a574`. Commit front local: `4fbd9d7`. Dependencia back: `4ee06ba` y su migración aditiva (aplicación por Emma).

Validación: 99 archivos / 784 pruebas; build aprobado. Sin llamadas reales a SUNAT.

Archivos:

- `src/modules/invoices/components/EnviarBajaPanel.tsx`
- `src/modules/invoices/components/InvoiceAggregateMonitor.tsx`
- `src/modules/invoices/pages/InvoiceBajasPage.tsx`
- `src/modules/invoices/pages/InvoiceMonitorPage.tsx`
- `src/modules/invoices/services/invoicesApi.ts`
- `src/modules/invoices/types/invoiceAggregate.types.ts`
- `test/unit/modules/invoices/invoiceBajaEnvio.test.tsx`
- `test/unit/modules/invoices/invoiceMonitorRetry.test.tsx`
