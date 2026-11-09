# Fixtures TA-70

`factura.xml` deriva de `assets/sunat-sfs/verificacion/factura_pen.xml`.
Se retira UBLExtensions vacío (no cumple XSD 2.1) y se añade el local anexo
0000 del emisor de prueba. No es una factura emitida ni evidencia de aceptación
SUNAT. Boleta deriva de esa factura con serie B001 y tipo 03; Nota de Crédito
usa raíz/línea CreditNote, serie FC01 y motivo 01 con referencia F001-1;
Nota de Débito usa DebitNote, serie FD01 y RequestedMonetaryTotal.

Los cuatro fixtures pasan XSD y la hoja XSL oficial correspondiente con las
adaptaciones temporales autorizadas. Las pruebas cambian DocumentCurrencyCode
a BTC para obtener 3088, retiran AddressTypeCode para obtener 3030, cambian el
motivo de NC a 99 para obtener 2172 o el precio a negativo para obtener 2369.
Retirar el ID obligatorio acredita rechazo XSD antes del catálogo de moneda.

La cuarta adaptación solo renombra variables duplicadas y sus referencias
locales en la copia temporal. Cada instancia, archivo y línea está documentada
en `docs/m1/auditoria-solucion.md`, sección TA-70. Los assets originales no se
modifican; las pruebas comprueban que no cambian fórmulas ni reglas SUNAT.
