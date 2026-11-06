# M1: compuerta XSL no concluyente

## Evidencia y causa

Según los logs de Render comunicados en la auditoría del 5 de noviembre de 2026, entre las 22:40 y las 22:42, F001-00000057 quedó firmado en cola: TA-58 devolvía el job sin consumir intento porque la hoja SUNAT requiere `commons/error/validate_utils.xsl`. No se llamó a SUNAT. No se han consultado esos logs desde esta rama; son evidencia reportada por el usuario.

`SunatXslAdapter` retira los `xsl:include`, y `validaDeVerdad()` devuelve siempre `false` porque faltan las plantillas de validación. Anteriormente `SunatXslValidatorService.interpretar` convertía esa situación en bloqueo tras ejecutar la transformación; `decidirEnvio` lanzaba `ErrorValidacionBloqueada` y `InvoiceJobConsumer.bloqueoDeInfraestructura` la relanzaba a la cola.

## Decisión

Una hoja que declara errores sigue bloqueando; una hoja ausente, XML mal formado u otro error inesperado también. Solo se declara XSL no concluyente si la hoja cargada contiene un `xsl:include` activo de `commons/error/validate_utils.xsl` y ese archivo no está presente. La inspección se cachea por ruta de hoja durante la vida del servicio, sin ejecutar la transformación completa para cada job. `valido` y `validadoDeVerdad` siguen siendo falsos. Si el adaptador no puede validar por una causa distinta, bloquea.

Antes del despacho con resultado no concluyente se comprueba el XML que efectivamente se enviará, incluido el XML firmado guardado en un intento anterior. Una falla de estructura o de las reglas internas existentes bloquea. Además se persiste un aviso específico en `TransactionHistory`; si falla esa escritura, no se despacha. El historial se expone en el detalle del backend (`GET /api/v1/invoices/:id`, campo `historial`).

**Límite aceptado expresamente:** `XsdValidatorService` no ejecuta los esquemas XSD oficiales: usa comprobaciones de estructura y nodos, más las reglas internas de `xsdBusinessRules`. Por tanto el despacho no demuestra conformidad XSD completa. Se acordó utilizar las comprobaciones existentes y declarar esta limitación; no se modificaron sus reglas ni se presenta la XSL como válida. El validador XSL real continúa como deuda TA-70.

El detalle actual del frontend muestra una bitácora resumida y no consume el campo `historial` del detalle; por ello el aviso queda disponible por la API pero **no queda visible en esa pantalla**. La visualización requiere un cambio de frontend fuera del alcance autorizado para esta rama.

No se emitió ningún comprobante como prueba; el envío de los tests usa un doble.
