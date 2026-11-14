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
