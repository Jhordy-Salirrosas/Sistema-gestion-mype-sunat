# M1: ICBPER y códigos de afectación

La línea usa actualmente `10` en `TaxExemptionReasonCode`, campo de afectación al IGV del Catálogo 07. SUNAT identifica `10` como **gravado - operación onerosa**. Esa selección corresponde solo cuando la transferencia de la bolsa tiene esa afectación; la guía no establece que toda bolsa deba recibir siempre `10`.

El código `9998` pertenece al **Catálogo 05**, donde identifica el tributo inafecto; no es un valor válido del campo de afectación del Catálogo 07. El ICBPER se identifica en el Catálogo 05 como `7152`, separado del IGV. Por ello no se reemplaza `10` por `9998` en `TaxExemptionReasonCode`.

Fuentes oficiales:

- SUNAT, [Catálogo 07, UBL 2.1](https://www.sunat.gob.pe/legislacion/superin/2017/anexoVII-117-2017.pdf): `10` = gravado, operación onerosa.
- SUNAT, [Catálogo 05 actualizado por la RS 244-2019](https://www.sunat.gob.pe/legislacion/superin/2019/anexo-244-2019.pdf): `7152` = ICBPER y `9998` = inafecto.
- SUNAT, [guía de factura UBL 2.1](https://cpe.sunat.gob.pe/sites/default/files/inline-files/guia%2Bxml%2Bfactura%2Bversion%202-1%2B1%2B0%20%282%29_0%20%282%29.pdf), sección 42: la afectación se determina por la operación del ítem.

La clasificación tributaria de una entrega concreta no se puede deducir únicamente de que exista ICBPER. Esta revisión no verifica un XML contra SUNAT ni autoriza emisiones de prueba. Las hojas XSL locales dependen de recursos que el proyecto declara ausentes, por lo que no se afirma validación oficial completa.
