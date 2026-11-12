# Ferry — Validaciones de formularios M1

Base del front: `73af439c48d1e8937133b52f8b525bbecfe7540f`. Rama: `ferry/m1-formularios-validacion`.

Publicación de transporte en el repositorio del back; los archivos se aplican al front. No se promueve esta rama como código del back. Aplicar los cinco commits en orden sobre la base indicada; no copiar FERRY.md a producción. Instalar dependencias con `npm ci`: se añade validator y su tipado para compartir el criterio de email con el back.

## Alcance

Grupos 1, 3, 4, 5 y 6. El grupo 2 (bolsas/ICBPER) permanece pendiente de autorización. No se modifican sus códigos sintéticos, payload ni selección. Atajos y navegación desde resúmenes solo se auditaron; no se construyen aquí. Sin migraciones, emisiones reales ni PRs.

## Comprobación

Línea base: 136 archivos / 972 pruebas. Cierre: 141 archivos / 1030 pruebas aprobadas; `tsc -b` y build Vite aprobados. Las pruebas anteriores de limpieza de errores, presentación y foco conservan sus aserciones con datos válidos; el filtro de notas usa un rango válido para comprobar el vacío de ambas secciones.

## Commits y archivos con SHA-256

Los hashes corresponden al contenido final, excluyendo este manifiesto para evitar una referencia circular.

### Grupo 1 — 2df92f801e8627e5c29c3d2fde2dc89eb4183964

| Archivo | SHA-256 |
|---|---|
| `src/modules/invoices/components/CustomerLookupField.tsx` | `045ec6d5e4e5fd69e630e4695ff3a4896cd256ebdfadc5acc7d360e4d817c919` |
| `src/modules/invoices/components/InvoiceEmitModal.tsx` | `8fbb98dae9f25ce54b598e51ce4e29241958e8da8dd38c289971d073daf961a1` |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | `273f37a07ecbdb2bf7254eaaa5c6d153af99b0b67b556b51c635b9c12dd364c8` |
| `src/modules/invoices/lib/invoiceEmissionValidation.ts` | `455d47fa1dab3e2c3d1dbb00e1f768038c344e05530664e1dde4dc3acc7ef4d9` |
| `src/modules/invoices/lib/invoiceItems.ts` | `91d5365fe343ab6396747cf409ddaa5e3c7b689d8b2db7f9dd894a5b09c32074` |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | `5e34d71390d2b1a5082bb1d263a4a91a4b14d94b8970460218764800641947b6` |
| `test/unit/modules/invoices/invoiceAvisosImportes.test.tsx` | `d0db657e35a711b3728942f6f7b4ea7a5d584e230110ba6d5ecf5d089fd4c10c` |
| `test/unit/modules/invoices/invoiceCazaForm.test.tsx` | `d430ac20a7324355494c6966e85f67bbf10eaa94545d2278e3c93b3ba8de5577` |
| `test/unit/modules/invoices/invoiceFormValidation.test.tsx` | `c0158e6dd0fa03575bcbd8ec72d37110284f5177da6ce2bd265a953fc4e5f495` |
| `test/unit/modules/invoices/invoiceItemsLayout.test.tsx` | `491076dc31e0c803f18bb29aff2651906dbf2fe111116a9b08bb0fa7e02c1fbc` |

### Grupo 3 — 5c4dbe0af029100ed704e93a8420d8453c8fd6f0

| Archivo | SHA-256 |
|---|---|
| `src/modules/invoices/components/InvoiceIssuerConfigForm.tsx` | `6066c9bb65599a72854b7a908fc7edd57baf175de7f819c656c3968c189ab4b5` |
| `src/modules/invoices/components/InvoiceSeriesForm.tsx` | `721ba4b1feb95f4b89680e0b7d22d20997c9f24ee616cd76d73b5dd3a757db42` |
| `src/modules/invoices/lib/invoiceConfigurationValidation.ts` | `58273e8c2b229057cd42b7c9bd2d91c63167f136528f1a9b1e1215c05a7cc4b7` |
| `test/unit/modules/invoices/invoiceConfigurationValidation.test.ts` | `55a696871d8784d01eacdce951285d0592c82e2d1a387ace007a109469214d89` |

### Grupo 4 — f59b9835da34863662f05dbd662d2a327b0c3b3c

| Archivo | SHA-256 |
|---|---|
| `src/modules/invoices/lib/invoiceDepositValidation.ts` | `f14f82007af182ae24fae8034ceab669772d944cd3fa38078f71608f4fec0ed9` |
| `src/modules/invoices/pages/InvoiceDetractionsPage.tsx` | `35d5b56eda5e4d2b2725b863e8d2911fce6f76c7e777d21163080abc0b463082` |
| `test/unit/modules/invoices/invoiceDepositValidation.test.tsx` | `7dc693b7f7bafc3854564a1c18dac9173f2bb5c5f6f369263f04c717435adcca` |

### Grupo 5 — f58f6223f4ea774979b678fa71cef34177d43e51

| Archivo | SHA-256 |
|---|---|
| `package-lock.json` | `f696f1f78d10fc0e8ef06eeb46a570aa4776fc8a084fa3ada0f3618d949b61d5` |
| `package.json` | `e29b398865060a23114a3f6d9d53d732d17a4b2a46b6f188e5e384db2616100c` |
| `src/modules/customs/components/PartnerFormDialog.tsx` | `d8af050b39a3c63e9a914a2176235591fe764c99425738c25a52b03dd35f7973` |
| `src/modules/customs/libPartnerValidation.ts` | `b4d600a407b053061bce0f6e1933682e22b3317d708dbd0fe2e015f4e4b8df25` |
| `test/unit/modules/invoices/invoiceCierreDocente.test.tsx` | `f9f8f6687ec98042bf5ae2973e630ab510fef3fc13bfd35e3f92fc0935a17b9a` |
| `test/unit/modules/invoices/partnerFormValidation.test.tsx` | `59fbf9aaf8df79dd4a995f4651757edb671dda01349b82008b99acfaf6e9563c` |

### Grupo 6 — este commit (grupo 6 y manifiesto)

| Archivo | SHA-256 |
|---|---|
| `src/components/common/PeriodInput.tsx` | `c024d88e1432a87f74b99e7faa3abec803795cf7a1019f3d86423c1c6bd738f0` |
| `src/modules/invoices/components/InvoiceFiltersBar.tsx` | `7391f6291e94de3c19b18d5360fad7a6b9eb88e1c773066c925aac5a809786de` |
| `src/modules/invoices/lib/invoiceDateRange.ts` | `6a5a0c32c09ddfb3be186da430d91b8fb3dd1260239321fbced0ff8311fe621a` |
| `src/modules/invoices/pages/SalesReportPage.tsx` | `7abe67ec9e70cd0f77f84b328b3a5df639438259f76c9d79590301ce6b8ea242` |
| `test/unit/modules/invoices/invoiceDateForms.test.tsx` | `fb4c587ce2291495daa15f58c7b1399a53cb975338c5d832fe1bd2a68c975b24` |
| `test/unit/modules/invoices/invoiceNotasSeparadas.test.tsx` | `1254fd914b9983142578d2859cbb421f2c87e06921c3574376248682cd8a6049` |

## Aplicación

Conservar los cambios del maestro compartido para sus demás consumidores. El nombre comercial y el email continúan siendo opcionales; si se aportan, se validan. No se modifican datos históricos ni se amplía el contrato. El precio de las gratuitas sigue en cero y su referencia es positiva; las excepciones de notas se conservan. La batería contra SUNAT beta corresponde a la promoción posterior.
