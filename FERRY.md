# Ferry — Integración B1–B3 y validaciones de formularios

Repositorio de transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
Rama: `ferry/m1-bolsas-atajos-resumenes-int`.
Destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
Base front actual: `39d55f3a08d25cce5a5aafa7af8c744b89e659a0`.
Fuente original verificada: `2d20be2389bbb6482b6199e835b0aa506f0ad56b` (base antigua `73af439c48d1e8937133b52f8b525bbecfe7540f`).
Back integrado: rama `fix/m1-bolsas-atajos-resumenes-int`, sobre `4e21f3e3583dc8c892d53a47788499ee116cae09`, portado desde `199c0f1a3bd35981b8ad9622afae70e869ff09fd`.

La rama contiene un árbol del front sobre su main actual. Aplicar el commit de integración al front desde esa base; no fusionar este árbol con el código del back. FERRY.md es documentación de transporte y se excluye de producción. No se requiere push al repositorio front para esta entrega.

## Alcance

- B1: bolsas sobre el producto registrado, sin línea sintética ICBPER; cantidad entera no negativa e impuesto cantidad × 0.50. Se retira el input auxiliar de cabecera.
- B2: Alt+C/P/L y Ctrl+Enter con ámbito de página, key/code, buscador real y exclusión de otros diálogos; Ctrl+Enter abre revisión y confirmar conserva las validaciones.
- B3: miembros RA/RC sanitizados y acceso al detalle por id, con error visible; depende de la rama back integrada.
- Se conservan las validaciones de formularios del main actual. Sin cambios de SIRE, migraciones nuevas, emisiones reales, despliegues ni PRs.

## Solapes

| Archivo con solape | Resolución |
|---|---|
| `docs/m1/auditoria-solucion.md` (back) | Se conservan las secciones de formularios y B1–B3; esta sección registra la integración sobre las bases actuales. |
| `src/modules/invoices/components/InvoiceEmitModal.tsx` | Se mantiene `problemasContenidoEmision`; el botón de bolsas actualiza la línea elegida mediante `actualizarItem`. |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | Se conservan `cantidadValida`, máximo 500, paso 0.001 y avisos de validación; las bolsas usan cantidad entera no negativa y selector de producto. |
| `src/modules/invoices/lib/invoiceItems.ts` | Se conservan Decimal, límites de descripción y precisión; se añaden `cantidadBolsas`, validación y sincronización del impuesto. |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | Se mantiene el validador compartido; se añade el ámbito de página al hook y se reemplaza el alta de línea sintética por actualización de bolsas del producto. |

## Verificación

| Suite | Línea base | Integrada |
|---|---|---|
| Back Jest | 326 aprobadas / 4 omitidas; 3139 pruebas aprobadas / 38 omitidas | 326 aprobadas / 4 omitidas; 3142 pruebas aprobadas / 38 omitidas |
| Front Vitest | 141 archivos / 1030 pruebas aprobadas | 144 archivos / 1044 pruebas aprobadas |
| Back E2E | 3 aprobadas / 4 fallidas / 1 omitida; 11 pruebas aprobadas / 21 fallidas / 10 omitidas | Mismos conteos y mismas pruebas fallidas |

Jest conserva 12 snapshots aprobados. Las cuatro suites opcionales omitidas son agregados (20 pruebas), configuración del emisor (10), búsqueda de terceros (7) y conexión real SUNAT beta (1). E2E falla previamente en los dobles de cola de auth, customs, invoices e invoiceQuery: falta `registerSirePeriodsWorker`. No se modifica SIRE ni se corrigen esos dobles en esta integración. No hay fallos nuevos.

Builds Nest y Vite, incluido `tsc -b`, aprobados. Lint back: cero errores y dos avisos previos. Lint focal front: los mismos dos errores `react-hooks/set-state-in-effect` y un aviso `react-refresh/only-export-components` que en main, verificados sobre un worktree de la base exacta.

```sh
# Back: PostgreSQL local aislado con las migraciones existentes aplicadas.
NODE_OPTIONS=--max-old-space-size=6144 TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/sunat_test RUN_INTEGRATION_TESTS=required RUN_SUNAT_BETA_INTEGRATION=false npm test -- --runInBand --json
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/sunat_test RUN_SUNAT_BETA_INTEGRATION=false npm run test:e2e -- --runInBand --setupFiles="$PWD/test/setup.ts" --json
# Front
npm test -- --reporter=json
# Ambos repos
npm run build
```

## SHA-256 de cada archivo final

Veinte archivos únicos. FERRY.md se excluye de su propia tabla para evitar circularidad. Los cuatro archivos front con solape contienen la resolución integrada; los demás coinciden byte a byte con el ferry original. Los archivos de main ajenos a B1–B3 se conservan.

| Archivo | SHA-256 |
|---|---|
| `src/modules/invoices/components/InventoryProductSearchSelect.tsx` | `e206f66141f773d9b9a032963a2095229ef6fe3b42fa7112e4bd47c2d738d002` |
| `src/modules/invoices/components/InvoiceAggregateMonitor.tsx` | `deb260b287278af6c236a06233c68e9cd07e640cbb9262e7d60b98d041201f3a` |
| `src/modules/invoices/components/InvoiceEmitCampos.tsx` | `cf92a04bd20e2791e079c9e1cdca72a9c5872d0150f12ce8f0748fbeef99f6f0` |
| `src/modules/invoices/components/InvoiceEmitCamposTributarios.tsx` | `b4b1a371ebaa66ab92d3714d51389e4e0d4f48ff2e8b5519b3c4b61d1bebc273` |
| `src/modules/invoices/components/InvoiceEmitModal.tsx` | `52f675d11325f78e5e75c382bafcb0f087fe547561964d15cf35664b8f6aa49f` |
| `src/modules/invoices/components/InvoiceEmitResumen.tsx` | `1d35fcb1c8b3218f9910827cd824c56579fc5b7e50368bed8b1809bfd797731d` |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | `922d0d9b4bdf6baa0adddaa7310791924bb67d7307ac1447345ff18f999ac30b` |
| `src/modules/invoices/components/useInvoiceKeyboard.tsx` | `7804b5045ad270d2353be776a175ef25b9a4bdf1c3ba32f8bcf76245bdc46e16` |
| `src/modules/invoices/lib/invoiceBags.ts` | `b94f2188dd17ee2bde57898deb4b1feb55ba91fbf7b5224bb3d497cf7fdf19d3` |
| `src/modules/invoices/lib/invoiceEmitPayload.ts` | `67fdd3b7d8e73dc09ec5cedbef3e924f8a431ea694db309908c804a958b797ef` |
| `src/modules/invoices/lib/invoiceItems.ts` | `ca44c4a05010d0e8284f363ac71a8bfef783b8699b61dcbb9210959eeab3d182` |
| `src/modules/invoices/lib/invoiceStockLinea.ts` | `d2d9270227228bb7a1e5ac268b0db379157da0809fa8fe99dced676c99df43fd` |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | `d7e2b17902046548b611eed4a981da42272fbb600644333899307ab995397c8a` |
| `src/modules/invoices/types/invoiceAggregate.types.ts` | `e1bfbd4f89741cc4711d9eb47dd9e87880c78a8cacfebd93a14227870a8543be` |
| `src/modules/invoices/types/invoiceEmision.types.ts` | `b29addb433ddf57c520e94fa22e40c9cbedcca8614ca5acec61ea5d47ade3d09` |
| `test/unit/modules/invoices/invoiceAggregateMembers.test.tsx` | `5f520cd8e3fe4323e2d19e2f5ffbaacae6ce9cadb5225d20c983651a8d741025` |
| `test/unit/modules/invoices/invoiceBagsRegistered.test.tsx` | `1f089e0ae0f5462a9be5078f3dd2242bec69978e75c7f7dfad38bf592f439287` |
| `test/unit/modules/invoices/invoiceIcbperVias.test.tsx` | `6fa55183fcae817f310919bc1e4a3682a4262741940793d708032bb3d1d6ed60` |
| `test/unit/modules/invoices/invoicePageKeyboard.test.tsx` | `f68c6748cddba440e4f1c5baf7ee280cc9c0a1d3947c990e51d8e92defbf4e59` |
| `test/unit/modules/invoices/invoiceStockEIcbper.test.ts` | `31eec48780f3593644d6eebd829ba6c942c0e5446f0e278979ae75e2e15775fb` |
