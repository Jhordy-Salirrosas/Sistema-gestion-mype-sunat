# FERRY — Parte 6, cierre del recorrido M1

Destino: repo front CarlosSoles/Fronted-sistema-mype-sunat, dev.
Base front: a38c8729bf92e74ac5a6ae099872ae21938885c3.
Base del contenedor back: b20706f73ca2e0481cac3379cd1b5dc879c080c9.
Aplicar SOLO las rutas del manifiesto, en sus rutas exactas; no fusionar esta
rama como código back. No se publica ningún commit en el remoto front desde Codex.
Requiere la rama back fix/m1-cierre-recorrido para catálogo histórico, series ADMIN,
notas OBSERVADO, reenvío forzado y cuenta BN/SPOT.

## Resultado

6A notas sin precarga ficticia, precios a dos decimales y misma fuente de catálogo.
6C repetición SKU exige fusionar/separar/cancelar; fusión solo compatible.
6D MTQ válido. 6E búsqueda muestra precio final. 6F gestión de series ADMIN.
6G errores asociados, selectores/autocompletado y ayuda de atajos visible.
6H notas desde OBSERVADO con saldo protegido. 6I acción ADMIN con motivo y
confirmación para incertidumbre; constancia durable, sin reenvío automático ciego.
6J mínimo SPOT 009 arena/piedra, factura PEN >700, 10%, medio 001/003 y cuenta
BN de empresa. Sin clasificación automática por producto ni migraciones.
6B queda documentado en back con la exportación de Emma; no se limpian datos.

Excepción autorizada por Emma/Jhordy el 10 nov para aviso al equipo:
PartnerFormDialog.tsx SOLO presentación (requeridos, mensajes asociados y foco).
Campos, validación, mutationFn y envío del componente compartido intactos.
No hay otros cambios de código fuera de M1.

## Verificación

Base front: 105 archivos /829 pruebas. Final: 112 archivos /848 pruebas, 0 fallos.
Build final OK. Back: 274 suites/2532 pruebas aprobadas, 4 suites/38 pruebas
omitidas (igual que la base), 12 snapshots; build y lint back OK.
Dependencia back de entrega: 5f92f8598e09ae59c26286bab31bd864ce8f2fd8.
ESLint de archivos modificados conserva 2 errores y 5 avisos YA presentes en dev
(dos set-state-in-effect y avisos FastRefresh/dependencias); comparación con las
fuentes de base por stdin, sin relajar reglas ni cambiar configuración.
Sin emisiones reales, llamadas reales SUNAT, PR, merge o despliegue.

## Commits de origen (front local)

```
cbc3828 fix(m1): 6D admitir Arena con unidad MTQ
ae83349 fix(m1): 6E mostrar precio final en la sugerencia de productos
67c5f5b fix(m1): 6H permitir seleccionar origen observado para notas
935b50d fix(m1): 6A presentar precios y existencia de notas sin datos obsoletos
6687654 fix(m1): 6C exigir decision sobre lineas duplicadas
9ab0d63 fix(m1): 6F gestionar series por ADMIN y refrescar configuracion
6dbab5b fix(m1): 6G presentar validacion y navegacion accesible sin cambiar envio de terceros
a02aab2 fix(m1): 6I exponer decision ADMIN de reenvio forzado con motivo y confirmacion
4cd1e97 fix(m1): 6J seleccionar SPOT 009 y cuenta BN con medio explicito
```

## Manifiesto (44 rutas, sin eliminaciones)

| Ruta | SHA-256 |
|---|---|
| `src/modules/customs/components/PartnerFormDialog.tsx` | `8cc96fe57fbad75e2bc6fe35d96dee958ae3eb3f526a94a0ec58aca5482e8130` |
| `src/modules/invoices/components/CustomerLookupField.tsx` | `84a6dafc17913b029c9a2c15506f55b696524cc425e593854c1271f64b34967c` |
| `src/modules/invoices/components/InventoryProductSearchSelect.tsx` | `7353006ce1dace75b7f873cb97aa23767cc8a73ffde3e567c867d2ed96896ed7` |
| `src/modules/invoices/components/InvoiceCdrModal.tsx` | `aaf41c0b8f49f0a914963e3c49377eb025ecad67cafa060b47697d2135002a32` |
| `src/modules/invoices/components/InvoiceEmitCampos.tsx` | `01c3db2a9d6b9b92dee86a86858f341ba7290bf7643626995729fb0da54691e1` |
| `src/modules/invoices/components/InvoiceEmitCamposBase.tsx` | `5079f54f4bc8a04405bbef4314e86cd287f6deffaa82f2b1c2767ceced0e3ca7` |
| `src/modules/invoices/components/InvoiceEmitCamposTributarios.tsx` | `ebc4918fc13912949e737861cb4940f43b55e3d85167455d13409c8361b40e97` |
| `src/modules/invoices/components/InvoiceEmitModal.tsx` | `ffefbd6e6a0f7eddb213322527a0de8ba3b8429ffdfd2fa4d013ca95f928d83e` |
| `src/modules/invoices/components/InvoiceForcedResend.tsx` | `acaedcf2f3daa8b17e393c5e1d5ff2630661d8c1b0246c47eda000507b4ea12f` |
| `src/modules/invoices/components/InvoiceIssuerConfigForm.tsx` | `806d1444a1626db3b2f358f3e0c5b6a50a36da1204d5faa248b3d94def3c32ab` |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | `372eb42bd05703cda049a7395e988dd6d6fe561359144e8eb1434661432718a1` |
| `src/modules/invoices/components/InvoiceMoneyInput.tsx` | `b8c392c180db1965147efd38cc0a61230060246c8793dd77d29981f20f49977a` |
| `src/modules/invoices/components/InvoiceSeriesForm.tsx` | `b4154b3b5d13289cd844bc47eb549c50c09433d4c782a0aee34aa39de0f3d248` |
| `src/modules/invoices/components/InvoiceSettingsTab.tsx` | `d57375a9c354c174bd5c2903d62934af8f1f24e82a8ba577de1179ce2b1f02ad` |
| `src/modules/invoices/components/MedioPagoDetraccionSelect.tsx` | `6445b6f771805c998718890682154e3d207cd24235e19dc8c0263e89f5ca147c` |
| `src/modules/invoices/components/useInvoiceDuplicate.tsx` | `cc378170bd43cce6dffe0cfdda5687a54b74d01c87f1a1ea48e3cbe0daaec6a8` |
| `src/modules/invoices/components/useInvoiceKeyboard.tsx` | `0058d093b8c202ea2a6aad4a33bbc9d34132c9bd814071733f9811600a21a4b4` |
| `src/modules/invoices/hooks/useInvoiceConfig.ts` | `6cb023efbef464bcb6e3f1d2fe258984414dfe4b27053a5a06cbfca5a5998e0d` |
| `src/modules/invoices/lib/invoiceDetraccion.ts` | `cc0282ef96d79b4dc99cf9d59120878c2b2abaf5815fdeb64c303ece87557c09` |
| `src/modules/invoices/lib/invoiceEmitDraft.ts` | `6c3209e6fd2f5b32ecfb2aba180ef5f7f41eae765a7570b3a274f170ecf877f6` |
| `src/modules/invoices/lib/invoiceItems.ts` | `78819426f09d9e10c65ebd86e4a9de4823900681f57a3cbf67c0e181cdb00ba4` |
| `src/modules/invoices/lib/invoiceNotaOrigen.ts` | `299289c3b41ca8b8ebbc2a724a0b45d7a6161d888f9b0a1654f0a10aad036608` |
| `src/modules/invoices/lib/invoiceSearch.ts` | `2b5dfde6d2ccd3c1d8c6da44b1c66f3436dffae0fd4af4ee0449f30e870a5fc3` |
| `src/modules/invoices/lib/invoiceStockLinea.ts` | `4a8d2386557ab1718bb155f8700db08d23d9f3bedd138b49ce954319bdbfdfa5` |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | `875ff888c1ecb0c5061a77cdb1ee4235a0bfd3403224b0a663bcca34f9b2fc6d` |
| `src/modules/invoices/pages/InvoiceSettingsPage.tsx` | `8a7c366093c219a279275e41741fec94ffc4e7726608416a47e95c170ce96289` |
| `src/modules/invoices/services/inventoryProductsApi.ts` | `b327587c1dd806a90bc063fdfea35a3bf4b2da680d5f201f8e4f5f5f43a3937f` |
| `test/unit/modules/invoices/inventoryProductsApi.test.ts` | `80276e7e0ef92fd40dd042484d17f661518d23af8b9cb70c078f239788a21544` |
| `test/unit/modules/invoices/invoiceCazaForm.test.tsx` | `9007da88ff87d2eeb692e8ceb0104ae776d126b12a18ec1cdf77cfb893f40187` |
| `test/unit/modules/invoices/invoiceCierreDocente.test.tsx` | `0503fe7b74f31786440ff02977aa3c8c36a0c04a541727b6780964a27ed80a86` |
| `test/unit/modules/invoices/invoiceCierreDuplicados.test.tsx` | `c71f8388fcaa85237b17f4de551adafe3970aee7080eec1942c647ebf784edb8` |
| `test/unit/modules/invoices/invoiceCierreForzado.test.tsx` | `609b7e53d3e02d49fd26627563959a971a7d3a29deb9818e17bccc437ed602aa` |
| `test/unit/modules/invoices/invoiceCierreNotas.test.tsx` | `fa9e65669778b9abc0998f55881c76db3033aba952042649c7607a0437abca51` |
| `test/unit/modules/invoices/invoiceCierrePrecio.test.tsx` | `1c3d5bf5008c55bab41821681a712950cfeacccefd6865c09229cc04d9722201` |
| `test/unit/modules/invoices/invoiceCierreSeries.test.tsx` | `e3022923f39be8a64a151b05982cb66b60b86f3b2f3c03135dadde3fb3a63389` |
| `test/unit/modules/invoices/invoiceCierreSpot.test.tsx` | `25a5f1217cbf557bbe1e186e50cb52a7b435631d6ab13dfe4009ca943054d115` |
| `test/unit/modules/invoices/invoiceFechaImportes.test.tsx` | `06a8643050abb5575050fc72281be59e974be58200c56692f6f351b92af4232f` |
| `test/unit/modules/invoices/invoiceIdempotencyForm.test.tsx` | `69c44e175e74ffd93a2cd673e53ccbadda16b8f9eda3b8d82ed8a440cb7c68b2` |
| `test/unit/modules/invoices/invoiceItemsFromProduct.test.ts` | `fe615a79d305d80cd0060fead04aa4922b6660f5cfe04bff68628b0d1521187f` |
| `test/unit/modules/invoices/invoiceNotaOrigen.test.ts` | `d2ca5372be8644a73db9f1a7d6c57a5a412169a52841ba418bde73560b14b1cb` |
| `test/unit/modules/invoices/invoiceNotasLineasOrigen.test.tsx` | `f8e9f9601f1efead46047a084c06499b7bf76bf17fdeffdde2c82153ace57925` |
| `test/unit/modules/invoices/invoiceSpotCentimos.test.tsx` | `cc15c87af12ee619422e5eb26927b9b9c5b8b81a16f149c4c7c6cac37e166a86` |
| `test/unit/modules/invoices/invoiceStockLinea.test.ts` | `8da426159040a658ab01cdf1e94acb3feb83805f8a0ba47870bd5b85d1f1fb59` |
| `test/unit/modules/invoices/invoiceTa63Selector.test.tsx` | `267a19f9370ecd11159092708741cae0b1c0caa36d81435e81e901169f9082c7` |
