# Fixtures del pipeline de emisión

Insumos de prueba del pipeline de facturación electrónica. **No contienen datos
reales ni credenciales**: el RUC `20123456789`, la serie `F001` y el correlativo
`1` son ficticios.

## Como se regeneran

    npx ts-node scripts/sunat-fixtures/generar-certificado-prueba.ts
    npx ts-node scripts/sunat-fixtures/generar-factura-firmada.ts
    npx ts-node scripts/sunat-cdr-fixtures/generar-fixtures.ts

Los tres scripts reutilizan la logica del PoC de SP-04 (`scripts/poc-cdr/`), que
fue el que valido la cadena Base64 → ZIP → XML con `adm-zip` y
`fast-xml-parser`.

## Por que hay fixtures en pares

Los CDR se guardan como `.xml` y `.base64`:

| Sufijo    | Que es                                       | Para que sirve                                                                |
| --------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| `.xml`    | El CDR legible                               | Revision humana: permite verificar a ojo que se esta probando                 |
| `.base64` | El `applicationResponse` real (ZIP + Base64) | Es exactamente lo que devuelve el `billService` y lo que consume `parseCdr()` |

Guardar solo el `.base64` haria la prueba opaca; guardar solo el `.xml` no
probaria la descompresion, que es el criterio 2 de TA-03.

## `sunat-cdr/` — constancias de recepcion

| Archivo                      | Escenario                           | Que verifica                                      |
| ---------------------------- | ----------------------------------- | ------------------------------------------------- |
| `aceptado`                   | `ResponseCode` 0 sin observaciones  | Camino feliz, estado ACEPTADO                     |
| `rechazado`                  | `ResponseCode` 2326                 | Rechazo de la familia 2xxx, no reintentable       |
| `observacion`                | `ResponseCode` 0 mas `Note` 4031    | Aceptado CON observaciones: sigue siendo valido   |
| `aceptado-ubl21-prefijos-ns` | Prefijos `ns3` y `ns4`              | El parseo no depende de los prefijos de namespace |
| `aceptado-latin1`            | Declaracion ISO-8859-1              | El texto con tildes no se corrompe al decodificar |
| `excepcion-0100`             | `ResponseCode` 0100                 | No se pierde el cero inicial del codigo           |
| `aceptado-con-atributo`      | `ResponseCode` con `listAgencyName` | El extractor soporta string, objeto y array       |

Solo los tres primeros son obligatorios segun el ticket. Los otros cuatro cubren
casos limite que solo aparecen con respuestas reales de SUNAT.

## `sunat-invoice/` — el comprobante

| Archivo                     | Que es                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `factura-ubl21.xml`         | Factura UBL 2.1 sin firmar, con el nodo `ext:ExtensionContent` vacio donde va la firma |
| `factura-ubl21-firmada.xml` | La misma factura con el `Signature` y el `X509Certificate` embebido                    |

**El `cbc:ID` es `F001-00000001`, y coincide a proposito con el `ReferenceID`
del CDR aceptado.** Si no coincidieran, SUNAT responde con el codigo 1049.

Este fixture es el insumo de:

- **TA-07**: firma el XML. La tarjeta de esa tarea dice que se construye contra
  el fixture de TA-08.
- **TA-09**: valida la estructura contra el XSD UBL 2.1.
- **HU-04**: genera el XML UBL del worker.

## El certificado de prueba no esta en el repositorio

El certificado **no se versiona**. Un `.p12` con contrasena es una credencial,
aunque sea de prueba, y el criterio 4 de TA-08 prohibe versionar credenciales.
Ademas, `CertificateService` (TA-04) lo carga desde la variable de entorno
`CERT_BASE64`, no desde un archivo.

En su lugar hay un **generador**: `scripts/sunat-fixtures/generar-certificado-prueba.ts`
produce un PKCS#12 autofirmado que cumple las cuatro validaciones de TA-04:

1. Sale en Base64, listo para `CERT_BASE64`.
2. Contiene el par certificado y clave privada.
3. Tiene dos anos de vigencia, asi que no dispara la advertencia de vencimiento.
4. El RUC aparece en el `commonName` del subject, para que coincida con
   `RUC_EMISOR`.

Los archivos se escriben en `fixtures/certs/`, que esta ignorado por git. Para
usarlos:

    RUC_EMISOR=20123456789
    CERT_PASSWORD=prueba-ta08
    CERT_BASE64=<contenido de fixtures/certs/certificado-prueba.base64>

## Las pruebas

    node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand test/fixtures/sunat-fixtures.spec.ts

Verifica los criterios del ticket: que los fixtures existan y sean validos, que
el certificado sea aceptado por `CertificateService`, que la firma sea
**criptograficamente valida** (no solo que el nodo exista), y que TA-03 consuma
correctamente los tres CDR.

## Origen de los datos

- **Estructura del CDR**: verificada contra el WSDL y los XSD oficiales del
  `billService`, y contra CDR reales de SUNAT.
- **Estructura de la factura**: XSD UBL 2.1 oficial, disponible en
  `Taller\Otros\Archivos XSD (1)\Archivos XSD\2.1\maindoc\UBL-Invoice-2.1.xsd`.
- **Descripciones de los codigos**: hoja `CodigosRetorno` de SUNAT
  (`Reglas de validacion - actualizado al 26.08.2026.xlsx`, 2.077 codigos),
  contrastada contra el `CatalogoErrores.xml` del facturador SFS v2.5.
