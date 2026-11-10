# Ferry M1 — timeout de consulta de ticket RA/RC

Copiar únicamente los archivos front del manifest a sus rutas exactas en el repositorio front. Esta rama del back es transporte de archivos front; no integrar el resto del backend al front.

- Base front dev: `87a980d771d4a31c66d4b44a006c6871cd7f6d1c`.
- Commit front local probado: `27cc53116863240dc060a3d02afd9cb7e6429372`. Sin push al repositorio front.
- Dependencia back: `8bad292`, rama `fix/m1-resumenes-timeout`, basada en `cb878d9f`.
- API Consultar ticket: timeout propio 120000 ms; global Axios permanece 15000. Monitor muestra Consultando… hasta respuesta/error y evita duplicados.
- Front base: 99 archivos / 785 pruebas; final: 100 archivos / 788 pruebas. Build y lint de archivos modificados aprobados.
- Back final: 258 suites / 2374 pruebas, 12 snapshots; 4 suites / 38 pruebas omitidas. Timeout resumen 90000 por defecto y sondeo diferido 5/15/30/60 min hasta 24 intentos programados, usando siempre ticket guardado.
- Excepción autorizada por Jhordy el 9 Nov: únicamente encolarResumen acepta startAfter opcional. Constancia para Oliver en docs/m1/auditoria-solucion.md del back.
- Los trabajos históricos ya agotados en DLQ no se reactivan con este cambio; la consulta manual queda disponible. Sin migraciones nuevas, llamadas reales a SUNAT, PR, fusiones ni despliegues.

Manifest front:

- `src/modules/invoices/components/InvoiceAggregateMonitor.tsx`
- `src/modules/invoices/services/invoicesApi.ts`
- `test/unit/modules/invoices/invoiceBajaEnvio.test.tsx`
- `test/unit/modules/invoices/summaryTicketTimeout.test.ts`
