# Ferry — Mini-parte Bandeja M1

Repositorio de transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
Rama de entrega: `ferry/m1-bandeja`.
Destino front: `CarlosSoles/Fronted-sistema-mype-sunat`.
Base front exacta: dev `4f84f5901217a7da84816c9e88aae68d5a64ed29`.
Fuente front validada: `5adbeae821de67ece081cdda68f75007870b45b4`.
Base de transporte/documentación back: `e7a8ccdc94e5fa01db3b3430a22a98faa1000e17`.

## Aplicación

1. El commit documental `9d60f5f422fb53ba5e2b63d4b3570e91a28e78d7` contiene únicamente la sección «Mini-parte Bandeja» de `docs/m1/auditoria-solucion.md`; se puede aplicar separadamente al back.
2. Copiar el contenido de `frontend/` sobre un clon limpio de la base front indicada, conservando rutas. Son 27 archivos finales: 15 de producción y 12 de pruebas. No hay archivos eliminados.
3. Verificar los SHA-256 de esta tabla antes de integrar. No fusionar el árbol back de transporte con el repositorio front ni copiar FERRY.md al producto. No se empuja al repo front.

## Alcance

T1: clasificación común para KPI/filtro/badge, con prioridad del origen y respaldo M1_PREPARATION; separación de rechazo SUNAT, bloqueo local, incertidumbre y error de red. Se preservan estados fiscales y efectos locales del puente/RA. La regresión de los casos aportados fija 2/3/1 y los mismos conjuntos filtrados.

T2: derivación única de base, IGV, ICBPER y total a partir de las líneas del detalle del mismo documento, respetando afectación y descuentos de línea. Exoneradas e inafectas tienen IGV cero; precio menos valor nunca calcula IGV. F001-52 se contrasta con una línea de afectación 20, valor 950, precio 1121 y total 950: resultado base 950 / IGV 0 / total 950. No hay propuesta ni ejecución de corrección de datos. Datos incompletos o no conciliables producen «Desglose no verificable», no un desglose inventado.

T3: búsqueda sin tildes ni diferencias de mayúsculas; 1–7 dígitos solo correlativo, 8 dígitos coincidencia exacta, RUC completo y series conservan búsqueda textual/padding. T4: consulta SUNAT solo con ausencia de CDR confirmada, categoría incierta/error de red o ENVIADO; se conservan exclusiones de boletas y preparación local. T5: ICBPER desde lineas_origen, sin inferirlo del residual, visible en filas y subtexto del KPI. Detalles leídos en lotes de cuatro; identidad y orden preservados, sin descargar/regenerar XML. T6: pestaña «Notas de Crédito y Débito» con conteo y ruta existente; menú de emisión intacto.

El detalle no expone el payload completo ni el descuento global. Si esa ausencia impide reconciliar una fila, se informa la inconsistencia. Las notas conservan el cálculo firmado del resumen combinado; la tarjeta de Facturas y Boletas utiliza su conjunto sin notas.

## Verificación

| Suite front completa | Base | Final |
|---|---|---|
| Vitest | 155 archivos / 1155 pruebas | 158 archivos / 1235 pruebas |

Sin fallos ni omisiones. Se añaden 80 pruebas. Batería focal: 4 archivos / 86 pruebas aprobadas. Cobertura local nueva respecto de la base exacta: 64/64 líneas ejecutables y 152/152 ramas, 100% (Vitest/V8). Build Vite/TypeScript aprobado; lint focal sin errores, siete avisos. Las regresiones incluyen clasificación, filtro y badge, exoneración sin IGV fantasma, ICBPER verificado, fallos de detalle, descuentos, búsqueda, consulta SUNAT y navegación a Notas.

Sin PRs, merges, despliegues, emisiones, consultas a SUNAT ni acceso o modificación de producción. Sin cambios de runtime del back, SIRE o esquema de base de datos.

## SHA-256 de archivos finales

Quitar el prefijo `frontend/` al copiar al destino. FERRY.md queda excluido de su propia tabla para evitar circularidad.

| Archivo de transporte | SHA-256 |
|---|---|
| `frontend/src/modules/invoices/InvoiceList.tsx` | `c2449edd35b3bd2ef4beec7f1cb772a461575e9e9cd73f40d828fe1f9a37ff73` |
| `frontend/src/modules/invoices/components/InvoiceCdrModal.tsx` | `2676bf53e4bd29a88460efec94858faeec843f876371cbc5a7a3f73a8a4e5ffb` |
| `frontend/src/modules/invoices/components/InvoiceFiltersBar.tsx` | `4c6f74c89d605c6dfe9be0a46cc3d75554c786183658d81f9b176f77554e1fa8` |
| `frontend/src/modules/invoices/components/InvoiceKpiCards.tsx` | `a982edc692bcf049fc805f6d3b008031ccf50e38455890e641643ba81c25fdd2` |
| `frontend/src/modules/invoices/components/InvoiceStatusBadge.tsx` | `cbe9d8882273d2fb189a6827809284390d4545fe4e4ef3e2bb60d109d59e940f` |
| `frontend/src/modules/invoices/components/InvoiceTable.tsx` | `e1a03c291a740f307fbc75508e081f11ec5adf5fc37becb8e3ec68d283716335` |
| `frontend/src/modules/invoices/components/InvoiceTableRow.tsx` | `024670d2ea368d89bab932ece187b992681fabcfea278dbd0fac8a43d8f86cff` |
| `frontend/src/modules/invoices/components/InvoiceTabsNav.tsx` | `3c755909654603c93eaddf543ab87e29996ad6bc1ebceb4f388d5ea20c26b1ca` |
| `frontend/src/modules/invoices/data/invoiceDemoSchema.ts` | `5657ea7ae79b2db04c82ad2b2a8833313fc5aa6aac7ce3f8cf8d061548385fc6` |
| `frontend/src/modules/invoices/lib/invoiceApiMapper.ts` | `2e183c57f30a596ff5c73bf4ab6a2356ed1363140ab65077e6e1d5d6cbd050a8` |
| `frontend/src/modules/invoices/lib/invoiceBandejaAmounts.ts` | `5c56db6072fee363624ef7845f25c64e065a39f32ae7461d211d6660a1341fda` |
| `frontend/src/modules/invoices/lib/invoiceBandejaState.ts` | `68fdb5c1e98faa399cd040cbeada0f860c8b057fe847cb53b2ef395dc3ffc2ca` |
| `frontend/src/modules/invoices/lib/invoiceFilters.ts` | `9971efe13715b396e0085b36805016e9ddd1a1ac73814b28f0298bc381105bd7` |
| `frontend/src/modules/invoices/lib/invoiceMetrics.ts` | `c04ca64763e78346518011f1cb25e91de4dac0b7d5754db0b23b0727e746ecc9` |
| `frontend/src/modules/invoices/types/invoice.types.ts` | `c9a3e9acd2f3ee639ccf67cc85ba8bf06848864c4b0837331182cb711b80346e` |
| `frontend/test/unit/modules/invoices/bandeja-amounts.test.ts` | `0ad3fd7571f48a01fcaab22b4b54f36fe4174447d74dd8cdb9f21020a23838af` |
| `frontend/test/unit/modules/invoices/bandeja-state.test.ts` | `7c0fcbc31e4caeb00c493a58e3e2e93408e7ebfc59f292ebe1a36dd35758436f` |
| `frontend/test/unit/modules/invoices/bandeja-ui.test.tsx` | `4f4e280cf89c84352655d2007866ad0e5fd78e8611ab95d04f3b0b1281125e63` |
| `frontend/test/unit/modules/invoices/invoiceBandejaRegresion.test.ts` | `da2aa027bc25340d7f91e02836bf194553de1b24899651c892a23498a096d6d2` |
| `frontend/test/unit/modules/invoices/invoiceBandejaResiduos.test.tsx` | `d19da02dbde1a4ec3a0d777c43309985e7d3ed4dc295dc789712f0623bb10f38` |
| `frontend/test/unit/modules/invoices/invoiceCazaBandeja.test.tsx` | `4779fd72f06fc1a4b5c18e6ed756bcc464a041567c5465c2eef048b6935c0097` |
| `frontend/test/unit/modules/invoices/invoiceConsultaSunat.test.tsx` | `d5d31c6d46daf4ff6adc122baa515b54715c34fe6749f9c285fe5add78dfcbb1` |
| `frontend/test/unit/modules/invoices/invoiceIssuerRucPin.test.tsx` | `3a00de11fcf8ab882e521b1b5c46d880e9741b861e918bed3034787a5c85e01e` |
| `frontend/test/unit/modules/invoices/invoiceNotasSeparadas.test.tsx` | `7af083a7bd1438f48e060010dfe2375d98ddc1bcf15f2bdbc73c79d8a6d4c0be` |
| `frontend/test/unit/modules/invoices/invoicePulido6bOrigen.test.tsx` | `5e872b9cd4d5a85e1bfd096068eec55b6cab4b200ec99c5f5ec4239690cad91e` |
| `frontend/test/unit/modules/invoices/invoicePulidoPresentacion.test.tsx` | `e2abc3ebd4a9b8074163e0cf9892baa758b0bf5797bbfda4baff5bdb52f5e0f1` |
| `frontend/test/unit/modules/invoices/invoiceTabsNav.test.tsx` | `108b22ac99063fcfd7d64b55f5b7e5190152b59771b8cde7620b6d646c2c4959` |
