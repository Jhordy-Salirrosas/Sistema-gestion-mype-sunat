# M1 · Etiquetas integradas en Emisión

## Base y destino

- Repositorio front: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base exacta: `main`, `b6ed62622adee36e525aafc7ed76ec2640c63995` (merge del PR #376).
- Rama front sugerida: `fix/m1-emision-etiquetas-integradas`.
- Commit local del cambio: `a21a4f6c81d7c5159c8b034fa7de51a904d96761`.
- Repositorio de transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
- Rama ferry: `ferry/m1-emision-etiquetas-integradas`.
- Base del transporte: `334a9bf17cac90a22922bf60c0cad4a5409980ff`.

## Archivos transportados

Copiar los tres archivos bajo `frontend/` a sus rutas relativas a la raíz del front:

| Ruta en el front | Añadidas | Eliminadas |
| --- | ---: | ---: |
| `src/modules/invoices/components/InvoiceItemsGrid.tsx` | 8 | 7 |
| `src/modules/invoices/components/invoiceIntegratedFields.css` | 138 | 0 |
| `src/modules/invoices/pages/InvoiceEmissionPage.tsx` | 2 | 1 |
| **Total** | **148** | **8** |

`FERRY.md` y `SHA256SUMS` son documentos del transporte y no forman parte del cambio a producción. El manifiesto contiene los tres archivos del front y este documento; verificar con `sha256sum -c SHA256SUMS` desde la raíz del ferry.

## Presentación

Las líneas en modo tarjeta incorporan la etiqueta dentro de una única caja con borde para Cant., V.U., Desc. Cat. 53, Bolsas, Afectación y Detracción. Afectación conserva su texto completo y la casilla Gratuita pequeña. Las celdas de cada fila se estiran a la misma altura. La cabecera y las celdas del modo tabla desde 1000 px conservan su presentación.

En Emisión se integran las etiquetas de documento del cliente, razón social, dirección, almacén, serie, tipo de comprobante, fecha y monto entregado. El grupo de botones de pago queda contenido bajo su leyenda, dentro de un borde; el selector de medio de pago también incorpora su etiqueta. Vuelto permanece a la derecha. Se integran asimismo Producto para bolsas y Descuento global. Las casillas Gratuita y Agente de Retención miden 14 × 14 px en la pantalla.

No se tocó ningún handler ni lógica, validación, texto de datos o condición. La comparación del árbol sintáctico de ambos componentes contra la base resulta idéntica al excluir únicamente las clases y las importaciones de CSS. Se mantienen identificadores, etiquetas y nombres accesibles, obligatoriedad del RUC, buscadores, selector nativo de fecha y condiciones de Bolsas. Liquidación y la barra móvil Resumen de pago no se modificaron. Los estilos de campos compartidos quedan acotados al formulario de Emisión; los estilos de celdas del detalle se limitan a contenedores inferiores a 1000 px.

## Verificaciones

- Prueba existente de estructura del detalle: 1 archivo / 8 pruebas en verde.
- `npm test`: 227 archivos / 1685 pruebas en verde (261,26 s).
- `npm run build`: correcto (`tsc -b` y Vite).
- `npm run lint -- --format json`: base y cambio presentan 216 errores y 27 advertencias. Sin hallazgos nuevos al comparar archivo, regla, gravedad y mensaje, excluyendo extractos con rutas y números de línea.
- `git diff --check`: correcto.
- Chromium, componente real: contenedores exactos de 600, 650 y 700 px, etiquetas visibles dentro del borde y sin desbordamiento horizontal. Se verificó además el modo tabla a 1100 px, con cabecera visible y sin bordes de campo añadidos en sus celdas.
- Chromium, pantalla completa real con AppLayout a 1440 px: etiquetas integradas visibles, botones de pago dentro de su contenedor, Vuelto a la derecha, casillas de 14 px y ausencia de desbordamiento horizontal. Captura completa e inspección visual del detalle y la pantalla. La revisión usa respuestas locales simuladas; las escrituras se rechazan en el adaptador de prueba.

Sin cambios de back, emisiones reales, despliegue, PR ni push al repositorio front.
