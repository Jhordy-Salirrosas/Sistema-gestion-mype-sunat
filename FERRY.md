# Ferry M1 — Detalle de emisión en filas tipo tabla

## Bases y destino

- Repositorio de transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
- Base back main: `334a9bf17cac90a22922bf60c0cad4a5409980ff`.
- Rama de transporte: `ferry/m1-emision-detalle-fila-tabla`.
- Repositorio destino: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base front main: `2f8f93bf9b069cfd4fd34d2ba0875654a370da9e`.
- Rama front sugerida: `fix/m1-emision-detalle-fila-tabla`.
- Commit fuente local: `c154492b61cc4f95d24fe01a3c23c681977cd20d`.

## Archivos y diff

Las rutas siguientes son relativas a la raíz del front; se transportan bajo frontend/:

- `src/modules/invoices/components/InvoiceItemsGrid.tsx`: **+56 −62**.
- `test/unit/modules/invoices/invoiceItemsLayout.test.tsx`: **+56 −5**.

Total: **+112 −67**, en dos archivos. Las copias coinciden byte a byte con el commit fuente.

## Presentación

Una cabecera común contiene Producto, Cant., V.U., Desc. Cat. 53, Bolsas, Afectación, Detracción y Total, más la columna de acciones con nombre accesible. Cada línea usa las mismas columnas: SKU en negrita, descripción/unidad/V.U. reunidos en la celda de producto, controles sin etiquetas visuales repetidas, detracción independiente y total en negrita alineado a la derecha. Las cantidades, descuentos, motivos y mensajes existentes se conservan.

A partir de 1000 px disponibles en el contenedor, las celdas comparten una fila. En contenedores angostos, cabecera y líneas se distribuyen en dos bandas alineadas. La afectación no se trunca: el dato oneroso sigue siendo de solo lectura según catálogo, y el motivo de gratuidad conserva su selector nativo con el valor completo visible y adaptable a varias líneas. La marca Gratuita queda junto a la afectación.

Bolsas sigue el criterio confirmado: input visible en la línea seleccionada por Producto para bolsas, incluso en cero, y en líneas con bolsas cargadas; las demás muestran «—». Los inputs se conservan montados y se revelan al enfocar para mantener las asociaciones, el foco imperativo y la navegación por teclado existentes. Los valores inválidos conservan la posibilidad de corrección y sus mensajes. No se modifica el handler del selector.

## Alcance conservado

Los 14 handlers JSX del componente se compararon con la base y son idénticos. El buscador, Producto para bolsas y el resumen/errores de stock conservan sus handlers, valores y textos; el bloque inferior completo se verificó idéntico a la base. InvoiceDescuentoGlobal y InvoiceEmissionPage no se modifican. Permanecen los ids, nombres accesibles, condiciones de habilitación, validaciones y cálculos. No se cambian servicios, tipos, payloads ni código backend.

## Verificación

- Pruebas dirigidas: **6 archivos / 26 pruebas verdes**.
- Suite completa del front: **227 archivos / 1684 pruebas verdes**.
- Build completo: **OK**.
- Lint: **sin hallazgos nuevos respecto de la base**. Base y cambio tienen **216 errores y 27 advertencias previos**. La comparación de diagnósticos por archivo, regla, severidad y mensaje, sin considerar desplazamientos de líneas, no registra altas ni bajas. No se declara el lint global verde.
- Revisión del componente en Chromium local con tres productos: **1280, 800 y 390 px**. En 1280 las nueve celdas de cada fila comparten altura inicial; en 800 y 390 se distribuyen en dos bandas. Ancho de página igual al viewport, ancho desplazable de cada fila igual a su ancho visible y afectaciones completas. Se comprobaron los estados de bolsas en cero, línea sin bolsas y línea con bolsas, y un motivo gratuito largo. No se accedió a producción ni se realizaron emisiones reales.

Las pruebas de estructura fijan la cabecera única, nueve celdas por línea, datos de producto agrupados, detracción separada, aviso de valor cero con colspan 9, legibilidad de afectación y handlers. Las pruebas de bolsas verifican el criterio de visibilidad y el foco del selector sin mutaciones.

## Aplicación

1. En esta rama de transporte, ejecutar `sha256sum -c SHA256SUMS`. Deben verificar las tres entradas: dos archivos frontend y FERRY.md.
2. Preparar la rama destino sobre la base front indicada. Si avanzó, revisar cualquier cambio de estas dos rutas antes de aplicar.
3. Copiar únicamente los dos archivos de frontend/ a sus rutas relativas en la raíz del front. No crear otra carpeta frontend en destino.
4. Revisar el diff y ejecutar las verificaciones del tren de revisión.

**FERRY.md y SHA256SUMS son solo transporte en la rama ferry del back. No son parte del cambio a producción ni se copian al front.** No se intenta push al front, no se crea PR y no se despliega.
