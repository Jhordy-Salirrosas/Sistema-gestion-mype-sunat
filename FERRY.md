# Ferry M1 — Formulario de notas integrado en Notas

## Base y destino

- Front: `CarlosSoles/Fronted-sistema-mype-sunat`, base exacta `main` en `6bfdec27cde81e7686a358ae91057cee410db355`.
- Commit local de implementación (sin push al front): `c4db4715df42c87840b6335c0dc8159d4ade07cf`.
- Rama front sugerida: `fix/m1-notas-formulario-integrado`.
- Transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`, rama `ferry/m1-notas-formulario-integrado`, desde `07ea5ff9d87b68512209f5da8a2ed862edd94268`.
- **Paquete completo que sustituye** a `ferry/m1-formulario-unico` (`c9ac080c42e48fe791a4c1d51181edd6d68b3dc4`). No debe combinarse con el ferry anterior: aplicar este estado completo sobre la base indicada.
- No incluye cambios de backend, servicios ni contrato de payload. No se crea PR ni se hace push al front.

## Paso 0: veredictos

1. `/invoices/notas` y `/invoices/facturas` renderizan `InvoiceList`; la sección se obtiene de la ruta mediante `sectionFromPath`. La composición coincide con el contexto.
2. El formulario integrado anterior puede compartirse completo: `InvoiceEmissionForm` contiene una única implementación del estado, borrador, revisión, guardas y envío. `InvoiceEmissionPage` lo compone con su cabecera habitual; `InvoiceList` lo compone únicamente en Notas con `soloNotas`.
3. Se reutilizan `InvoiceNoteFields`, `useInvoiceNoteEmission` y las bibliotecas de origen, cantidades, líneas, importes y payload del paquete anterior. No se duplican controles ni lógica de emisión para Notas.
4. La causa adicional de scroll en la lista era la regla común `max-height:65vh; overflow:auto` del contenedor de tablas. Se neutraliza exclusivamente bajo `.m1-notas-integradas`; las tablas de notas se ajustan al ancho disponible. No se modifica `AppLayout`, que conserva el único desplazamiento del contenido.

## Estado final

- Facturas y Boletas queda como consulta: filtros, tabla y detalle, sin botón ni menú de emisión.
- Notas muestra primero el formulario de dos columnas con etiquetas integradas y liquidación. Su selector solo ofrece Nota de Crédito y Nota de Débito. Debajo quedan los filtros y las listas de notas de crédito/débito emitidas, con su detalle habitual.
- El formulario comparte el mismo componente con la página Emisión. La página conserva Factura, Boleta y el modo Nota del paquete anterior, con borrador local y revisión. El formulario incrustado también conserva borrador y revisión; usa una clave de borrador separada (`m1:emision-notas:v1:empresa:usuario`) para no sobrescribir el borrador de Emisión (`m1:emision:v1:empresa:usuario`). No se alteran los payloads.
- Se conservan las series FC/BC y FD/BD, el cliente del origen, los motivos, los saldos, los límites de cantidades y la revalidación al confirmar, así como cuotas y sustento del paquete anterior. Filtrar la lista no reinicia el formulario.
- `InvoiceEmitModal` y sus tres piezas exclusivas siguen retirados. También se retiran `InvoiceEmitMenu` y su mapa exclusivo de opciones, que ya no tienen consumidores. `InvoiceCdrModal` y la librería `invoiceEmitPayload` permanecen idénticos a la base.

## Verificaciones

- Base `6bfdec27`: **228 archivos / 1703 pruebas**, verde, medida en el encargo anterior sobre la misma base.
- Ferry anterior validado: **227 archivos / 1654 pruebas**, verde.
- Estado final: **227 archivos / 1655 pruebas**, verde (una prueba más que el ferry anterior, sin cambios en el número de archivos de prueba).
- Respecto del ferry anterior se retiran seis casos de navegación del menú y un caso exclusivo del menú abierto. Se agregan dos casos de ausencia del menú, cuatro combinaciones de emisión incrustada (NC/ND sobre Factura/Boleta), un caso de filtros sin reinicio del formulario y un caso adicional de recuperación del borrador incrustado.
- La cobertura mantiene los tests de la página y compara el payload completo de las ocho combinaciones página/Notas × NC/ND × Factura/Boleta. Incluye saldos, cantidades, revalidación, precargas tardías, cuotas, sustento, borrador y revisión. Se utilizan dobles; no hay emisiones reales.
- Build: `npm run build` OK (`tsc -b` y Vite).
- Lint: **211 errores / 25 advertencias**, frente a 216/27 de la base; sin hallazgos nuevos. Los cuatro diagnósticos previos del formulario se trasladan de `InvoiceEmissionPage` a `InvoiceEmissionForm` al extraerlo; no son reglas ni conductas nuevas. La comparación normaliza este traslado y contrasta regla y mensaje.
- Chromium local con datos controlados: pantalla completa con menú lateral abierto a 1440 px; también 1100 y 390 px. Hay un solo formulario, solo tipos `07/08` y ningún botón `Emitir Comprobante` en las listas. Con 24 notas, **ningún elemento dentro del contenido tiene desplazamiento vertical propio**. Contenedores de tablas con `max-height:none` y `overflow-y:visible`; alto real igual al desplazable. Sin desbordamiento horizontal (documento 1440/1100/390 px respectivamente). El desplazamiento lo tiene el contenedor de contenido de `AppLayout`; la navegación lateral conserva su comportamiento habitual.
- Evidencia local de navegador: `notas-integradas-layout.json`, `notas-integradas-form-1440.png`, `notas-integradas-list-1440.png` y capturas a 1100/390 px. Las capturas no se transportan a producción. Las ventanas modales de revisión y detalle conservan su comportamiento de diálogo; no son paneles anidados del formulario/lista.

## Aplicación

1. Crear la rama front sugerida desde la base exacta indicada.
2. Copiar el contenido de `frontend/` a la raíz del front, respetando las rutas.
3. Eliminar los **ocho archivos** de `DELETE_PATHS.txt`. La ausencia en la carpeta transportada no los elimina automáticamente del destino.
4. Ejecutar la suite y el build.

Se comprobó la reconstrucción desde la base mediante índice Git temporal: copiar estos 43 archivos y aplicar las ocho eliminaciones produce exactamente el árbol `b242ddc1b81063fd13f4ef34d59a14e449c0b0c6`, igual al árbol del commit local final.

Verificar los hashes desde la raíz de este ferry con `sha256sum -c SHA256SUMS`. `FERRY.md`, `SHA256SUMS` y `DELETE_PATHS.txt` son solo transporte; no forman parte del cambio a producción.

## Archivos (+/− respecto de la base front)

La extracción de `InvoiceEmissionForm` se expresa como archivo nuevo y reducción de la página, para que las rutas de copia sean explícitas. Se incluyen las eliminaciones del paquete completo.

| Ruta en el front | Diff |
| --- | ---: |
| `src/modules/invoices/InvoiceList.tsx` | +13 / −69 |
| `src/modules/invoices/components/InvoiceEmissionForm.tsx` | +923 / −0 |
| `src/modules/invoices/components/InvoiceEmitCampos.tsx` | +0 / −338 |
| `src/modules/invoices/components/InvoiceEmitCamposTributarios.tsx` | +0 / −85 |
| `src/modules/invoices/components/InvoiceEmitMenu.tsx` | +0 / −59 |
| `src/modules/invoices/components/InvoiceEmitModal.tsx` | +0 / −580 |
| `src/modules/invoices/components/InvoiceEmitResumen.tsx` | +0 / −125 |
| `src/modules/invoices/components/InvoiceFiltersBar.tsx` | +1 / −16 |
| `src/modules/invoices/components/InvoiceNoteFields.tsx` | +105 / −0 |
| `src/modules/invoices/components/invoiceIntegratedFields.css` | +27 / −0 |
| `src/modules/invoices/components/invoiceUx.css` | +5 / −0 |
| `src/modules/invoices/hooks/useInvoiceNoteEmission.ts` | +67 / −0 |
| `src/modules/invoices/lib/invoiceEmitTipos.ts` | +0 / −14 |
| `src/modules/invoices/lib/invoiceFormIssues.ts` | +4 / −3 |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | +7 / −876 |
| `test/unit/modules/invoices/customerMaster.test.tsx` | +6 / −46 |
| `test/unit/modules/invoices/invoice8eCustomerIdentity.test.tsx` | +14 / −16 |
| `test/unit/modules/invoices/invoiceAddFocus.test.tsx` | +5 / −27 |
| `test/unit/modules/invoices/invoiceBagsRegistered.test.tsx` | +13 / −16 |
| `test/unit/modules/invoices/invoiceBandejaModal.test.tsx` | +12 / −0 |
| `test/unit/modules/invoices/invoiceCazaForm.test.tsx` | +15 / −57 |
| `test/unit/modules/invoices/invoiceCierre6cCarga.test.tsx` | +7 / −9 |
| `test/unit/modules/invoices/invoiceCierre6cTraduccion.test.tsx` | +2 / −8 |
| `test/unit/modules/invoices/invoiceClienteBusqueda.test.tsx` | +5 / −29 |
| `test/unit/modules/invoices/invoiceDateForms.test.tsx` | +1 / −1 |
| `test/unit/modules/invoices/invoiceEmissionNotesPage.test.tsx` | +126 / −0 |
| `test/unit/modules/invoices/invoiceEmptyRow.test.tsx` | +5 / −16 |
| `test/unit/modules/invoices/invoiceFiltroFechasUi.test.tsx` | +1 / −1 |
| `test/unit/modules/invoices/invoiceFormValidation.test.tsx` | +14 / −18 |
| `test/unit/modules/invoices/invoiceIdempotencyForm.test.tsx` | +23 / −30 |
| `test/unit/modules/invoices/invoiceIgvReferencial.test.tsx` | +2 / −14 |
| `test/unit/modules/invoices/invoiceLineFields.test.tsx` | +4 / −20 |
| `test/unit/modules/invoices/invoiceNotaSaldo.test.tsx` | +2 / −56 |
| `test/unit/modules/invoices/invoiceNotasErrorVisible.test.tsx` | +4 / −34 |
| `test/unit/modules/invoices/invoiceNotasLineasOrigen.test.tsx` | +0 / −61 |
| `test/unit/modules/invoices/invoiceNotasPrecargaCapada.test.tsx` | +4 / −45 |
| `test/unit/modules/invoices/invoiceNoteQuantities.test.tsx` | +6 / −52 |
| `test/unit/modules/invoices/invoicePageAddSearch.test.tsx` | +13 / −14 |
| `test/unit/modules/invoices/invoicePageKeyboard.test.tsx` | +8 / −13 |
| `test/unit/modules/invoices/invoicePulido6bNumero.test.tsx` | +5 / −6 |
| `test/unit/modules/invoices/invoicePulido6bPago.test.tsx` | +3 / −14 |
| `test/unit/modules/invoices/invoicePulidoClienteEmision.test.tsx` | +12 / −16 |
| `test/unit/modules/invoices/invoiceRetencionUnificada.test.tsx` | +4 / −26 |
| `test/unit/modules/invoices/invoiceServerPermissions.test.tsx` | +13 / −15 |
| `test/unit/modules/invoices/invoiceSpotCentimos.test.tsx` | +6 / −34 |
| `test/unit/modules/invoices/invoiceTa63Selector.test.tsx` | +13 / −19 |
| `test/unit/modules/invoices/m1UxFilters.test.tsx` | +1 / −1 |
| `test/unit/modules/invoices/p9-campos.test.tsx` | +0 / −24 |
| `test/unit/modules/invoices/p9-close.test.tsx` | +14 / −34 |
| `test/unit/modules/invoices/p9-form-wiring.test.tsx` | +8 / −16 |
| `test/unit/modules/invoices/retencionSinGravada.test.tsx` | +7 / −28 |
