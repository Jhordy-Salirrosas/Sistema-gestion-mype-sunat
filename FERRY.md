# Ferry M1 — precio de venta real y almacén explícito

Copiar SOLO los archivos front del manifest a sus rutas exactas en el repositorio
front. Esta rama del back transporta el front; no fusionar su árbol back en el front.

- Base front dev: `7b60fe484e71bf303c4d6c6c22225377b710f0de`.
- Commit front local probado: `3ddcb972a2b56af126d4bb7df323637b5c42ff73` (sin push directo).
- Dependencia back: `e332819541d87fa75714c66c057d3b9cce2d1682`, rama `fix/m1-precio-venta-almacen`, base dev `af8584af25c456c19c31f8227d328eff65269bad`.
- Catálogo M1: GET /invoices/products?almacen=ALM-01 devuelve balances con salePrice (precio FINAL PEN con IGV), vendible y motivo. NULL/no positivo no se ofrece; nunca se recurre al costo promedio. Back rechaza precio sin configurar u obsoleto antes de numerar. Notas conservan precios del origen.
- Almacenes activos: GET /invoices/warehouses. ALM-01 inicial explícito; el código elegido viaja como almacen a emitir y se congela en payload_ubl. Stock, Kardex y costo usan ese almacén; no cambia la lógica de Contabilidad.
- Configuración → Precios de venta, ruta /invoices/configuracion/precios, solo ADMIN. PATCH existente /inventory/stocks/products/:sku con solo sale_price. No se modifica Inventario ni se crea una tabla paralela.
- Front base: 100 archivos / 788 pruebas; final: 101 archivos / 797 pruebas en verde; build aprobado. Lint global conserva exactamente 64 errores / 25 avisos de la base (ninguno nuevo).
- Back base: 259 suites / 2393 pruebas aprobadas; final: 260 suites / 2407 pruebas aprobadas. En ambos: 1 suite / 2 pruebas fallidas conocidas de Compras, 4 suites / 38 pruebas omitidas. 12 snapshots fiscales intactos. Cobertura local nueva instrumentada 100% (18 líneas y 29 resultados de condiciones). Lint back aprobado; build hereda únicamente listPayables inexistente en el puente de Compras.
- Documentación y deudas ajenas: docs/m1/auditoria-solucion.md del commit back. Sin migraciones nuevas, datos retroactivos, emisiones ni llamadas reales a SUNAT, PR, fusiones o despliegues. Los precios demo quedan para carga posterior por Emma.

## Manifest front (20 archivos, verificados idénticos al clon probado)

- `src/modules/invoices/InvoiceList.tsx`
- `src/modules/invoices/components/InvoiceEmitModal.tsx`
- `src/modules/invoices/components/InvoiceWarehouseSelect.tsx`
- `src/modules/invoices/lib/invoiceEmitDraft.ts`
- `src/modules/invoices/lib/invoiceEmitPayload.ts`
- `src/modules/invoices/lib/invoiceItems.ts`
- `src/modules/invoices/lib/invoiceSearch.ts`
- `src/modules/invoices/pages/InvoiceEmissionPage.tsx`
- `src/modules/invoices/pages/InvoicePricesPage.tsx`
- `src/modules/invoices/pages/InvoiceSettingsPage.tsx`
- `src/modules/invoices/services/inventoryProductsApi.ts`
- `src/modules/invoices/types/invoiceEmision.types.ts`
- `src/routes/appRoutes.tsx`
- `test/unit/modules/invoices/inventoryProductsApi.test.ts`
- `test/unit/modules/invoices/invoiceClienteBusqueda.test.tsx`
- `test/unit/modules/invoices/invoiceEmitPayload.test.ts`
- `test/unit/modules/invoices/invoiceIdempotencyForm.test.tsx`
- `test/unit/modules/invoices/invoicePricesWarehouse.test.tsx`
- `test/unit/modules/invoices/invoiceRetencionUnificada.test.tsx`
- `test/unit/modules/invoices/invoiceSpotCentimos.test.tsx`
