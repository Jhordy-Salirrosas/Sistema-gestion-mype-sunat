# M1 — TA-63: crédito, cuotas y detracción

Revisión sobre `dev` 3618507. No se emitieron comprobantes. Las pruebas no equivalen a una validación XSL oficial completa; la deuda TA-70 sigue abierta.

## 1. Forma de pago y cuotas — CUMPLE con la estructura oficial

`xmlNodesHelper.bloqueFormaPago` genera `PaymentTerms` repetidos con `cbc:ID=FormaPago`, cabecera `PaymentMeansID=Credito` y monto neto, y cada cuota con `PaymentMeansID=Cuota001`, `Cuota002`, monto y fecha. `ta63-credito-detraccion-spot.spec.ts` comprueba cabecera y cuotas. El editor del front muestra «Pago a crédito en N cuotas» y el neto; lo prueba `invoiceTa63Resumen.test.tsx`.

La formulación solicitada «IDs 2001, 2002» no coincide con el [Anexo IV de la RS 193-2020/SUNAT](https://www.sunat.gob.pe/legislacion/superin/2020/anexo4-193-2020.pdf): SUNAT indica `FormaPago` y `Cuota<NNN>`. No se cambiaron los XML a códigos incompatibles.

## 2. Suma exacta en céntimos — CUMPLE tras corrección

`paymentTermsAndSpotValidator.validarPago` compara suma y neto en céntimos; `invoiceDetraccion.validarCronograma` y `CreditInstallmentsEditor` lo comprueban en el formulario. Se añadió el rechazo explícito de fracciones de céntimo en ambas capas para que la suma redondeada no difiera de los importes serializados. Pruebas: `ta63-credito-detraccion-spot.spec.ts`, `m1-ta63-catalogo-fechas.spec.ts` e `invoiceTa63CatalogoFechas.test.ts`.

## 3. Fechas posteriores y forma declarada — CUMPLE en el formulario tras corrección

El formulario permite elegir contado o crédito y envía `forma_pago`. Ambas capas bloquean cuotas que vencen el mismo día o antes; ahora también rechazan fechas que JavaScript normalizaría silenciosamente, como el 30 de febrero. Pruebas: `ta63-credito-detraccion-spot.spec.ts`, `m1-ta63-catalogo-fechas.spec.ts` e `invoiceTa63CatalogoFechas.test.ts`. El validador backend conserva su compatibilidad histórica: si otro consumidor no envía forma, asume contado; esto no es la elección explícita de la pantalla.

## 4. SPOT y Catálogo 54 — CORREGIDO EN EL SUBCONJUNTO OFRECIDO; validación fiscal integral pendiente

`emitirComprobanteAdapter` usa como base de las líneas sujetas el valor de venta más IGV e ICBPER, con los descuentos aplicables; no se cambió esta base. Se corrigieron las descripciones y porcentajes del subconjunto ofrecido en backend y front: 012 intermediación laboral 12%, 019 arrendamiento 10%, 022 otros servicios empresariales 12%, 027 transporte terrestre 4%, 035 bienes exonerados 1.5%, 037 demás servicios gravados 12% y 039 minerales no metálicos 10%. Las listas son un subconjunto, no el catálogo completo. Las pruebas nuevas contrastan ambos lados y las existentes rechazan 006, 018, 029 y 033.

Evidencia: [códigos de SUNAT](https://www.sunat.gob.pe/orientacion/Detracciones/InstructivoDepositoIndividualnuevaversion.pdf), [tasas de servicios](https://orientacion.sunat.gob.pe/3142-03-en-la-prestacion-de-servicios-empresas) y [tasas de bienes](https://orientacion.sunat.gob.pe/3141-02-en-la-venta-de-bienes-empresas). El 4% no corresponde a todos los servicios ni el 10% a todos los bienes.

El `1001` del Catálogo 51 es **tipo de operación**, no medio de pago; el sistema lo emite para la operación sujeta a detracción. SUNAT muestra `001` como depósito en cuenta en su [guía de factura con detracción](https://cpe.sunat.gob.pe/sites/default/files/inline-files/factura%20con%20detraccion-2-6.pdf). El XML actual usa `999` del Catálogo 59 en `PaymentMeansCode`; no se reemplazó por `1001`. La selección explícita y validación del medio de pago real queda pendiente; no se debe afirmar que la constancia ya declara el depósito en cuenta. No se verificó el XML ante SUNAT.
