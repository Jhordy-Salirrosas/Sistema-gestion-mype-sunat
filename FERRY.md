# Ferry — Semana Cueva, paquete 4

Back: `feat/cueva-cierre`, base `646fa51a9e1862efc9265c529d0d33b81f44d978`.
Front: CarlosSoles/Fronted-sistema-mype-sunat, base `4fb2d30f841a374ce53efc57d790832b52c68510`.

Aplicar después de la entrega de roles administrables. No se modifican sus
fuentes ni pruebas. No hay PR ni merge de esta entrega.

## Aplicación e inventario

Ejecutar `sha256sum -c SHA256SUMS` en la raíz del back. **Copiar exclusivamente
los archivos frontend/ enumerados en SHA256SUMS**, quitando ese prefijo, sobre
el front. El espejo del back contiene también archivos heredados de ferries
anteriores que no pertenecen al delta de este paquete: no copiarlos ni borrarlos
en el front. FERRY.md y SHA256SUMS son manifiestos de este paquete y su
composición en el back debe respetar la secuencia de entregas.

API nueva consumida: GET/PUT `/invoices/commercial-defaults` por la
configuración comercial y los formularios de emisión; POST
`/invoices/connection-test` por el diagnóstico SUNAT; GET
`/configuration/links` por la agrupación ADMIN. PUT y diagnósticos requieren
ADMIN. Los endpoints existentes de configuración y alta de cliente conservan
su contrato. El SQL aditivo se entrega en scripts/manual; no se aplica a bases
compartidas. Consultar docs/m1/cueva-cierre.md para validación, detenciones y
conteos finales.

Archivos del delta:

- `src/modules/invoices/components/InvoiceCommercialDefaults.tsx`
- `src/modules/invoices/components/InvoiceEmitModal.tsx`
- `src/modules/invoices/components/InvoiceIssuerConfigForm.tsx`
- `src/modules/invoices/components/SunatConnectionTest.tsx`
- `src/modules/invoices/hooks/useCommercialDefaults.ts`
- `src/modules/invoices/pages/InvoiceEmissionPage.tsx`
- `src/modules/invoices/pages/InvoiceSettingsPage.tsx`
- `test/unit/modules/invoices/cueva-commercial-defaults.test.ts`
- `test/unit/modules/invoices/cueva-connection.test.tsx`
