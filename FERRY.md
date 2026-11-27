# M1 · Orden visual del control de depósitos de detracción

## Base y destino

- Repositorio front: `CarlosSoles/Fronted-sistema-mype-sunat`.
- Base exacta: `main`, `1b5b05a23d00ff97ff04bbf62c28045f64a31790` (merge del PR #378).
- Rama front sugerida: `fix/m1-detracciones-orden-visual`.
- Commit local del cambio: `2eac31a1a7a49e8fa28e83f7ade82813b89d7296`.
- Repositorio de transporte: `Jhordy-Salirrosas/Sistema-gestion-mype-sunat`.
- Rama ferry: `ferry/m1-detracciones-orden-visual`.
- Base del transporte: `334a9bf17cac90a22922bf60c0cad4a5409980ff`.

## Archivos y aplicación

Copiar los tres archivos de `frontend/` a sus rutas relativas a la raíz del front:

| Ruta en el front | Añadidas | Eliminadas |
| --- | ---: | ---: |
| `src/modules/invoices/pages/InvoiceDetractionsPage.tsx` | 41 | 16 |
| `src/modules/invoices/pages/invoiceDetractionsPage.css` | 117 | 0 |
| `test/unit/modules/invoices/invoiceDepositMovements.test.tsx` | 54 | 4 |
| **Total** | **212** | **20** |

`FERRY.md` y `SHA256SUMS.txt` son documentos del transporte; no forman parte del cambio a producción. El manifiesto contiene los tres archivos transportados y este documento. Verificar desde la raíz con `sha256sum -c SHA256SUMS.txt`.

## Presentación

La barra de período queda compacta, con los mismos controles Año/Mes y pastillas neutras de resumen. El enlace Ver comprobantes se sustituye por el título Comprobantes y el mes/año como texto secundario. La tabla define diez columnas, incluida Editar entre Depósitos y Total depositado. Los importes permanecen alineados a la derecha y sin cortes; los clientes y las constancias pueden envolver su texto dentro de su columna.

El número del comprobante aparece en negrita, con una etiqueta gris de estado y el mismo ícono. Los depósitos ocupan subfilas separadas por una línea punteada, con monto en negrita y constancia gris. El saldo pendiente se muestra en negrita y el saldo cero en texto normal. Registrar tiene presentación negra; Agregar depósito conserva sus condiciones de habilitación. La página y sus diálogos usan una escala neutra. Los estilos se limitan a esta página y sus diálogos; no cambian componentes compartidos ni otras pantallas.

En anchos angostos se conserva el desplazamiento horizontal dentro del contenedor de la tabla, sin desbordar la página. La barra y sus resúmenes se distribuyen en varias filas cuando es necesario.

## Punto de entrada Editar

Cada comprobante con movimientos tiene un único botón Editar, en su columna propia y centrado verticalmente. Si existe un solo depósito, el botón llama directamente al `open(d, deposit)` existente. Si existen varios, abre un selector con fecha, monto y constancia de cada movimiento; elegir uno llama al mismo `open(d, deposit)` y abre el editor existente. Se eligió este mecanismo para conservar el editor, sus valores iniciales y todas sus validaciones y llamadas de guardado.

No se añadió edición para registros sin movimientos, que tampoco la ofrecían antes. Agregar depósito y Registrar conservan sus manejadores, etiquetas y condiciones de habilitación. La lectura de constancias antiguas, incluida la muestra XDDD, permanece disponible.

## Resúmenes

Se utiliza exclusivamente el arreglo `data` ya cargado por la consulta del período:

- Comprobantes: `data.length`.
- Detracción total: suma de `d.detraction`.
- Depositado: suma de `d.depositedTotal ?? d.depositedAmount ?? 0`, igual que la columna existente.
- Saldo pendiente: suma de `balance(d)`, la función existente sin cambios.

Solo se agregan sumas de presentación y se aplica el formateador monetario existente. No hay llamadas nuevas ni cambios en el filtrado por período, cálculo de detracción, saldo, validaciones o lógica de negocio. Se compararon contra la base las declaraciones de consulta, saldo, validaciones, mutación y apertura del editor: son idénticas. El editor existente también es idéntico salvo la clase visual del diálogo.

## Verificaciones

- Pruebas dirigidas: 2 archivos / 27 pruebas en verde. Cubren columnas y montos, totales del resumen, cambio de período, un solo Editar por fila, selección y guardado de cualquiera de dos movimientos, complemento, validaciones y error del servidor.
- `npm test`: 227 archivos / 1689 pruebas en verde (274,04 s).
- `npm run build`: correcto (`tsc -b` y Vite).
- Lint: base y cambio presentan 216 errores y 27 advertencias. Sin hallazgos nuevos al comparar archivo, regla, gravedad y mensaje, excluyendo extractos con rutas y números de línea.
- `git diff --check`: correcto.
- Chromium con la página y AppLayout reales, respuestas locales simuladas y escrituras deshabilitadas: menú lateral abierto de 256 px; pantalla de 1440 px con 1120 px útiles y pantalla de 1420 px con 1100 px útiles. En ambos casos, el ancho desplazable de la tabla coincide con su contenedor; todas las celdas caben, los botones Editar tienen espacio a ambos lados y no existe scroll horizontal.
- Muestra de noviembre de 2026: cuatro comprobantes F001-00000066, F001-00000070, F001-00000092 y F001-00000101; dos movimientos de S/ 33.02 y S/ 40.00 en el tercero. Resumen comprobado: **4 comprobantes · Detracción total S/ 292.08 · Depositado S/ 219.06 · Saldo pendiente S/ 73.02**.
- Inspección visual de la captura con 1100 px útiles y de la vista a 390 px. También se comprobó el ancho de pantalla de 1100 px; en los tamaños angostos el desplazamiento queda dentro de la tabla y la página no desborda.

Sin cambios de back, emisiones reales, despliegue, PR ni push al repositorio front.
