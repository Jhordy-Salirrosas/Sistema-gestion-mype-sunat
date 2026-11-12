# Ferry — Parte 9: cierre de Facturación M1

Repositorio de transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
Rama: `ferry/m1-parte9-cierre`.
Destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
Base front exacta: `3bc4cdb01dd60ca1ac3da0667add12a6fb1810b2`.
Back asociado: `fix/m1-parte9-cierre`, sobre `c8de3d557d648a5477c7493813ca48c8266551e2`.

## Aplicación

La carpeta `frontend/` contiene únicamente los 57 archivos finales modificados del front (31 de producción y 26 de pruebas). Copiar su contenido sobre un clon limpio de la base front indicada, conservando las rutas relativas. No hay archivos eliminados. Verificar todos los SHA-256 de la tabla antes de integrar. La rama de transporte conserva el árbol back de su base: no fusionar ni aplicar ese árbol al front, ni copiar FERRY.md al producto. No se empuja al repositorio front.

## Alcance

F1/F2/F7: fecha propia de notas, pago heredado solo para NC13, boleta siempre Contado, borrador vacío y reemplazo de la primera línea vacía al elegir catálogo. F3: ruta y controles operativos usan permisos compartidos de facturación. F4: DLQ por historial sin perder filtros específicos de origen. F5: precio y payload coherentes con afectación. F6/F14: detracciones vigentes completas y motivos alineados con los catálogos del back. F8: PDF de fila oficial y QR idéntico al backend actual (sin padding, DD-MM-AAAA, dos decimales, saneamiento del digest y barra final). La paridad normativa fina del QR queda como deuda documentada; no cambia el QR del back.

F9: ICBPER en el resumen; boletas íntegramente gratuitas bloquean bolsas con explicación y validación anterior al POST. Un control permite retirar bolsas ya presentes. Facturas gratuitas conservan total de S/ 0.50 por bolsa y la separación XML ocurre en el back. F10/F11: KPI sin acreditado cero en vista sin notas y descarga del periodo rotulada como propuesta RVIE CSV. F12/F13: referencia gratuita y descuento global visibles, sin consulta SUNAT para boletas ni preparación local. F15: validación documental también en edición de terceros. El reporte de ventas distingue utilidad null como «Sin costo», también en CSV.

Las pruebas anteriores de operación ahora declaran un rol autorizado; las nuevas regresiones verifican además el bloqueo de auditor y otros roles sin permiso. Se actualizan expectativas del contrato QR, fecha/pago de notas, precio y borrador vacío.

## Verificación

| Suite completa | Línea base | Final |
|---|---|---|
| Back Jest | 328 suites / 3194 pruebas aprobadas | 335 suites / 3225 pruebas aprobadas |
| Front Vitest | 151 archivos / 1105 pruebas aprobadas | 155 archivos / 1153 pruebas aprobadas |

El back conserva cuatro suites y 38 pruebas opcionales omitidas y 12 snapshots aprobados. Invoices unitario: 130 suites / 1973 pruebas en la base; 137 suites / 2004 pruebas finales. Se añaden 31 pruebas back y 48 front. No hay regresiones de aserciones.

Cobertura local de código nuevo, comparada con las bases exactas (líneas ejecutables y ramas instrumentadas intersectadas con líneas añadidas): back **43/43 líneas y 87/87 ramas, 100%**; front **48/48 líneas y 142/142 ramas, 100%**. Informes originales: Jest/Istanbul `coverage-final.json` y Vitest/V8 `coverage-final.json`. No es una afirmación sobre la cobertura global del repositorio ni una ejecución del Quality Gate remoto.


Builds Nest y Vite/TypeScript aprobados. Sin PRs, merges, migraciones, despliegues, emisiones reales ni envíos a SUNAT. La validación SFS del back es local con certificado ficticio. La sección «Parte 9» de `docs/m1/auditoria-solucion.md` del back contiene el alcance, el rechazo específico de boletas gratuitas con bolsas y las limitaciones de verificación del dataset compartido.

## SHA-256 de cada archivo final

Cada ruta de esta tabla está dentro de `frontend/` en la rama de transporte; quitar ese prefijo al copiar al destino. FERRY.md se excluye de su propia tabla para evitar circularidad.

| Archivo de transporte | SHA-256 |
|---|---|
| `frontend/src/modules/customs/libPartnerValidation.ts` | `b55d8be91c441da98c9171f4af0a631ef50f111a1153023b6154978bcd7ccc48` |
| `frontend/src/modules/invoices/InvoiceList.tsx` | `3f33e36c00ab830c6e06666932f6daa2555cb514c25ef2340cc0e9bb5c57c5f7` |
| `frontend/src/modules/invoices/components/EnviarBajaPanel.tsx` | `de87e683cd5ec4e97da073e02f883943353d0e37cd6f06b4cb284c236c77ea34` |
| `frontend/src/modules/invoices/components/EnviarResumenDiarioBoton.tsx` | `3710ff0f680c8fa98ff12aee7ea455e54ce4f400f4d77a7acdea2b4a4dc88a6b` |
| `frontend/src/modules/invoices/components/InvoiceAggregateMonitor.tsx` | `a340b36312c9831cfb0ea9e851b64927079394d51d091d1097cafdb2d397e472` |
| `frontend/src/modules/invoices/components/InvoiceBridgeReprocess.tsx` | `8729ca1001690c7fda51f6196efe71567a0199d1eaa4dabcb8871775c44f7ed6` |
| `frontend/src/modules/invoices/components/InvoiceCdrModal.tsx` | `5bc1f7d0a2596263736da4b1e7a4bb42df9bdf1deb9fcde9c0ff0a5dd8d5229d` |
| `frontend/src/modules/invoices/components/InvoiceEmitCampos.tsx` | `26ffbe8ea6e5cce510d79e8fcf65e811930e3c2be9144309c19b93cab18b351f` |
| `frontend/src/modules/invoices/components/InvoiceEmitCamposTributarios.tsx` | `603b13f6e1370915f9e0fb032036ea3731cb5106617802d14ec6cfb0cdf9df53` |
| `frontend/src/modules/invoices/components/InvoiceEmitMenu.tsx` | `dba26df1067572c424e973c93c96f36d6a37ae4124b7969e8e63bf27f51167f2` |
| `frontend/src/modules/invoices/components/InvoiceEmitModal.tsx` | `9c604339d89585e01c793dff93a3e0bc94d76b5a9caf1439a61e6997a1cf88a0` |
| `frontend/src/modules/invoices/components/InvoiceEmitResumen.tsx` | `dca6cad07dfbf408de8fc81fb860cba4a42eceefefb8c2b2242492c56d1272ae` |
| `frontend/src/modules/invoices/components/InvoiceForcedResend.tsx` | `cf32b0a1b20eed16cf754523c25ba0fc18d8ee1468dbd197f151a2e55e666db0` |
| `frontend/src/modules/invoices/components/InvoiceItemsGrid.tsx` | `05b0a19cd628b7884c28a76f183e4641f23419a9590b81361317c998e112f871` |
| `frontend/src/modules/invoices/components/InvoiceKpiCards.tsx` | `c434b764e3eec381cedb1083b1d3b74776e5dfba377db7c158c039045a3d4177` |
| `frontend/src/modules/invoices/components/InvoiceOutboxMonitor.tsx` | `faa09067217628b0254e243e4fb046a73dc5f1bbcee7cec581d1a439d31bae30` |
| `frontend/src/modules/invoices/components/InvoiceTableRow.tsx` | `2e7729c9380396248d5d29a1934371e040854e1a14ea6e7bb43f6dec78dddd13` |
| `frontend/src/modules/invoices/components/InvoiceWriteButton.tsx` | `90adbf298335429134ca9eb7fbe4b903448fe6c04752b739548835b145c7c5cb` |
| `frontend/src/modules/invoices/hooks/useInvoiceWritePermission.ts` | `a51b42d4986d628024ee3567d42b87fa9a2c0e5e436efdcdbe10b8b422e55127` |
| `frontend/src/modules/invoices/lib/invoiceBags.ts` | `1d46782f9aa04f1ceae507ed19c7b4e794d1a044bc20b2dedd89af42afa94a05` |
| `frontend/src/modules/invoices/lib/invoiceCreditAndRules.ts` | `22ef5957686f130ac83d7457612fd2a607d85d709a0c0e40f2f9bdc55ed6f09c` |
| `frontend/src/modules/invoices/lib/invoiceEmissionValidation.ts` | `0acbaf5294f452d094600be6996846137b1799f38d620d7464394c3c826a1565` |
| `frontend/src/modules/invoices/lib/invoiceEmitDraft.ts` | `333fdb1c618f3aa82b4635915f9831dac9884327f7879f34254099d58a786dd4` |
| `frontend/src/modules/invoices/lib/invoiceEmitPayload.ts` | `ee276650c2d666744ee94d573040595b6f88e2f5cf5194f90a86837a196c4a56` |
| `frontend/src/modules/invoices/lib/invoiceEmitValidation.ts` | `449b5a119da4f33ab8338de6e7a4dc08e054b182350bd7f52a10fc9e9f29094b` |
| `frontend/src/modules/invoices/lib/invoiceItems.ts` | `ab7d035b0ab72a9f60e0645babe36dad0e4d475fd2b1021e012bf9aa45a84ee3` |
| `frontend/src/modules/invoices/pages/InvoiceBajasPage.tsx` | `bd65a6dfe4920bb23dfb25d174743249316b7446b66fbab520730fb21a52eb46` |
| `frontend/src/modules/invoices/pages/InvoiceEmissionPage.tsx` | `d18da8857146083987c82e835b640fd58552acfe9eb354d3e01ee085c4577390` |
| `frontend/src/modules/invoices/pages/InvoiceMonitorPage.tsx` | `2c3c6476261a1460a92a193877d52270f63adcaa8456d0c9e2ab3e85b01ef8ad` |
| `frontend/src/modules/invoices/pages/SalesReportPage.tsx` | `2b5ceb2a046576fb98f12c6da060134d316f86ba8077777ddad0d33fc724548b` |
| `frontend/src/routes/appRoutes.tsx` | `2e30a6541404d1f3189a55483458e6d0c095bef94d2f2093aa07297deb9b308d` |
| `frontend/test/unit/modules/invoices/EnviarResumenDiarioBoton.test.tsx` | `9c6269d2d030d1d2101ebbc2e7ed1c6d8b5d02d1fb900354d0ba467057fd26e4` |
| `frontend/test/unit/modules/invoices/invoice8cAggregateMonitor.test.tsx` | `58516c7623d6f898df1b47533093c372537829b9dd4803015ac5fff07fee3ffb` |
| `frontend/test/unit/modules/invoices/invoice8cBridgePending.test.tsx` | `e1676ec81dc51ac9c19d61edd6f8522303e7031ac73cdc64b5b9761fa8d0d6db` |
| `frontend/test/unit/modules/invoices/invoiceBagsRegistered.test.tsx` | `b8ad891d830c943823241cfec1e669667966020c65e5b1f222ed53857fbbc19c` |
| `frontend/test/unit/modules/invoices/invoiceBajaEnvio.test.tsx` | `631b8051430678d06ddaa906cb2a1c6c2a1434d215fc1660f12b740407bd2dbe` |
| `frontend/test/unit/modules/invoices/invoiceCazaBandeja.test.tsx` | `4a950d2b39b44f41946bf0609fac95d6ac5ebbc4af593574590bc61a8d4104be` |
| `frontend/test/unit/modules/invoices/invoiceCazaForm.test.tsx` | `ccebac132314dee33b3f2798e55383e65688952f5e7f67c9f14958796d5d3ff5` |
| `frontend/test/unit/modules/invoices/invoiceCazaQr.test.ts` | `486a83bae08fc2dc0e0a9648544933289860741b8f3eecc4a72af638d25d2a03` |
| `frontend/test/unit/modules/invoices/invoiceEmitPayload.test.ts` | `bdfd54e29269f16528f196e3c9b343a628645f46f3fcaa78df376cd450824964` |
| `frontend/test/unit/modules/invoices/invoiceFormValidation.test.tsx` | `1def3ba8beff25f873e0387c69a1665f5c907607abf9f0da83412b329199905e` |
| `frontend/test/unit/modules/invoices/invoiceHistoricasContrato.test.ts` | `40299e6ce5d3108e18b57df0e6b4f31779483a475c3cf2c2d3c2abd1238ba664` |
| `frontend/test/unit/modules/invoices/invoiceIdempotencyForm.test.tsx` | `75a47aca9d54a098c3172c18703cd46061460bf5fc412eb3be31dbe1818fda9e` |
| `frontend/test/unit/modules/invoices/invoiceIssuerRucPin.test.tsx` | `dcaea6c04bb8a780050d011ce504794543d746f1bc91998d56f087a6662a0c82` |
| `frontend/test/unit/modules/invoices/invoiceMonitorRetry.test.tsx` | `88c2c185ac377f4c1fa15fa335494df87ef4795fc2a10c5c900dc20eeb5a2dc9` |
| `frontend/test/unit/modules/invoices/invoiceNormativeRules.test.ts` | `24e20cf5af193c34c8d36d44e58f6428b76cf9b50f565c9731ea2317152dcfe3` |
| `frontend/test/unit/modules/invoices/invoiceNotaOrigenRegresiones.test.ts` | `907ba767b3b57bd4da3b8220d65b933a21ff72138f138d4f985c1bbebc7db66a` |
| `frontend/test/unit/modules/invoices/invoiceNotasErrorVisible.test.tsx` | `74295d6e3f349d8fd2ff0e89be56fab101ee7777736ef4d7472f86199044485a` |
| `frontend/test/unit/modules/invoices/invoiceNoteQuantities.test.tsx` | `6df2e39fc229b08e687cf71c60dc3c94f4b1d7bad7c6d39c25827b0706c6cef0` |
| `frontend/test/unit/modules/invoices/invoicePageKeyboard.test.tsx` | `432bf1096edf5abb16de55c119c7902daff0ad7bf8136d0b5c73181c2ff2cae6` |
| `frontend/test/unit/modules/invoices/invoicePulidoClienteEmision.test.tsx` | `9dd747da5b64140e6454e5e94ce8a481783b221d8a8779295104af268534778e` |
| `frontend/test/unit/modules/invoices/invoiceTa63Selector.test.tsx` | `ede2e5671b0c6a902c5233efcacba1d18a1effaf5a96d209db415ddd5010c89c` |
| `frontend/test/unit/modules/invoices/invoiceTramaQrDigest.test.ts` | `9ae13abe9e7a2ddcab9f608c739873bcf0c84a3787f2c4f7de189ac5040b7155` |
| `frontend/test/unit/modules/invoices/p9-campos.test.tsx` | `72d0160ed5cd0d52275f99e6892359d6ad420815cd0b223e98bf7071e523b8b8` |
| `frontend/test/unit/modules/invoices/p9-close.test.tsx` | `7ccadb8c85ed9ef5de0f9ec6828983958f1e7bfb6b51105933aef0716c2b29b7` |
| `frontend/test/unit/modules/invoices/p9-form-wiring.test.tsx` | `b3cee9b461ff69eeaee5606c099dfb3f50a66525642cf4d6ce53a178b70b7682` |
| `frontend/test/unit/modules/invoices/p9-report.test.tsx` | `5968d5e3c71f17661f01728daad0fe4cf79169e8690fb085fe47addcb4ecdf18` |
