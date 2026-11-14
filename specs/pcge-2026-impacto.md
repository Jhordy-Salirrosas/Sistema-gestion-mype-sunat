# Impacto de migrar al PCGE 2026

**Fecha:** 2026-11-14 · **Fuente:** `8559148-plan-contable-general-empresarial-pcge-2026(2).pdf` (203 páginas) contra `prisma/seeds/pcge2019.ts` (1 704 cuentas).

## Método

1. Extracción del PDF con `pdfjs-dist` respetando coordenadas: cada fragmento de texto se agrupa por línea (Y) y se separan las columnas por huecos horizontales mayores a 30 pt. Sin esto, las dos columnas de la tabla se mezclan y los nombres salen cruzados.
2. Normalización a pares `código → nombre` (2 a 6 dígitos).
3. Comparación contra la semilla del repositorio, normalizando acentos y puntuación para no contar como "renombre" una diferencia de tildes.

Los scripts están en `tools/` (fuera del repo, junto al PDF) y el catálogo extraído en `specs/data/pcge2026-catalogo.json`.

## Números

| Concepto | Cantidad |
| --- | --- |
| Cuentas en el PCGE 2026 | **1 609** |
| Cuentas en la semilla actual (2019) | **1 704** |
| Mismo código en ambos | 1 320 |
| Solo en 2026 (nuevas) | **289** |
| Solo en 2019 (desaparecen) | **384** (22,5 %) |
| Mismo código, nombre distinto | **246** |

Cuentas por longitud en 2026: 77 de 2 dígitos, 311 de 3, 629 de 4, 583 de 5 y 9 de 6.

## El cambio no es de nombres: es de estructura

**Cuentas por cobrar.** En 2019 la jerarquía llega a cinco dígitos; en 2026 se detiene en cuatro:

| 2019 (semilla) | 2026 (PDF) |
| --- | --- |
| 121 Facturas por cobrar | 121 Facturas, boletas y otros comprobantes por cobrar |
| 1212 En cartera | 1211 No emitidas · 1212 En cartera · 1213 En cobranza · 1214 En descuento |
| **12121 Facturas por cobrar emitidas** | **No existe** |
| **12129 Cuentas por cobrar - detracciones** | **No existe** |

Bajo el prefijo `12` el PDF **no tiene ninguna cuenta de cinco dígitos** (verificado: cero coincidencias).

**Ventas.** Ahí sí se mantienen cinco dígitos, pero cambia el criterio de clasificación: 2019 ordena por afectación al IGV ("ventas gravadas", "exoneradas", "inafectas") y 2026 ordena por tipo de bien y por contraparte:

| 2019 | 2026 |
| --- | --- |
| 70121 Ventas de mercaderías gravadas | 7012 Mercaderías - venta local → **70121 Terceros** |
| 70521 Ventas inafectas del IGV | **No existe** |
| 74111 ICBPER por pagar | **No existe** |

## Impacto en SYNC-SUNAT

**Reglas por defecto** (`defaultAccountingRules.ts`): de los 24 códigos que usan las siete reglas, **10 no existen en 2026**:

`12121`, `12129`, `70521`, `74111`, `60111`, `42121`, `28111`, `401119`, `1011`, `74`.

Y otras tres cambian de significado sin cambiar de código: `70121`, `70321` y `69111` pasan a llamarse "Terceros", porque ahora son divisionarias por contraparte y no por afectación tributaria.

**Puente de ventas** (`accountingBridge.ts`, `CUENTAS_VENTA`): de sus 9 cuentas, **5 no existen** en 2026 (`12121`, `12129`, `70521`, `74111`, `74`).

**Consecuencia si solo se reemplaza el catálogo:** la emisión de comprobantes dejaría de generar asiento (la validación rechaza la cuenta inexistente), y el PLE de ventas quedaría sin cuentas válidas. **No es una migración de datos: es una reescritura del mapeo contable.**

**Asientos históricos:** los 1 320 códigos comunes siguen existiendo, pero 246 cambian de nombre. Un asiento de 2025 con `70121` fue "ventas gravadas" y en 2026 significaría "terceros". Si el catálogo se reemplaza en el mismo registro, el mayor histórico cambia de lectura.

## Opciones

**A. Reemplazar el catálogo por el 2026.** Simple de ejecutar, pero rompe reglas, puente, PLE e histórico. Necesita rehacer todo el mapeo y no permite comparar ejercicios. No recomendada.

**B. Versionar el catálogo (recomendada).** Agregar a `accounting_accounts` una marca de versión (`catalog_version` o `valid_from`) y que la empresa elija el plan por ejercicio. Los asientos guardan la versión con la que se contabilizaron; el PLE de un ejercicio anterior se sigue emitiendo con su plan. Requiere: migración de esquema, semilla 2026, selector en la UI y reglas por versión.

**C. Aditivo mínimo.** Insertar las 289 cuentas nuevas sin tocar las existentes ni las reglas. El catálogo queda híbrido (con nombres 2019 en los códigos comunes), pero no se rompe nada y se puede avanzar por partes.

## Recomendación

Empezar por **B**, con **C** como primer paso controlado: cargar el catálogo 2026 como versión y dejar las reglas actuales apuntando a 2019 hasta que el contador reasigne las cuentas. El sistema seguiría contabilizando igual y la migración se haría regla por regla, con la auditoría marcando lo que falte.

## Lo que falta decidir

1. ¿Se adopta el PCGE 2026 desde el ejercicio 2026 (en curso) o desde 2027?
2. ¿Se versiona el catálogo (opción B) o se acepta un catálogo híbrido (opción C)?
3. Las cuentas de ventas por contraparte (`70121 Terceros`, `70122 Relacionadas`) cambian la lógica del PLE de ventas: ¿se mantiene el criterio de afectación tributaria en las reglas aunque el PCGE 2026 clasifique por contraparte?

Sin esas tres respuestas, escribir la migración sería adivinar.
