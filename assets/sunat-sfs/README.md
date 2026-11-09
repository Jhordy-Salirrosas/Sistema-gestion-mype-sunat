# Juego completo de validación SUNAT — extraído del Facturador SUNAT (SFS v2.5)

## Procedencia

Estos archivos **no** vienen del paquete público «XSL Actualizado al 06092022» de la
página de Guías y Manuales de SUNAT: ese paquete trae solo las hojas principales,
sin la carpeta `commons`, por lo que las hojas se ejecutan pero **no validan**
(les falta `commons/error/validate_utils.xsl`, que define las plantillas de
validación y que SUNAT no distribuye como descarga suelta).

El juego completo sí viene **dentro del Facturador SUNAT (SFS)**, el aplicativo
gratuito de la propia SUNAT. Fue extraído de:

- Paquete oficial: `SFS_v-2.5.zip` — «Instaladores del Sistema Facturador SUNAT
  SFS v 2.5», enlazado en https://cpe.sunat.gob.pe/guias-y-manuales
  (URL directa: https://www2.sunat.gob.pe/facturador/SFS_v-2.5.zip)
- SHA-256 del ZIP: `6f59bf9ac8646cc32f1738703aa9cb5d3ae5020dc78f5a25551b08817aa93edf`
- Fecha de extracción: 2026-11-08 · Archivos internos del ZIP fechados 2026-09-25
- Ruta original dentro del SFS: `sunat_archivos/sfs/VALI/commons/`

Los archivos se vendorizan **byte a byte** como vienen en el SFS (sin parches);
las adaptaciones de motor se hacen al cargar, no sobre estos archivos.

## Contenido

- `commons/error/` — `validate_utils.xsl` (las plantillas de validación),
  `error_utils.xsl`, `validate_utils_dynamic.xsl`, `regexp.match.msxsl.xsl`
  (el propio SUNAT incluye un shim de expresiones regulares para otro motor).
- `commons/StringTemplates.xsl`
- `commons/xsl/validation/2.X/` — hojas `ValidaExprReg{Factura,Boleta,NC,ND}-2.0.1.xsl`.
- `commons/xsl/validation/1.X/` — hojas de Resumen Diario y Bajas
  (`ValidaExprRegSummary-1.1.0.xsl`, `ValidaExprRegSummaryVoided-1.0.1.xsl`,
  `ValidaExprRegOtrosVoided-1.0.1.xsl`).
- `commons/cpe/catalogo/` — los 60 catálogos (`cat_01.xml` … `cat_59.xml`,
  `CatalogoErrores.xml`, etc.) que las hojas consultan vía `document()`.
- `commons/xsd/` — los esquemas XSD oficiales UBL (2.0 y 2.1, `common/` + `maindoc/`),
  para la validación estructural.
- `verificacion/` — prueba funcional reproducible (ver abajo).

Hashes SHA-256 de los archivos clave (tal cual vienen en el SFS):

- `error/validate_utils.xsl`: `d3d4a1cac97a97101dba05bf7a88232894c776164ea6507238f1b171c71ce1d9`
- `error/error_utils.xsl`: `cf8f23347a665f2f54a14bdddc9edca5916c7e802236adf43d0615d0affcb545`
- `xsl/validation/2.X/ValidaExprRegFactura-2.0.1.xsl`: `99d0538abd70df90b5d9880cd42ed347636fa2aeec2fb55dab94472699ff3379`

## Verificación funcional (2026-11-08)

Con `verificacion/probar.py` (Python + lxml/libxslt) se ejecutó la hoja oficial de
Factura contra dos XML mínimos que solo difieren en la moneda:

- Moneda `BTC` → la hoja se detiene con el error SUNAT **3088**: «Valor no se
  encuentra en el catalogo: 02 (nodo: "Invoice/cbc:DocumentCurrencyCode"
  valor: "BTC")». La consulta al catálogo 02 funcionó.
- Moneda `PEN` → supera el control de moneda y avanza a controles posteriores
  (se detiene en el 3030 por campos que el XML mínimo no trae).

Conclusión: el juego está **completo y valida de verdad**. El diseño de SUNAT es
*fail-fast*: `rejectCall` usa `xsl:message terminate="yes"`, así que el primer
error detiene la transformación y su texto es el resultado de la validación.

## Adaptaciones de motor necesarias (para la integración, TA-70)

Las hojas están escritas para el gateway IBM DataPower de SUNAT; fuera de él hay
que suplir pocas cosas **al cargar** (verificado con libxslt; en Node aplica el
mismo principio con el motor que se elija):

1. `validate_utils.xsl`: sumar `func` a `extension-element-prefixes`
   (define una `func:function` EXSLT; sin esto un motor XSLT 1.0 la trata como
   elemento literal y rechaza sus `xsl:param`).
2. Hoja de Factura: `current-date()` es XPath 2.0; equivale `date:date()` (EXSLT),
   que el propio `validate_utils.xsl` ya usa.
3. `validate_utils.xsl`: `matches()` (XPath 2.0) equivale a `regexp:test()` (EXSLT).
4. Resolver de URIs para `local:///commons/...` y
   `sunat_archivos/sfs/VALI/commons/...`, y suplantar EXSLT `regexp` y
   `dyn:evaluate` si el motor no los trae (libxslt no los incluye).
5. Hay funciones DataPower (`dp:get-cert-serial`, `dp:radix-convert`,
   `dp:url-open`) solo en ramas de verificación de firma/consulta; no intervienen
   en la validación de un comprobante común.

## Nota de uso

SUNAT no publica licencia de redistribución sobre estos archivos; su uso aquí es
interno, como insumo del validador del proyecto, con la misma procedencia con la
que ya se vendorizaban las hojas públicas en `assets/sunat-xsl/`.
