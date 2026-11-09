# Ferry — segunda auditoría M1, Parte 3 PARCIAL

Repositorio fuente: https://github.com/CarlosSoles/Fronted-sistema-mype-sunat.git
Base de este diff: 15868aa0062f0a3e02441af5dd08789b29e8dbc7 (ferry Parte 1).
Base original de main: c22b923272e0de9248a8bcc32f10237e636e7f6d.
Transporte: repo del back, rama ferry/m1-auditoria-2-parte3.
Emma debe aplicar primero la Parte 1 y después este diff al frontend.
No fusionar esta rama de archivos frontend en el backend.

Alcance: 3.1 (crédito estricto, código fiscal real, unidad sin sustitución,
series desde Configuración en página y modal y entorno ausente como null).
La otra mitad del commit de Parte 3 en fix/m1-auditoria-2 añade el aviso RA/RC
previo a firmar/encolar, sin desbloquear Resiliencia.
FUERA: 3.3 y tratamiento completo de gratuitas/stock agregado de 3.4.
La diferencia de precisión está documentada en docs/m1/auditoria-solucion.md
(del backend). No se cambian reglas SPOT ni OBSERVADO como origen.

Validación frontend: 96 archivos / 766 pruebas aprobados, build aprobado.
Lint global NO aprobado: 63 errores y 25 advertencias heredados; comparación
con la base de Parte 1 sin nuevos diagnósticos por archivo/regla.
RECTIFICACIÓN de FERRY.md de Parte 1: allí se informó incorrectamente lint
aprobado; sus suites y build sí pasaron, pero lint ya tenía estos diagnósticos.

Rutas exactas del diff que debe trasladar Emma (FERRY.md es solo metadato):

- src/modules/invoices/InvoiceList.tsx
- src/modules/invoices/components/CustomerLookupField.tsx
- src/modules/invoices/components/InvoiceEmitCampos.tsx
- src/modules/invoices/components/InvoiceEmitModal.tsx
- src/modules/invoices/components/InvoiceIssuerConfigForm.tsx
- src/modules/invoices/hooks/useInvoiceConfig.ts
- src/modules/invoices/lib/invoiceEmitPayload.ts
- src/modules/invoices/lib/invoiceItems.ts
- src/modules/invoices/lib/invoiceSearch.ts
- src/modules/invoices/pages/InvoiceEmissionPage.tsx
- src/modules/invoices/services/inventoryProductsApi.ts
- test/unit/modules/invoices/customerMaster.test.tsx
- test/unit/modules/invoices/inventoryProductsApi.test.ts
- test/unit/modules/invoices/invoiceCazaForm.test.tsx
- test/unit/modules/invoices/invoiceClienteBusqueda.test.tsx
- test/unit/modules/invoices/invoiceD1Config.test.tsx
- test/unit/modules/invoices/invoiceEmitPayload.test.ts
- test/unit/modules/invoices/invoiceIdempotencyForm.test.tsx
- test/unit/modules/invoices/invoiceItemsFromProduct.test.ts
- test/unit/modules/invoices/invoiceNotaSaldo.test.tsx
- test/unit/modules/invoices/invoiceNotasLineasOrigen.test.tsx
- test/unit/modules/invoices/invoiceRetencionUnificada.test.tsx
- test/unit/modules/invoices/invoiceSpotCentimos.test.tsx
- test/unit/modules/invoices/invoiceTa63Selector.test.tsx
- test/fixtures/invoiceSeries.ts

Los cambios en pruebas de notas, retención y SPOT declaran sus series ficticias
explícitamente para los formularios; no modifican reglas de esos flujos.
Sin llamadas SUNAT, PR, merge, despliegues ni migraciones aplicadas.
