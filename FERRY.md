# FERRY — Parte 6c, cierre pre-revisión M1

## Destino y bases

- Destino: `CarlosSoles/Fronted-sistema-mype-sunat`, rama `dev`.
- Base front: `8c3c6880eb5c744ed88af1df9c4f1884c4740b1f`.
- Cabeza del clon front verificado: `390d549afd3f3db717dbf1a570cafcb844c017da`.
- Base contenedor back: `bdb50766a3354980e399459811b0d4d067744526`.
- Back requerido: `fix/m1-cierre-6c`, `edd1c7be77fcda46067b255ac5f3e062ca9e4850`.
- Rama ferry en el remoto back: `ferry/m1-cierre-6c`.

Aplicar SOLO las 31 rutas del manifiesto, en sus rutas exactas. No fusionar la
rama contenedora como código back ni copiar su package.json/schema. No hay
eliminaciones respecto de la base front. No se modificó el remoto front desde
Codex. Integración, PR y despliegue quedan a cargo de Emma.

## Diez commits separados

| Punto | Commit front de origen | Commit ferry |
|---|---|---|
| 6c-1 | 4b52aa0 | 8aa78fa |
| 6c-2 | 6fcfac9 | 441dfe0 |
| 6c-3 | 5d1bd1e | d34106e |
| 6c-4 | — (solo back) | ed5a6ec |
| 6c-5 | 360d4bb | 29766cc |
| 6c-6 | af992a4 | abbb64e |
| 6c-7 | 68025fd | bdb914e |
| 6c-8 | 4d76a8b | 620b300 |
| 6c-9 | ae5a059 | c2c3572 |
| 6c-10 | 390d549 | HEAD de esta rama; incluye este manifiesto |

6c-4 es un commit de manifiesto/dependencia exclusivamente back; no hay archivos
front que cambiar para que la tabla de Configuración pinte el detalle recibido.
Los demás commits contienen las rutas front de su punto.

## Alcance entregado

1. Hora America/Lima junto a Actualizar, solo tras refresco de red exitoso.
   Inicial sin hora confirmada; carga/error conservan la última hora buena.
2. Cerrar desde M1 con API existente del diálogo; UI común intacta, conservando
   icono/posición/orden/cierre. SIMULADO (pruebas) es etiqueta; el valor sigue MOCK.
3. Subtítulo completo con ajuste de línea local. «Sin confirmación SUNAT (incluye
   cola)» describe el agregado existente, sin cambiar cifras ni estados.
4. Back describe datos fiscales cargados y endpoints efectivos sanitizados o
   ausencia. Booleanos, criterios de validación y compuerta intactos.
5. Una opción de incertidumbre filtra ERROR_RED y la clase visual explícita;
   se siguen solicitando los mismos estados al back.
6. Acción Reintentar CDR solo con `transporte_acreditado` proyectado por el back.
   Historial completo/CDR como evidencia; bloqueo local, rescate y consulta
   inconclusa (incluido legado ISSUER_STATUS_UNCERTAIN) no prueban envío. Falta de
   evidencia no se interpreta como transporte. No cambia retry-cdr ni sus estados.
7. Selección RA muestra tipo/código, total y estado con el payload existente.
8. Ayuda de notas: «aceptada u observada», sin cambiar guardas ni saldo.
9. Panel, agregados y configuración distinguen primera carga, vacío confirmado,
   datos y error. No muestran cero, ausencia de series o lista vacía como datos
   antes de recibir la respuesta.
10. Precio recibido se presenta a dos decimales en el borrador, sin PATCH al cargar.
    Guardar explícito mantiene la validación previa. Numeración visual uniforme
    de 8 dígitos en listados, monitor, selección RA y nombres accesibles. Identidad,
    correlativo almacenado, rutas, reserva, cuotas y XML no cambian.

## Verificación

| Suite completa | Base | Final |
|---|---:|---:|
| Back, suites aprobadas | 278 | 279 |
| Back, pruebas aprobadas | 2555 | 2561 |
| Back, omitidas | 4 suites/38 pruebas | 4 suites/38 pruebas |
| Snapshots fiscales | 12 | 12, archivos intactos |
| Front, archivos aprobados | 118 | 123 |
| Front, pruebas aprobadas | 866 | 885 |

Cero fallos. Builds front/back OK y lint back limpio. ESLint front conserva los
2 errores y 6 avisos previos en los archivos revisados (incluye Monitor),
contrastados con las fuentes base por stdin. No se relajan reglas ni umbrales.
Regresión focal adicional tras consolidación: 2 archivos/9 pruebas verdes.
Cobertura local de código nuevo back diff/LCOV: líneas 9/9 (100%), condiciones
32/35, combinada 41/44 (93.18%); no representa un Quality Gate remoto.

No hay migraciones nuevas ni cambios de esquema, datos históricos o módulos
ajenos. Diálogo/UI común, Resiliencia, Contabilidad e Inventario intactos.
No emisiones reales ni llamadas reales SUNAT, PR, merge o despliegue. Baseline y
resultados por punto documentados en docs/m1/auditoria-solucion.md, «Parte 6c»,
en la rama back requerida.

## Manifiesto completo — 31 rutas

Contraste byte a byte entre clon front verificado y ferry antes del commit final.

| Ruta exacta | SHA-256 |
|---|---|
| `src/modules/invoices/InvoiceList.tsx` | `dee44384438b83177238201e15a358a9ef255642787ddcaa9958f3f6607f6c83` |
| `src/modules/invoices/components/EnviarBajaPanel.tsx` | `5ee810f55c66d26776a8f817cd007d8450b9d4d37421e6425fe671e5339dadf6` |
| `src/modules/invoices/components/InvoiceAggregateMonitor.tsx` | `4e33d4e7d6abcf3b3588f9496dd95016e6acbeeceab5cd1f9c2978a2a9699e60` |
| `src/modules/invoices/components/InvoiceEmitCampos.tsx` | `a9c37d9a6c95cc9a368f8dc71302ec863f1d0bc80c1136571d172dc1f3e27e35` |
| `src/modules/invoices/components/InvoiceEmitModal.tsx` | `15070559407339168af6238cb9f8ed150178c8640f02c6ad5a96c45e9d324c52` |
| `src/modules/invoices/components/InvoiceFiltersBar.tsx` | `609139aa4399803b8082735aa41232e584829e076b66a9a1627c26e65c24ea7c` |
| `src/modules/invoices/components/InvoiceIssuerConfigForm.tsx` | `570ef51da8813bf8da1351b2b06ef2a5fa68bf202bc9d601e554852edddf9904` |
| `src/modules/invoices/components/InvoiceNextNumber.tsx` | `14f288f20ba543f6bf8f257c8fc9c0324a4b2ee9350fa460feab64a711aa92d7` |
| `src/modules/invoices/components/InvoiceOutboxMonitor.tsx` | `fd8d86f852e5ef1d56e775eee063ed4272fb643c40c1a56cd54438dad9d7bc3c` |
| `src/modules/invoices/components/InvoiceTableRow.tsx` | `4bc4d534c0e293b44fa5a53f975a1e57e5077402c2ce2767820c48a26e78ed5c` |
| `src/modules/invoices/data/invoiceDemoSchema.ts` | `27cda1d51039d30decac25fad9d34d53cafcb822698f333b284d7fabd6a872e6` |
| `src/modules/invoices/hooks/useInvoiceRefresh.ts` | `83d5ac91768c38b1102a42ae2654c72457eee2e9b689282f8baec754f0986189` |
| `src/modules/invoices/lib/invoiceApiMapper.ts` | `e4700d80a3b84b9b85244beff8574f4ce8658de5950edc98be05c2727f2f2d35` |
| `src/modules/invoices/lib/invoiceMapper.ts` | `d152fc3fa2b74cf6412771272c873650926676f7d23fe5d74aaad42bb16a9600` |
| `src/modules/invoices/lib/invoiceVisibleNumber.ts` | `dff5da724de439c7b0f9f85aeb27fc7180dff9d08e0ed30548085a90b0981a76` |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | `36fce4bfe83c38e7e8b0bce6c67991d84224a5ac0fdcd010425dd8dd0b88e810` |
| `src/modules/invoices/pages/InvoiceMonitorPage.tsx` | `d34f5f80d44787772a6a0c50e581acd71f9f5e6c3b4be57224d6bd8505cd00f6` |
| `src/modules/invoices/pages/InvoicePricesPage.tsx` | `f83bd2353ceaf48e878723ac1232037b4b86637e155c0eb93790985589139b90` |
| `src/modules/invoices/pages/InvoicesDashboardPage.tsx` | `0401e3a8f7db328b12b53514d11eb09711e88d014e8ea612cf8de46ae88c3d6f` |
| `src/modules/invoices/types/invoice.types.ts` | `622833321d887ccbdd0ed360dd86fbb4f930e72aa79f6e04481645386fb2bcd4` |
| `test/unit/modules/invoices/invoiceBajaEnvio.test.tsx` | `71a8859d6b65471fe90cae83f476c9c5d8903d856afcfeb5849ad8c9fc9d2a12` |
| `test/unit/modules/invoices/invoiceCierre6cCarga.test.tsx` | `f70d1001f4e2f9e9565ecc84a34f400190c8e6614121f1618dea8b69b0c44bc9` |
| `test/unit/modules/invoices/invoiceCierre6cFormato.test.tsx` | `843162fddb6a49a3b8040966ebd3094a11abd7726872fb5e553de7a8a0b71f6c` |
| `test/unit/modules/invoices/invoiceCierre6cHora.test.tsx` | `8543eff191d7d282cd8ea11795c8dd3f0a9dbc55212e73cb30664dfe4f28e36b` |
| `test/unit/modules/invoices/invoiceCierre6cTraduccion.test.tsx` | `5c383bbf2be095bd4e204bd4dc6546fb784e8d55223e439ea87aad4a0a9c6f5e` |
| `test/unit/modules/invoices/invoiceCierre6cTransporte.test.tsx` | `08d70310efe677f8fa5532359bd3d86e99eac91602747b837ec4d3c6d03eba86` |
| `test/unit/modules/invoices/invoiceD1Config.test.tsx` | `9af2dd361255cb0295f6907582db7a49e27acd9458979637fb0c6a9e84aa45f3` |
| `test/unit/modules/invoices/invoiceDetallesBandeja.test.tsx` | `51019d9127399af9688d0d828c31655334ba7fb68e8ba77c62e914a067fa3fe3` |
| `test/unit/modules/invoices/invoiceMonitorRetry.test.tsx` | `05dae24fcc19f20df506c4ef5ce0edd4b1e977c083848a554e0000550a2f6739` |
| `test/unit/modules/invoices/invoiceNotasLineasOrigen.test.tsx` | `7b084a5823b0da286f33ea7f8a23e6e7376db89f11082820538f46e1a5424eba` |
| `test/unit/modules/invoices/invoicePulidoDashboard.test.tsx` | `affe2bd83ad26660bff77b2a6058c134624abf53c209e9e36e0754d12780ab3a` |
