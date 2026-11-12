# Ferry — Bolsas, atajos y miembros de agregados

Base front: `73af439c48d1e8937133b52f8b525bbecfe7540f`. Rama: `ferry/m1-bolsas-atajos-resumenes`.

Transporte publicado en el repositorio del back; aplicar los commits al repositorio del front. No promover esta rama como código del back. No copiar el manifiesto a producción.

## Compatibilidad de base

La promoción de formularios no había llegado a main al sincronizar. Este ferry no incluye ese tren. Si se promueve primero formularios, integrar estos commits y resolver las diferencias compartidas; no sobrescribir archivos completos, pues se perderían sus validaciones. No se cambia el contrato API de emisión ya certificado.

## Alcance

- B1: bolsas sobre la línea del producto, cantidad entera no negativa e impuesto derivado/coincidente. El botón incrementa la línea elegida; se retira el auxiliar de cabecera y el SKU sintético. No se crea un producto ni un precio de bolsa.
- B2: Alt+C/P/L y Ctrl+Enter con ámbito de página; reconocimiento key/code, buscador real, revisión previa, exclusión de otros diálogos y limpieza del listener. El modal conserva su ámbito.
- B3: miembros RA/RC visibles y acceso al detalle existente por id; error visible si falla. Depende de la proyección aditiva del back en la rama hermana.

Sin migraciones, emisiones reales ni PRs. No se construyen las deudas A2/A3/A4/A5 del contraste: crédito de boleta, numeración/detalle del PDF local, etiqueta CDR/RVIE y fila vacía inicial del modal. La descarga local ya obtiene DigestValue del XML firmado; no se altera el QR.

## Validación

Suite completa final: **139 archivos / 986 pruebas aprobadas**. Typecheck `tsc -b` y build Vite aprobados. Focales B1: 21; B2: 7; B3: 5. No se debilitan aserciones: las regresiones antiguas de bolsa sintética se adaptan a cantidad/impuesto sobre el producto y al aviso de SKU desconocido. El fixture nuevo de miembros contiene el número obligatorio del DTO.

## Archivos por commit y SHA-256

Hashes de contenido final. FERRY.md se excluye de su propia tabla para evitar circularidad.

### B1 — 330b88912400e6f02144961aeb0c10ed37afefd7

| Archivo | SHA-256 |
|---|---|
| `src/modules/invoices/components/InvoiceEmitCampos.tsx` | `cf92a04bd20e2791e079c9e1cdca72a9c5872d0150f12ce8f0748fbeef99f6f0` |
| `src/modules/invoices/components/InvoiceEmitCamposTributarios.tsx` | `b4b1a371ebaa66ab92d3714d51389e4e0d4f48ff2e8b5519b3c4b61d1bebc273` |
| `src/modules/invoices/components/InvoiceEmitModal.tsx` | `7ba122680fc740a6454f95a2b97368a6495377b439a65289cef9dcdd309470d5` |
| `src/modules/invoices/components/InvoiceEmitResumen.tsx` | `1d35fcb1c8b3218f9910827cd824c56579fc5b7e50368bed8b1809bfd797731d` |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | `5e7b16840ca3e99907efaa045cfe19c12ffaa2fb19579eed9ec6d33394b61d00` |
| `src/modules/invoices/lib/invoiceBags.ts` | `b94f2188dd17ee2bde57898deb4b1feb55ba91fbf7b5224bb3d497cf7fdf19d3` |
| `src/modules/invoices/lib/invoiceEmitPayload.ts` | `67fdd3b7d8e73dc09ec5cedbef3e924f8a431ea694db309908c804a958b797ef` |
| `src/modules/invoices/lib/invoiceItems.ts` | `b4eb231bfaa4149bcb01cf359bf6e0bf818ebb64ce68f848f77e30867fa3cce1` |
| `src/modules/invoices/lib/invoiceStockLinea.ts` | `d2d9270227228bb7a1e5ac268b0db379157da0809fa8fe99dced676c99df43fd` |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | `013fb280210d3c5fa07f817174f1103cf53f6e76c497be4a67e41a9dc809f424` |
| `src/modules/invoices/types/invoiceEmision.types.ts` | `b29addb433ddf57c520e94fa22e40c9cbedcca8614ca5acec61ea5d47ade3d09` |
| `test/unit/modules/invoices/invoiceBagsRegistered.test.tsx` | `1f089e0ae0f5462a9be5078f3dd2242bec69978e75c7f7dfad38bf592f439287` |
| `test/unit/modules/invoices/invoiceIcbperVias.test.tsx` | `6fa55183fcae817f310919bc1e4a3682a4262741940793d708032bb3d1d6ed60` |
| `test/unit/modules/invoices/invoiceStockEIcbper.test.ts` | `31eec48780f3593644d6eebd829ba6c942c0e5446f0e278979ae75e2e15775fb` |

### B2 — 19c14d54f9d5067995e80a4e7c1d648b6e782cd1

| Archivo | SHA-256 |
|---|---|
| `src/modules/invoices/components/InventoryProductSearchSelect.tsx` | `e206f66141f773d9b9a032963a2095229ef6fe3b42fa7112e4bd47c2d738d002` |
| `src/modules/invoices/components/useInvoiceKeyboard.tsx` | `7804b5045ad270d2353be776a175ef25b9a4bdf1c3ba32f8bcf76245bdc46e16` |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | `013fb280210d3c5fa07f817174f1103cf53f6e76c497be4a67e41a9dc809f424` |
| `test/unit/modules/invoices/invoicePageKeyboard.test.tsx` | `f68c6748cddba440e4f1c5baf7ee280cc9c0a1d3947c990e51d8e92defbf4e59` |

### B3 — este commit (miembros y manifiesto)

| Archivo | SHA-256 |
|---|---|
| `src/modules/invoices/components/InvoiceAggregateMonitor.tsx` | `deb260b287278af6c236a06233c68e9cd07e640cbb9262e7d60b98d041201f3a` |
| `src/modules/invoices/types/invoiceAggregate.types.ts` | `e1bfbd4f89741cc4711d9eb47dd9e87880c78a8cacfebd93a14227870a8543be` |
| `test/unit/modules/invoices/invoiceAggregateMembers.test.tsx` | `5f520cd8e3fe4323e2d19e2f5ffbaacae6ce9cadb5225d20c983651a8d741025` |

B1 y B2 comparten InvoiceEmissionPage.tsx: su hash corresponde a la versión final tras ambos arreglos. El back publica los miembros filtrados por empresa; el front no recibe XML, payload ni datos privados del snapshot.
