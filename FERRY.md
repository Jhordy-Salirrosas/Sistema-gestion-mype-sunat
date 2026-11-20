# Ferry — Bandejas de comprobantes y Notas con detalle modal

- Rama: `ferry/m1-bandeja-modal`.
- Front destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base obligatoria del front: **`6ea2c1f6ce72651c8e98dff5ad66ad13dd32f875`** (main, PR #364).
- Base del repositorio de transporte: `627e29f56e4f090d06b2349f58a63408773ffcf6`.
- Entrega inicial: `65bc8bd62bd6bc4be9df37b1b451d68e92284257`. Esta ampliación se entrega en un único commit posterior sobre la misma rama.

## Resultado acumulado y ampliación

Facturas y Boletas y las dos listas de Notas (crédito y débito) terminan en
**Estado CDR**, sin columna Acciones, botón Ver ni menú por fila. La fila
completa abre el detalle existente en una ventana emergente centrada con fondo
atenuado, mediante clic, Enter o Espacio.

El detalle conserva número, cliente, estado, Reprocesar puente cuando corresponde,
las pestañas Auditoría CDR y Visor XML UBL 2.1 y las descargas oficiales XML/PDF/CDR.
El reintento de CDR se conserva dentro del modal con las mismas guardas y el mismo
flujo de servicio. Cerrar, Escape y clic en el fondo cierran la ventana y devuelven
el foco a la fila. No se pierde ninguna capacidad de las acciones retiradas.

La ampliación elimina la franja InvoiceTabsNav y sus conteos en ambas vistas.
Se retiran el componente y el contador exclusivos de esa franja. La identificación
por ruta y la agrupación de documentos siguen utilizándose: se conservan en
`lib/invoiceSections.ts`, sin interfaz de navegación ni conteos. No quedan
referencias al componente ni a sus exportaciones anteriores en código o pruebas.

Se conservan los grupos, conteos y subtotales propios de las listas de Notas.
Las pestañas internas de trabajo de Anulación y Resúmenes no se modifican.
Tampoco cambian el menú lateral, filtros, ordenación, paginación, distintivos,
servicios, tipos de API, payloads, reglas ni archivos del back.

## Delta acumulado contra la base del front

| Estado | Archivo | Finalidad |
| --- | --- | --- |
| M | `src/modules/invoices/InvoiceList.tsx` | Modal y variante sin acciones en ambas vistas; retira la franja y su contador. |
| M | `src/modules/invoices/components/InvoiceTable.tsx` | Variante sin columna de acciones y colspan del estado vacío. |
| M | `src/modules/invoices/components/InvoiceTableRow.tsx` | Omite las acciones; apertura desde fila y retorno de foco. |
| M | `src/modules/invoices/components/InvoiceCdrModal.tsx` | Conserva el detalle, descargas y guardas; incorpora el reintento de CDR de la fila. |
| D | `src/modules/invoices/components/InvoiceTabsNav.tsx` | Retira la franja y sus ayudantes exclusivos. |
| M | `src/modules/invoices/lib/invoiceFilters.ts` | Usa la agrupación conservada en la utilidad sin interfaz. |
| A | `src/modules/invoices/lib/invoiceSections.ts` | Conserva rutas, tipos por apartado e identificación de vista. |
| M | `test/unit/modules/invoices/bandeja-ui.test.tsx` | Sustituye la navegación por la franja por la comprobación de rutas y agrupación. |
| M | `test/unit/modules/invoices/invoiceCazaBandeja.test.tsx` | Apertura desde fila, descargas internas y ausencia de franja; conserva importes y estados. |
| M | `test/unit/modules/invoices/invoiceNotasSeparadas.test.tsx` | Ausencia de franja; conserva conteos y subtotales de Notas. |
| A | `test/unit/modules/invoices/invoiceBandejaModal.test.tsx` | Bandeja y NC/ND: clic, Enter/Espacio, cierres, retorno de foco, descargas, puente y reintento. |
| D | `test/unit/modules/invoices/invoiceTabsNav.test.tsx` | Retira las pruebas exclusivas del componente eliminado. |
| A | `test/unit/modules/invoices/invoiceSections.test.ts` | Verifica rutas y equivalencia de la agrupación por tipo. |

## Verificaciones

- Entrega inicial: 223 archivos y 1645 pruebas aprobadas, sin fallos ni omisiones.
- Ampliación: **223 archivos, 1660 pruebas aprobadas, 0 fallidas y 0 omitidas**.
- Build de producción `npm run build`: aprobado (TypeScript y Vite).
- ESLint en los once archivos transportados: 0 errores; conserva las dos
  advertencias preexistentes de InvoiceList (Fast Refresh y dependencia setFiltros).
- Cobertura funcional de la ampliación: NC y ND abren con clic, Enter y Espacio;
  conservan pestañas, descargas, puente y reintento; cierran con Cerrar, Escape y
  fondo. Las dos vistas carecen de franja. Se mantienen las pruebas de conteos,
  subtotales y los recorridos existentes de Anulación y Resúmenes.
- `git diff --check`: aprobado. Los once archivos transportados coinciden byte a
  byte con el árbol probado; `SHA256SUMS` verifica estos archivos y el manifiesto.

## Aplicación

Copiar los **once archivos** de `frontend/` a sus mismas rutas en el front.
Además, eliminar expresamente estos **dos archivos de la base del front**;
no se transportan archivos vacíos como sustitutos:

```sh
git rm src/modules/invoices/components/InvoiceTabsNav.tsx
git rm test/unit/modules/invoices/invoiceTabsNav.test.tsx
```

Comparar con la base indicada si el front incorpora cambios posteriores.
No eliminar otros archivos por no estar incluidos en este ferry de delta.
Verificar desde la raíz de la rama de transporte con `sha256sum -c SHA256SUMS`.
Sin PRs, merges, despliegues ni acceso a datos de producción.
