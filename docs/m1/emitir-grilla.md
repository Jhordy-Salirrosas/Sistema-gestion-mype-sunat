# Formulario de emisión — fase 0 y cierre

## Bases y alcance

- Back: main `9f61bc553955d6e2c332bc35780c5865aeb62e6d` (verificado remoto y checkout limpio).
- Front: base solicitada `8393ea1c72b865d2c4442147e2453f479e11c84b`. Main remoto observado `0993a9ac6cbb868d3eda0e88d179271385ef1ec7`; se conserva la base explícita del encargo. Su avance afecta otros módulos, sin intersección con las rutas de emisión previstas.
- Rama única del back: `fix/m1-emitir-grilla`. Sin PR. Entrega de front mediante ferry; no se publica una rama en el repo front.
- Los 55 archivos frontend heredados coinciden byte por byte con la base front solicitada. Se conservan en el ferry compuesto.
- Solo formulario de emisión, grilla y reglas de cantidad asociadas. Maestro de terceros y paneles del detalle quedan fuera del cambio.

## Conteos de fase 0

Front base: suite completa, **182 archivos / 1404 pruebas aprobadas** (`npm test -- --maxWorkers=2`). Back: 405 archivos de prueba inventariados. La primera corrida completa con `--runInBand` terminó por agotamiento del heap predeterminado de Node (salida 134), sin resumen de resultados; no se atribuyen pruebas aprobadas a esa corrida. Se repite en la misma base con `NODE_OPTIONS=--max-old-space-size=4096`, dos workers y `--workerIdleMemoryLimit=512MB`; la repetición terminó con **387 suites / 3977 pruebas aprobadas; 18 suites / 95 pruebas omitidas**, sin fallos. Se conserva el mismo modo para el cierre. Integraciones opcionales sin servicio externo mantienen su omisión configurada. No se utilizan emisiones reales.

## Veredictos por punto en fase 0

| Punto | Evidencia y decisión |
| --- | --- |
| 1 | Confirmado: `InvoiceItemsGrid` impone 1768 px y `overflow-x-auto`. Distribuir campos etiquetados por línea en bloques adaptables, conservando datos, mensajes y acciones. |
| 2 | Confirmado: cabecera de página y pie de grilla ofrecen alta vacía; Alt+L y los reinicios también crean filas sin producto. Retirar altas libres y comenzar sin líneas. Alt+L conserva el acceso al buscador. Permitir quitar la última línea; emitir sin líneas sigue bloqueado. |
| 3 | Confirmado parcialmente: SKU de catálogo ya es readonly; descripción y SKU de otras filas son editables. Presentar ambos siempre de solo lectura. |
| 4 | El selector existe, pero la unidad del producto elegido ya está bloqueada por `unidadHeredada`. No se sostiene que pueda alterarse esa unidad de catálogo; se detiene esa supuesta corrección de regla y se realiza únicamente la presentación fija solicitada. El back ya compara con el producto. |
| 5 | Confirmado: cantidad positiva de hasta tres decimales, sin criterio por unidad. Enteros para NIU, BG, BX, PK, SET; hasta tres decimales para medidas (KGM, GRM, LTR, GLL, MTR, MTK, MTQ, TNE), agrupaciones DZN/CEN/MIL y servicios ZZ. No se presume que media docena o una fracción de servicio sean inválidas. Normalización de ceros en la entrada. La validación del back no distingue unidades: reforzar únicamente creación 01/03. Notas conservan cantidades históricas y reglas previas. Añadir al front unidades vigentes del inventario que su lista restringida no representa, incluido ZZ. |
| 6 | Confirmado: valor unitario editable; el back compara el precio oneroso 01/03 con `sale_price`. Mostrar el valor del producto elegido sin edición, conservar precisión interna y descuentos vigentes. En notas conservar datos precargados del origen, sin sustituirlos por precios actuales. |
| 7 | Confirmado: number/step=1 admite decimal y valida después. Entrada de dígitos, sin redondear ni truncar decimales pegados; mantener validación entera no negativa. |
| 8 | Selector visible; afectación de catálogo ya bloqueada por `afectacionHeredada`. No se sostiene el cambio de afectación del producto elegido: detener esa supuesta corrección de regla, realizar presentación fija y conservar Gratuita y su motivo fiscal obligatorio. El back ya valida catálogo y admite gratuidad explícita. |
| 9 | Confirmado: botón inferior incrementa bolsas de la línea seleccionada. Retirar botón duplicado y conservar selector de producto y cantidad por línea. |

Los puntos 4 y 8 continúan por su cambio visual explícito; no se introduce una regla que ya existe. No cambian Liquidación, cálculo del total de línea, comportamiento de Gratuita ni selector de detracción.

## Ejecución por punto

1. Construido: bloques adaptables con las once celdas y sus etiquetas. Prueba dirigida: 1 archivo / 5 pruebas aprobadas. Verificación geométrica conjunta al cierre.

2. Construido: sin botones de alta libre ni filas vacías iniciales/reiniciadas; Alt+L solo enfoca búsqueda. Se puede retirar la última línea. Pruebas dirigidas de página, modal, teclado, búsqueda y presentación: 6 archivos / 30 pruebas aprobadas.

3. Construido: código y descripción siempre de solo lectura, sin callbacks de edición; campos multilínea ajustables al contenido para conservar textos largos visibles. Pruebas dirigidas: 3 archivos / 16 pruebas aprobadas.

4. Construido el cambio de presentación: unidad registrada como dato fijo, sin desplegable. Sin cambio de regla del back, ya existente. Prueba dirigida: 1 archivo / 1 prueba aprobada.

5. Construido: entrada entera para NIU/BG/BX/PK/SET, normalización de ceros y rechazo de decimal completo sin truncamiento. Validación previa al POST y guarda transaccional para 01/03. ZZ, medidas y agrupaciones conservan tres decimales; notas conservan reglas históricas. Pruebas dirigidas: front 1 archivo / 19 pruebas; back 2 suites / 115 pruebas aprobadas (incluidas las regresiones de servicios).

6. Construido: valor unitario fijo sin callback de modificación; precisión del valor/precio y payload conservada. Descuentos por línea y global siguen siendo los controles comerciales. Pruebas dirigidas: 3 archivos / 15 pruebas aprobadas, incluida preservación del valor precargado del origen en notas.

7. Construido: ICBPER usa entrada entera no negativa; rechaza decimales, signos y exponentes al ingresar y no los redondea. Cero es válido; una entrada vacía conserva la validación de obligatoriedad. Pruebas dirigidas compartidas de entrada: 2 archivos / 20 pruebas aprobadas.

8. Construido el cambio de presentación: afectación/tributo como dato fijo, incluidos los códigos 10/20/30/40; Gratuita conserva activación, motivo fiscal y restauración del precio original. Sin cambio de regla del back, ya existente. Pruebas dirigidas: 1 archivo / 8 pruebas aprobadas.

9. Construido: retirado el botón duplicado de bolsas. El selector conservado lleva al campo ICBPER de la línea elegida, sin incrementar bolsas ni crear líneas. Se mantiene la cantidad por línea y la guarda de boletas gratuitas. Verificación dirigida final de grilla/selector: 2 archivos / 6 pruebas aprobadas. Las preparaciones de regresiones ahora seleccionan productos o construyen explícitamente sus fixtures tributarios; no modifican lógica del maestro ni paneles de detalle.

## Cierre y validación

| Capa | Base | Cierre |
| --- | --- | --- |
| Back | 387 suites / 3977 pruebas aprobadas | 387 suites / 3995 pruebas aprobadas |
| Front | 182 archivos / 1404 pruebas aprobadas | 186 archivos / 1429 pruebas aprobadas |

Incremento neto: 18 pruebas back y 25 front. Back mantiene 18 suites / 95 pruebas omitidas por configuración y 12 snapshots aprobados en ambas corridas. No se habilitaron las integraciones opcionales con base externa ni conexiones SUNAT reales. Back: `NODE_OPTIONS=--max-old-space-size=4096 npm test -- --maxWorkers=2 --workerIdleMemoryLimit=512MB`; front: `npm test -- --maxWorkers=2`. Suite completa final sin fallos. Build back (`prisma generate` + `nest build`) y front (`tsc -b` + `vite build`) aprobados, después de terminar la suite correspondiente. Lint back aprobado, con tres advertencias preexistentes fuera del cambio. `git diff --check` aprobado en ambas capas.

Chromium comprobó dos líneas con descripción extensa, once celdas por línea y todos sus campos/acciones dentro del contenedor. No hubo errores JavaScript ni desbordamiento horizontal: viewport 1440/1280 → grilla 880 px; 1024/768 → 720 px; 480 → 432 px. Con 256 px reservados lateralmente en escritorio, y además contenedores estrechos de 480, 420 y 360 px, `scrollWidth == clientWidth`. La cantidad de columnas se adapta al ancho real del contenedor mediante `auto-fit`. Tras ese ajuste final se repitieron las seis pruebas dirigidas de presentación/selector, el barrido de Chromium y el build. Se comprobaron normalización 03→3, rechazo de 3.002 en NIU y 2.333 en bolsas, fracciones ZZ, campos fijos y foco del selector de bolsas. Montaje visual temporal excluido del ferry.

Ferry compuesto: **92 archivos frontend + FERRY.md, 93 entradas SHA-256**. Conserva todas las rutas heredadas y añade código/pruebas de emisión. El manifiesto íntegro es `SHA256SUMS`; no se incluye a sí mismo. Los 92 archivos coinciden byte por byte con el checkout frontend validado sobre `8393ea1c72`. Ninguna ruta transportada intersecta el avance remoto observado hasta `0993a9ac6c`. Verificar con `sha256sum -c SHA256SUMS` y aplicar `frontend/.` sobre la raíz del repo front. Una rama del back, diez commits (fase 0 y puntos 1–9), sin PR, despliegue, migraciones ni emisiones reales.
