# FERRY — Parte 8E: presentación

Rama: `ferry/m1-8e-presentacion`.
Base front: `1f03cbd73026f79f53c303162f5299996b369d9e`.
Base back y de esta rama ferry: `76e043eb4d0b9dd1cbf20af34d898e35c81cc440`.
Árbol de origen front probado: `f96875cdbec9dd844c93e93d395526c38b1910ff`.
Back requerido: `fix/m1-8e-presentacion` en `dde755fc5da903f7ea6c24563c1817dc46a23502`.

Esta rama transporta archivos front en sus rutas originales sobre una base back. Trasladar únicamente los dieciocho archivos enumerados al repositorio front, después de aplicar el back; no fusionar el árbol back con el front. FERRY.md es el manifiesto y no se copia al producto. Sin cambios de dependencias ni migraciones.

E1 es la corrección fronteriza expresamente autorizada en Inventario por su relación directa con M1: formatea referencias de vistas y exportaciones sin alterar movimientos, cantidades, costos o datos guardados. E2 solo modifica la generación back de glosas nuevas; no renombra el asiento histórico 63. E3 alinea la edición del valor sin IGV con precio, total y payload, conservando referencia gratuita y precio cero. E4 invalida conjuntamente la identidad confirmada al editarla en ambos formularios y conserva la entrada manual. CustomerLookupField y sus defensas de sugerencias permanecen intactos.

## Verificación final

- Front: **134 suites / 967 pruebas aprobadas**; build `npm run build` aprobado.
- Back: **314 suites / 2931 pruebas / 12 snapshots aprobados**; 4 suites / 38 pruebas omitidas; build `npx nest build` aprobado.
- Lint back sin errores y dos advertencias previas de 8C. Lint de los archivos front transportados conserva seis errores/cuatro advertencias anteriores: comparación por archivo/regla/severidad sin diagnósticos nuevos. No se añadieron supresiones.
- Sin emisiones reales, PRs, migraciones ni cambios de datos históricos.

## Commits back por frente

| Frente | Commit | Alcance back |
| --- | --- | --- |
| E1 | `23ec26f91ee4f24901008b2c5ed6ab30222c70c8` | PLE y regresiones de Inventario |
| E2 | `415e4339bbd4e8e2ac9abcbc20878c721c888b1e` | Glosa de reversión y regresiones |
| E3 | `d5e79503695e0c423739e822d855cdbd79453c57` | Documentación; producto en front |
| E4 | `2b4cebb2d2d6f2d369f360215667be1071dad5dc` | Documentación y cierre; producto en front |

## Origen front y archivos por frente

### E1 — `47e85bbc58995032bc5507bf13cb965190658653`

- `src/modules/inventory/components/MovementDetailModal.tsx`
- `src/modules/inventory/components/PleExportModal.tsx`
- `src/modules/inventory/lib/documentReference.ts`
- `src/modules/inventory/pages/ElectronicBooksPage.tsx`
- `src/modules/inventory/pages/InventoryConfigPage.tsx`
- `src/modules/inventory/pages/InventoryKardexPage.tsx`
- `src/modules/inventory/pages/InventoryMovementsPage.tsx`
- `src/modules/inventory/pages/ProductKardexPage.tsx`
- `test/unit/modules/inventory/inventory8eDocumentReference.test.tsx`

### E3 — `1c75bcf53381c29b2e2604a7d69c17091878ad80`

- `src/modules/invoices/components/InvoiceItemsGrid.tsx`
- `src/modules/invoices/lib/invoiceItems.ts`
- `test/unit/modules/invoices/invoice8eUnitValue.test.tsx`
- `test/unit/modules/invoices/invoiceItemsLayout.test.tsx`
- `test/unit/modules/invoices/invoiceNotasLineasOrigen.test.tsx`

### E4 — `abe1a815fa3d618709917923032e7ae97bec580f`

- `src/modules/invoices/components/InvoiceEmitCampos.tsx`
- `src/modules/invoices/lib/invoiceCustomerIdentity.ts`
- `src/modules/invoices/pages/InvoiceEmissionPage.tsx`
- `test/unit/modules/invoices/invoice8eCustomerIdentity.test.tsx`

E2 no requiere archivos front. El manifiesto se incorpora al commit E4 del ferry.

## Archivos finales y SHA-256

| Archivo | SHA-256 |
| --- | --- |
| `src/modules/inventory/components/MovementDetailModal.tsx` | `262580b3a4227c000eef42559be9bfb613a927c880d6c5ea0fb22caa7a6d9045` |
| `src/modules/inventory/components/PleExportModal.tsx` | `aac684d201b55de40bbc3c8293474f0dcd090daf883d5d1a521d65988b0ab74e` |
| `src/modules/inventory/lib/documentReference.ts` | `cec1c143a398742419df4607cb5a4569408b22ee4d7cf1b4b0a39354069d3083` |
| `src/modules/inventory/pages/ElectronicBooksPage.tsx` | `0b28e1c2974bf6466265af6bf739af14b61322cb7cd7608a996b691e36b444e2` |
| `src/modules/inventory/pages/InventoryConfigPage.tsx` | `a763e6ebec78cd51fc2299dd6e295baa1b3dbe0e74d486d23d9a417f1e600c1d` |
| `src/modules/inventory/pages/InventoryKardexPage.tsx` | `f71aa9c64ee5e6cc9ad03845ed64d0c0b3d3ce8a89b08b890e5053d6669a5b8d` |
| `src/modules/inventory/pages/InventoryMovementsPage.tsx` | `42aa0658d1e33b6dedecac3a60cfa0b89f506bf27a97fa2c8c3d0ad7a659eccc` |
| `src/modules/inventory/pages/ProductKardexPage.tsx` | `61827817bd0dc63dbba638308e706729cf903163a250274c74a4d082caa3e575` |
| `src/modules/invoices/components/InvoiceEmitCampos.tsx` | `ba29c35414e3eae431a3b6f79f620755f5bf3c81ba4dc298bc541d741e07f2d2` |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | `7e3ac3993e41fe24d872d39baf67927630b13f39d7c709bd2a23df918950fd15` |
| `src/modules/invoices/lib/invoiceCustomerIdentity.ts` | `dff74ea0a8be7672767847f8538cdce0044be9b0e79dedce99fdab54ba29e05a` |
| `src/modules/invoices/lib/invoiceItems.ts` | `aecd4ce06be3cda8e1ec58835f48940ca5520671fea347ec86a6f650a2e5b6ea` |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | `7c382245a27cf8de6a7b409c2b47c44a4827c15eeecadfad73cc947881b0b172` |
| `test/unit/modules/inventory/inventory8eDocumentReference.test.tsx` | `003fd2acb28e579731ab3aa6e607522de74647bb8b5b638921b242433440eea1` |
| `test/unit/modules/invoices/invoice8eCustomerIdentity.test.tsx` | `67d265f826209065e364ba6017da2448077788cd08a4a58f2d20fabf56430f99` |
| `test/unit/modules/invoices/invoice8eUnitValue.test.tsx` | `fd9657d3dee7937e7e9db44b2642193c050860422dab41b08be1e2f9c3e39261` |
| `test/unit/modules/invoices/invoiceItemsLayout.test.tsx` | `ba3c98439f0b0ede4522d60d7f2a87880749d6ce3bc165c6f2f41ed5af649fb7` |
| `test/unit/modules/invoices/invoiceNotasLineasOrigen.test.tsx` | `3d99da49f77a53347c0c520728c6a61ad84970279edf7a4229015ceb3a58aca6` |

## Correcciones acotadas posteriores de CI

Back: `dde755fc5da903f7ea6c24563c1817dc46a23502` precomputa el número en PLE 12.1 para evitar la duplicación marcada por Sonar; PLE 13.1 permanece intacto. Focales 20 suites / 134 pruebas y corrida completa 314 suites / 2931 pruebas / 12 snapshots aprobados (4 suites / 38 pruebas omitidas).

Front: `f96875cdbec9dd844c93e93d395526c38b1910ff` añade únicamente el tipado de params.q en los dos mocks de apiClient.get de invoice8eCustomerIdentity.test.tsx. No cambian las aserciones ni el comportamiento de las pruebas. Typecheck `tsc -b --force` aprobado; focal 1 suite / 7 pruebas y corrida completa 134 suites / 967 pruebas aprobadas. La tabla anterior contiene el SHA-256 actualizado del único archivo front modificado; los otros diecisiete conservan su contenido.
