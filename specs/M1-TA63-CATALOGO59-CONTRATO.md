# M1 — TA-63: Catálogo 59 y contrato del medio de pago de detracción

## Fuente oficial y activo documental

Documento: **Anexo N.° 8 — Catálogo de códigos**, Anexo V de la
**Resolución de Superintendencia N.° 318-2017/SUNAT**.
Sección: **Catálogo No. 59: Medios de pago**, página **15**.
URL oficial: <https://ww3.sunat.gob.pe/legislacion/superin/2017/anexosV-318-2017.pdf>.
Fecha de consulta: **2026-11-06**.

La siguiente transcripción íntegra fue verificada de primera mano por Emma y
proporcionada por el usuario para incorporarla al repositorio. Este activo
conserva la transcripción y su procedencia; no incluye una copia binaria del PDF.
El código admite las **22 entradas completas**, sin recortes, como cadenas
con sus ceros iniciales. Implementación: `src/modules/invoices/domain/rules/medioPagoDetraccion.ts`.

| Código | Descripción oficial |
|---|---|
| `001` | DEPÓSITO EN CUENTA |
| `002` | GIRO |
| `003` | TRANSFERENCIA DE FONDOS |
| `004` | ORDEN DE PAGO |
| `005` | TARJETA DE DÉBITO |
| `006` | TARJETA DE CRÉDITO EMITIDA EN EL PAÍS POR UNA EMPRESA DEL SISTEMA FINANCIERO |
| `007` | CHEQUES CON LA CLÁUSULA DE "NO NEGOCIABLE", "INTRANSFERIBLES", "NO A LA ORDEN" U OTRA EQUIVALENTE, A QUE SE REFIERE EL INCISO G) DEL ARTICULO 5° DE LA LEY |
| `008` | EFECTIVO, POR OPERACIONES EN LAS QUE NO EXISTE OBLIGACIÓN DE UTILIZAR MEDIO DE PAGO |
| `009` | EFECTIVO, EN LOS DEMÁS CASOS |
| `010` | MEDIOS DE PAGO USADOS EN COMERCIO EXTERIOR |
| `011` | DOCUMENTOS EMITIDOS POR LAS EDPYMES Y LAS COOPERATIVAS DE AHORRO Y CRÉDITO NO AUTORIZADAS A CAPTAR DEPÓSITOS DEL PÚBLICO |
| `012` | TARJETA DE CRÉDITO EMITIDA EN EL PAÍS O EN EL EXTERIOR POR UNA EMPRESA NO PERTENECIENTE AL SISTEMA FINANCIERO, CUYO OBJETO PRINCIPAL SEA LA EMISIÓN Y ADMINISTRACIÓN DE TARJETAS DE CRÉDITO |
| `013` | TARJETAS DE CRÉDITO EMITIDAS EN EL EXTERIOR POR EMPRESAS BANCARIAS O FINANCIERAS NO DOMICILIADAS |
| `101` | TRANSFERENCIAS - COMERCIO EXTERIOR |
| `102` | CHEQUES BANCARIOS - COMERCIO EXTERIOR |
| `103` | ORDEN DE PAGO SIMPLE - COMERCIO EXTERIOR |
| `104` | ORDEN DE PAGO DOCUMENTARIO - COMERCIO EXTERIOR |
| `105` | REMESA SIMPLE - COMERCIO EXTERIOR |
| `106` | REMESA DOCUMENTARIA - COMERCIO EXTERIOR |
| `107` | CARTA DE CRÉDITO SIMPLE - COMERCIO EXTERIOR |
| `108` | CARTA DE CRÉDITO DOCUMENTARIO - COMERCIO EXTERIOR |
| `999` | OTROS MEDIOS DE PAGO |

## Contrato para el front y consumidores API

- `POST /api/v1/invoices/emitir`: campo de cabecera `medio_pago_detraccion`.
- Payload interno y alta directa `POST /api/v1/invoices`: `payload_ubl.medioPagoDetraccion`.
- Ambos reciben exclusivamente una cadena exacta de la tabla anterior. No se
  normalizan espacios, números, descripciones ni códigos del Catálogo 51 (`1001`).
- Si viene informado, debe existir detracción efectiva (importe positivo;
  en el payload UBL también tipo de operación 1001–1004). Sin ella es error 400.
  `null` y cadena vacía son inválidos, no ausencia.
- En el alta se valida antes de reservar correlativo o persistir. El generador
  aplica la misma regla para la cola y para regenerar descargas.
- **En esta ronda es OPCIONAL**, incluso con detracción. Si no se envía,
  se conserva exactamente `PaymentMeansCode=999`. No se escribe ni infiere `001`.
- La selección se conserva en el JSON `payload_ubl` existente. No hay columnas
  nuevas ni migraciones. La ausencia sigue ausente en el JSON; el fallback se
  aplica únicamente al construir el XML.
- El XML conserva `cac:PaymentMeans/cbc:ID=Detraccion`; el código seleccionado
  va en `cac:PaymentMeans/cbc:PaymentMeansCode`. La cuenta BN y el orden UBL
  se mantienen. `forma_pago`/`formaPago` sigue siendo contado o crédito.

Ejemplo de cabecera del formulario (junto a los demás campos de emisión):

```json
{ "medio_pago_detraccion": "001" }
```

## Compatibilidad histórica y siguiente ronda

Los payloads históricos sin el campo siguen generando `999`, incluida la
regeneración para descarga. No se modifica ni se regenera un XML firmado ya
guardado por motivo de esta funcionalidad; se devuelve por el flujo existente.
No se actualizan comprobantes existentes ni trabajos en cola.

La **obligatoriedad al existir detracción se activará en la ronda de front**,
cuando la pantalla permita elegir y enviar explícitamente el medio real y se
coordine la compatibilidad de consumidores. No está activada aquí. El soporte
backend no equivale al cierre de la selección explícita en pantalla.

No se modifican tasas, cálculos, cuotas, correlativos, firma ni compuerta XSL.
La conformidad fiscal integral sigue sujeta a TA-70; los tests locales no
representan una emisión ni una validación oficial ante SUNAT.
