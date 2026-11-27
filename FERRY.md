# M1 · Bandeja sin botón redundante y cabecera del detalle

## Base y destino

- Front: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base exacta: `main`, `3b9b13aa403afefa2214919f5cc6cee5a9673b42` (merge del PR #383).
- Rama front sugerida: `fix/m1-bandeja-sin-boton`.
- Commit local del cambio: `a4ce5c4fa1967a55b1c6225bf771ac70a3abd531`.
- Transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`, rama `ferry/m1-bandeja-sin-boton`.
- Base del transporte: `334a9bf17cac90a22922bf60c0cad4a5409980ff`.

## Archivos y diff

Copiar los cuatro archivos bajo `frontend/` a sus rutas relativas a la raíz del front:

| Ruta en el front | Añadidas | Eliminadas |
| --- | ---: | ---: |
| `src/modules/invoices/components/InvoiceCdrModal.tsx` | 5 | 3 |
| `src/modules/invoices/components/InvoiceIssueSummary.tsx` | 2 | 2 |
| `src/modules/invoices/components/InvoiceTableRow.tsx` | 1 | 1 |
| `test/unit/modules/invoices/invoiceBandejaModal.test.tsx` | 3 | 2 |
| **Total** | **11** | **8** |

`FERRY.md` y `SHA256SUMS.txt` son documentos de transporte y no forman parte del cambio a producción. El manifiesto contiene los cuatro archivos transportados y este documento. Verificar desde la raíz con `sha256sum -c SHA256SUMS.txt`.

## Presentación

InvoiceIssueSummary admite un handler opcional: sin él conserva el mensaje de orientación en una sola línea con elipsis y no renderiza Ver detalle. InvoiceTableRow omite ese handler; mantiene intactos el clic y el teclado de la fila que abren el mismo visor. Aplica a Facturas, Boletas y Notas mediante la fila compartida.

El Monitor y sus pruebas permanecen idénticos a la base. Su handler sigue presente, por lo que conserva Ver detalle y su única entrada al visor.

La cabecera compartida de InvoiceCdrModal reserva 48 px a la derecha y usa una columna que puede reducir su ancho. Número/cliente y píldora ocupan filas separadas; el texto largo se envuelve dentro de sus límites. Se aplica tanto al modal como a su variante lateral. InvoiceStatusBadge no se modifica, ni en la bandeja ni globalmente. No hay cambios de estados, clasificación, orientación, servicios o llamadas API.

## Verificaciones

- Suite dirigida: 3 archivos / 54 pruebas en verde. La bandeja verifica 01/03/07/08 sin botón, con resumen y apertura mediante clic en la fila; el mismo modal contiene la orientación completa una sola vez. Las pruebas existentes del Monitor se ejecutaron sin modificarlas.
- `npm test`: 227 archivos / 1699 pruebas en verde (275,60 s).
- `npm run build`: correcto (`tsc -b` y Vite).
- Lint: base y cambio presentan 216 errores y 27 advertencias; sin hallazgos nuevos al comparar archivo, regla, gravedad y mensaje, excluyendo extractos con rutas y números de línea.
- `git diff --check`: correcto.
- Chromium a **1440 px**, con InvoiceList, AppLayout y visor reales, respuestas locales simuladas y escrituras deshabilitadas:
  - **F001-00000079: 64,5 px**, igual que la fila aceptada de referencia. Cero botones en la fila; celda Estado CDR con píldora y resumen «El comprobante requiere revisión.».
  - Clic en esa fila: un solo modal y una sola orientación, con acción completa y motivo 3105 íntegro, incluido el ticket 1794529417139. El flujo de apertura y el contenido existente se conservan.
  - **F001-00000084**: píldora completa «Bloqueada en preparación local · M1_PREPARATION_DATOS_INVALIDOS» en su propia línea. Borde derecho de la píldora: **789,75 px**; borde izquierdo de la X: **1068 px**; separación horizontal: **278,25 px**. La píldora también queda debajo de la franja vertical de la X. Ancho visible/desplazable de la píldora: **436/436 px**; alto visible/desplazable: **22/22 px**, sin recorte.
  - Variante lateral de F001-00000084: misma cabecera y texto completo; sin desbordamiento y con **261,25 px** hasta el borde derecho del panel.
  - Monitor: conserva **un botón Ver detalle** en la fila de prueba y abre el mismo visor con el motivo completo.
  - Capturas generadas de bandeja, detalle 79, cabecera 84, lateral 84 y visor del Monitor; inspección visual de la cabecera 84.

Sin cambios de back, emisiones reales, despliegue, PR ni push al repositorio front.
