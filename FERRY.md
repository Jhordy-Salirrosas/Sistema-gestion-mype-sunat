# M1 · Bandeja y Monitor sin botón redundante; cabecera del detalle

## Base y destino

- Front: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base exacta del paquete: `main`, `3b9b13aa403afefa2214919f5cc6cee5a9673b42` (merge del PR #383).
- Rama front sugerida: `fix/m1-bandeja-sin-boton`.
- Commit local del estado completo: `94bec95c9bb6b00827939e96286e347bedd171c8`.
- Transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`, rama `ferry/m1-bandeja-sin-boton`.
- Base del transporte: `334a9bf17cac90a22922bf60c0cad4a5409980ff`.
- Corrección añadida sobre el ferry `10062352767b1f55fc79173423e2be9334fa7613`, conservando el mismo paquete y rama.

## Archivos y diff completo contra la base front

Copiar los siete archivos bajo `frontend/` a sus rutas relativas a la raíz del front:

| Ruta en el front | Añadidas | Eliminadas |
| --- | ---: | ---: |
| `src/modules/invoices/components/InvoiceCdrModal.tsx` | 5 | 3 |
| `src/modules/invoices/components/InvoiceIssueSummary.tsx` | 2 | 2 |
| `src/modules/invoices/components/InvoiceTableRow.tsx` | 1 | 1 |
| `src/modules/invoices/pages/InvoiceMonitorPage.tsx` | 5 | 3 |
| `test/unit/modules/invoices/invoiceBandejaModal.test.tsx` | 3 | 2 |
| `test/unit/modules/invoices/invoiceMonitorReal.test.tsx` | 23 | 2 |
| `test/unit/modules/invoices/invoiceMonitorRetry.test.tsx` | 2 | 0 |
| **Total** | **41** | **13** |

`FERRY.md` y `SHA256SUMS.txt` son documentos de transporte y no forman parte del cambio a producción. El manifiesto contiene los siete archivos transportados y este documento. Verificar desde la raíz con `sha256sum -c SHA256SUMS.txt`.

## Estado completo del paquete

InvoiceIssueSummary admite un handler opcional: sin él conserva el mensaje de orientación en una sola línea con elipsis y no renderiza Ver detalle. La bandeja y el Monitor omiten ese handler. La bandeja mantiene intactos el clic y el teclado de la fila que abren el mismo visor; aplica a Facturas, Boletas y Notas mediante InvoiceTableRow.

En Comprobantes en vuelo del Monitor, el clic en la fila abre el mismo InvoiceCdrModal usando `setDetalleError(inv)`, `aComprobanteDemo` y la orientación ya existentes. La fila también admite Enter y Espacio. La celda de acciones detiene la propagación del clic: Reintentar, Resolver DLQ y Reprocesar puente ejecutan sus flujos anteriores sin abrir el visor. Se conservan badges, información operativa, filtros y condiciones de habilitación.

La cabecera compartida de InvoiceCdrModal reserva 48 px a la derecha y usa una columna que puede reducir su ancho. Número/cliente y píldora ocupan filas separadas; el texto largo se envuelve dentro de sus límites. Se aplica al modal y su variante lateral. InvoiceStatusBadge no se modifica, ni en la bandeja ni globalmente.

No hay cambios de estados, clasificación, textos de orientación, servicios o llamadas API. Se compararon las declaraciones del Monitor para estados en vuelo, clasificación, DLQ, filtros, carga, reintento, resolución y reproceso: son idénticas a la base. Solo se traslada el punto de entrada al visor y se aísla el clic de las acciones.

## Verificaciones

- Suite dirigida final: **3 archivos / 52 pruebas en verde**. Verifica apertura desde la fila, ausencia del botón y permanencia del resumen en rechazo, incertidumbre y aceptado en DLQ; un solo visor y una sola orientación completa; acciones Reintentar, Resolver DLQ y Reprocesar puente sin abrir el visor y con sus llamadas anteriores. Incluye las pruebas de bandeja sin botón y apertura por fila.
- `npm test`: 227 archivos / 1700 pruebas en verde (268,82 s).
- `npm run build`: correcto (`tsc -b` y Vite).
- Lint: base y estado final presentan 216 errores y 27 advertencias; sin hallazgos nuevos al comparar archivo, regla, gravedad y mensaje, excluyendo extractos con rutas y números de línea.
- `git diff --check`: correcto.
- Chromium, Monitor real a **1440 px**, con respuestas locales simuladas: **cero botones Ver detalle**; resumen «El comprobante requiere revisión.»; clic en la fila abre un solo InvoiceCdrModal con una sola orientación y motivo completo. Los clics en Reintentar, Resolver DLQ y Reprocesar puente dejan **cero visores abiertos** y registran únicamente las llamadas locales esperadas (`retry-cdr`, `resolver-dlq`, `reprocesar-puente`). Captura del visor generada durante esta comprobación. Todas las respuestas y escrituras de esta prueba son dobles locales, sin red de producción.
- Las verificaciones de bandeja y cabecera del paquete anterior siguen aplicando a los mismos archivos, que esta corrección no modifica:
  - Chromium a **1440 px**, con InvoiceList, AppLayout y visor reales: **F001-00000079 mide 64,5 px**, igual que la fila aceptada de referencia. Cero botones en la fila; celda Estado CDR con píldora y resumen. El clic en la fila abre una sola orientación con el motivo 3105 íntegro y ticket 1794529417139.
  - **F001-00000084**: píldora completa en su propia línea. Borde derecho de la píldora: **789,75 px**; borde izquierdo de la X: **1068 px**; separación horizontal: **278,25 px**. La píldora también queda debajo de la franja vertical de la X. Ancho visible/desplazable: **436/436 px**; alto visible/desplazable: **22/22 px**, sin recorte.
  - Variante lateral: texto completo sin desbordamiento, con **261,25 px** hasta el borde derecho del panel. Capturas de bandeja, detalle 79, cabecera 84 y lateral 84; inspección visual de la cabecera 84.

Sin cambios de back, emisiones reales, despliegue, PR ni push al repositorio front.
