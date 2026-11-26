# M1 · Detalle de emisión en tarjetas para contenedores angostos

## Base y destino

- Repositorio destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base exacta del front: `main`, `88044732934bfea8d96ad3832a17a1514c774c59`.
- Rama sugerida del front: `fix/m1-emision-detalle-tarjeta`.
- Commit local del cambio: `13f6f44554c23aca2eed4e682995d2a006cf6e67`.
- Repositorio de transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
- Rama de transporte: `ferry/m1-emision-detalle-tarjeta`.
- Base del transporte: `334a9bf17cac90a22922bf60c0cad4a5409980ff`.

## Archivos y diff

Copiar únicamente estos archivos desde `frontend/`, conservando sus rutas relativas a la raíz del front:

| Ruta en el front | Añadidas | Eliminadas |
| --- | ---: | ---: |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | 30 | 30 |
| `test/unit/modules/invoices/invoiceItemsLayout.test.tsx` | 36 | 5 |
| **Total** | **66** | **35** |

`FERRY.md` y `SHA256SUMS` son documentos del transporte; no forman parte del cambio a producción. El manifiesto incluye los dos archivos transportados y este documento. Verificar desde la raíz del ferry con `sha256sum -c SHA256SUMS`.

## Cambio

Bajo 1000 px de contenedor, cada línea tiene tres filas fijas: identidad con total y eliminación; cuatro columnas iguales de cantidad, valor unitario, descuento y bolsas; afectación con marca Gratuita y detracción. La identidad se mantiene en una línea con elipsis, texto completo en el DOM y título accesible. Las etiquetas pequeñas se muestran dentro de cada tarjeta y la cabecera común se oculta.

Desde 1000 px se conserva la tabla de una fila y su plantilla de columnas. Se elimina el modo intermedio en dos bandas. Se mantienen los nombres accesibles, identificadores, mensajes, condiciones, cálculos y controles existentes. Los 14 manejadores son idénticos a la base; el buscador y los bloques inferiores se conservan sin cambios. Bolsas conserva el input en la línea seleccionada o con bolsas existentes, y «—» en las demás.

## Verificación

- Suite dirigida de estructura, bolsas, campos y gratuidad: 6 archivos y 27 pruebas en verde.
- `npm test`: 227 archivos y 1685 pruebas en verde (270,83 s).
- `npm run build`: correcto (`tsc -b` y Vite).
- `npm run lint -- --format json`: base y cambio presentan 216 errores y 27 advertencias. Sin hallazgos nuevos al comparar archivo, regla, gravedad y mensaje, excluyendo los extractos que contienen rutas y números de línea.
- `git diff --check`: correcto.
- Chromium local con el componente real y datos de prueba: pantallas de 1280, 800 y 390 px; contenedores exactos de 600, 650 y 700 px. Se verificaron ausencia de desbordamiento horizontal, tres filas alineadas y cuatro columnas iguales en cantidades para el modo tarjeta, cabecera oculta en angosto, una fila y cabecera visible en ancho, y afectación completa sin recorte. Inspección visual de las capturas de 390 y 650 px.

No se modificó el back ni se realizaron emisiones, despliegues, PR o push al repositorio front.
