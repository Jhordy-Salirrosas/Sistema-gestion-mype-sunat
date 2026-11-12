# FERRY — Parte 8D: línea gratuita completa

Rama: `ferry/m1-8d-linea-gratuita`.
Base front: `4b94d22f769b788aca001295ae1e066f92f0c4ed`.
Base back y de la rama ferry: `95b6687d5843588e10f34b43b7f6d0eb850a6bca`.
Origen front probado: `a2356afd966f496e92e548769b7dd98b2aa8c5be`.
Back requerido: `fix/m1-8d-linea-gratuita` en `4159cfe7c4fd9f8e487e0a5d04fbb82011694b63`.

Esta rama transporta archivos front en sus rutas originales sobre una base del repositorio back. Copiar únicamente los cinco archivos enumerados al repositorio front, después del back; no fusionar el árbol back con el front. FERRY.md es el manifiesto y no se copia al producto. Sin cambios de dependencias, migraciones ni columnas nuevas.

D1 permite declarar una línea gratuita con motivo explícito, referencia positiva y precio cobrado cero. Conserva producto/unidad y recupera los datos onerosos al retirar la gratuidad. Las notas mantienen su clasificación histórica. Se actualizan dos pruebas anteriores al comportamiento autorizado y se añaden cuatro pruebas de selección, validación, referencia y payload. D2, D3 y D4 no requieren cambios adicionales del producto front; el ICBPER de gratuitas ya se incluía en su liquidación.

## Validación final

- Front: **131 suites / 947 pruebas aprobadas**; `npm run build` aprobado; lint de los cinco archivos aprobado sin advertencias.
- Back: **311 suites / 2907 pruebas / 12 snapshots aprobados**; 4 suites / 38 pruebas omitidas; `npx nest build` aprobado. Lint sin errores, con dos advertencias previas de 8C.
- XSD/SFS local con firma ficticia en los puntos D2/D3/D4. Sin emisiones reales, PRs ni certificación beta en este encargo. La certificación en vivo sigue pendiente.

## Commits por frente del back

| Frente | Commit |
| --- | --- |
| D1 | `e94d5c79f7434ed64ad3ef9eb010b3debb839412` |
| D2 | `bbda5d3b70215763e1f3f98ac5cf82d8a4b22a29` |
| D3 | `9d85fa19bb6ed356b1127e4e7650edd06f05f676` |
| D4 | `4159cfe7c4fd9f8e487e0a5d04fbb82011694b63` |

La lista exacta de archivos back por frente está en docs/m1/auditoria-solucion.md de la rama back. Los siguientes archivos front corresponden a D1; el cierre documental de este ferry no cambia su contenido.

## Archivos front y SHA-256

| Archivo | SHA-256 |
| --- | --- |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | `46bbdb906366d3999d5186810ae0ab6f8ef527f67707fd7928ba9c33337d3dd2` |
| `src/modules/invoices/lib/invoiceItems.ts` | `d98fd63ca0c2e1306edeb0aef9b5d345b43efb4894314dae86785dfff4d293da` |
| `test/unit/modules/invoices/inventoryProductsApi.test.ts` | `4d61805f6863f8948f3d765fc28a5d95fb866471407ec795d3df1f3f71661867` |
| `test/unit/modules/invoices/invoice8dFree.test.tsx` | `0288d68887f5ac686f241bc599406a32c951ef0d85a1576c723f90a82f351207` |
| `test/unit/modules/invoices/invoiceItemsLayout.test.tsx` | `c63fd9e7d40c4d77c5727379b1b6731fd90209f6faf4ebfb3c6a345c631697b8` |
