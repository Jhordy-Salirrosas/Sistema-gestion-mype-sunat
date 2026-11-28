# Ferry M1 — Formulario único de emisión

## Bases y destino

- Repositorio de destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base exacta de construcción: `main`, `6bfdec27cde81e7686a358ae91057cee410db355`.
- Referencia auditada: `5f07612bf2b6d7c0f0d68c1db5ecc3cac428eb45`, ancestro de la base. No hay diferencias entre ambas revisiones en `src/modules/invoices/`.
- Commit local de implementación: `6edecb4869a0dfe3f3de46d623d04891c7bd6bf8` (sin push al front).
- Rama front sugerida: `fix/m1-formulario-unico`.
- Transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`, rama `ferry/m1-formulario-unico`, desde `07ea5ff9d87b68512209f5da8a2ed862edd94268`.
- Este paquete es independiente del ferry de advertencia de plazo de Detracciones. No incluye cambios de backend ni modificaciones del contrato de emisión.

## Verificación previa y decisiones

1. `InvoiceList` era el único consumidor de producción de `InvoiceEmitModal`. La misma lista sirve a Facturas y Boletas y a Notas. Se retira solamente la apertura del formulario y su cableado exclusivo; la bandeja, sus filtros y el visor de detalle se conservan.
2. La página ya utiliza `useSearchParams` para `tipo`. Se extiende el mecanismo existente a `07` y `08`. El menú navega a `/invoices/emision?tipo=01`, `03` o `07`; la página permite seleccionar también Nota de Débito.
3. Se reutilizan sin modificar `invoiceEmitDraft`, `invoiceNotaOrigen`, `invoiceNoteQuantities`, `invoiceLineasOrigen`, `invoiceDebitAmount`, `invoiceFlujoPago` e `invoiceEmitPayload`. Los controles de Nota y la coordinación de sus lecturas se extraen a `InvoiceNoteFields` y `useInvoiceNoteEmission`; no queda otra cáscara de emisión.

## Resultado

La página ofrece el documento afectado aceptado/observado, su cliente, motivo, saldo y líneas históricas, incluyendo el límite de unidades y la adaptación de serie FC/BC o FD/BD. Conserva la consulta de saldo al confirmar, las guardas de importes y cantidades, Otros conceptos con sustento y el tratamiento de cuotas del motivo 13. Bonificación continúa sin habilitarse.

La nota utiliza el borrador local y el paso de revisión existentes. Recuperar el borrador conserva origen, motivo, descuentos, cantidades y cuotas; las respuestas tardías de precarga y los refrescos de saldo no sobrescriben líneas ya editadas. Tras un alta se invalida la consulta de la bandeja, como hacía el cierre del modal anterior.

Factura y Boleta conservan sus controles, etiquetas integradas, liquidación, permisos, atajos e idempotencia. Los estilos nuevos se restringen a los controles propios de Nota. `InvoiceCdrModal` no se modifica. `InvoiceEmitCamposBase` permanece porque su selector compartido sigue usándose.

## Aplicación del transporte

1. Crear la rama front sugerida desde la base indicada.
2. Copiar el contenido de `frontend/` a la raíz del repositorio front, respetando las rutas.
3. Eliminar en el front los **seis archivos** listados en `DELETE_PATHS.txt`. Cuatro son componentes de la cáscara retirada y dos son suites exclusivas de ella. La ausencia de esos archivos en `frontend/` por sí sola no los elimina del destino.
4. Ejecutar la suite y el build del front.

`FERRY.md`, `DELETE_PATHS.txt` y `SHA256SUMS` son metadatos de transporte: no se copian a producción. Verificar desde la raíz del ferry con `sha256sum -c SHA256SUMS`.

## Verificaciones

- Base: suite completa **228 archivos / 1703 pruebas**, verde.
- Resultado final: **227 archivos / 1654 pruebas**, verde. Diferencia: −1 archivo y −49 pruebas; se retiraron 71 casos de la cáscara anterior o duplicados y se incorporaron 22 casos nuevos.
- Se retiran las pruebas exclusivas de la cáscara eliminada y los casos duplicados Modal/Página; se conservan los casos de dominio y los de la página. Se incorporan 16 casos del modo Nota en la página y seis casos de navegación desde ambas bandejas.
- Las cuatro combinaciones Nota de Crédito/Débito sobre Factura/Boleta comparan el payload completo contra el traductor compartido anterior. Se comprueban saldo insuficiente, revalidación al confirmar, límites de unidades, respuestas tardías, cuotas, sustento y borrador/revisión. Solo se utilizan dobles; no se realizan emisiones reales.
- `npm run build`: OK (`tsc -b` y Vite).
- Lint: base **216 errores / 27 advertencias**; resultado **211 errores / 25 advertencias**, sin hallazgos nuevos al comparar ruta, regla y mensaje. El comando continúa devolviendo error por los hallazgos heredados; no se declara lint verde.
- Chromium local con respuestas controladas, 1440 px y menú lateral abierto: Factura, Boleta, Nota de Crédito y Nota de Débito. Ancho del contenido 1169 px y ancho desplazable 1169 px; documento 1440 px, sin desbordamiento horizontal. Origen, motivo y serie visibles con etiquetas integradas. Se verificó la revisión de la Nota en el modal de revisión existente, sin emitir. Evidencia local: `unico-page-01.png`, `unico-page-03.png`, `unico-page-07.png`, `unico-page-08.png`, `unico-review-note.png` y `unico-layout.json` (no son archivos de producción).

## Archivos del cambio (+/− respecto de la base front)

Incluye eliminaciones, indicadas también en `DELETE_PATHS.txt`.

| Ruta en el front | Diff |
| --- | ---: |
| `src/modules/invoices/InvoiceList.tsx` | +5 / −65 |
| `src/modules/invoices/components/InvoiceEmitCampos.tsx` | +0 / −338 |
| `src/modules/invoices/components/InvoiceEmitCamposTributarios.tsx` | +0 / −85 |
| `src/modules/invoices/components/InvoiceEmitModal.tsx` | +0 / −580 |
| `src/modules/invoices/components/InvoiceEmitResumen.tsx` | +0 / −125 |
| `src/modules/invoices/components/InvoiceNoteFields.tsx` | +105 / −0 |
| `src/modules/invoices/components/invoiceIntegratedFields.css` | +27 / −0 |
| `src/modules/invoices/hooks/useInvoiceNoteEmission.ts` | +67 / −0 |
| `src/modules/invoices/lib/invoiceFormIssues.ts` | +4 / −3 |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | +103 / −54 |
| `test/unit/modules/invoices/customerMaster.test.tsx` | +6 / −46 |
| `test/unit/modules/invoices/invoice8eCustomerIdentity.test.tsx` | +14 / −16 |
| `test/unit/modules/invoices/invoiceAddFocus.test.tsx` | +5 / −27 |
| `test/unit/modules/invoices/invoiceBagsRegistered.test.tsx` | +13 / −16 |
| `test/unit/modules/invoices/invoiceBandejaModal.test.tsx` | +10 / −1 |
| `test/unit/modules/invoices/invoiceCazaForm.test.tsx` | +15 / −57 |
| `test/unit/modules/invoices/invoiceCierre6cCarga.test.tsx` | +7 / −9 |
| `test/unit/modules/invoices/invoiceCierre6cTraduccion.test.tsx` | +2 / −8 |
| `test/unit/modules/invoices/invoiceClienteBusqueda.test.tsx` | +5 / −29 |
| `test/unit/modules/invoices/invoiceEmissionNotesPage.test.tsx` | +105 / −0 |
| `test/unit/modules/invoices/invoiceEmptyRow.test.tsx` | +5 / −16 |
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
| `test/unit/modules/invoices/p9-campos.test.tsx` | +0 / −24 |
| `test/unit/modules/invoices/p9-close.test.tsx` | +13 / −28 |
| `test/unit/modules/invoices/p9-form-wiring.test.tsx` | +8 / −16 |
| `test/unit/modules/invoices/retencionSinGravada.test.tsx` | +7 / −28 |
