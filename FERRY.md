# Ferry — formulario de emisión y grilla

Rama `fix/m1-emitir-grilla`, base back `9f61bc553955d6e2c332bc35780c5865aeb62e6d`.
Base front explícita `8393ea1c72b865d2c4442147e2453f479e11c84b` del repo `CarlosSoles/Fronted-sistema-mype-sunat`.

En fase 0, los 55 archivos heredados coincidían con esa base. El ferry conserva todas sus rutas y superpone los cambios del formulario de emisión. Los veredictos, conteos y límites están en `docs/m1/emitir-grilla.md`.

## Aplicación

1. Verificar `sha256sum -c SHA256SUMS` en la raíz del back.
2. Preparar el checkout del front sobre la base indicada y copiar `frontend/.` sobre su raíz, sin crear otra carpeta frontend.
3. Conservar las demás rutas del destino y revisar intersecciones si este avanzó. El main observado `0993a9ac6cbb868d3eda0e88d179271385ef1ec7` no intersecta las rutas de emisión modificadas por este encargo.
4. Ejecutar suite y build del front antes de integrar.

`SHA256SUMS` inventaría todos los archivos de `frontend/` y este documento; excluye su propio hash. El manifiesto es compuesto, no solo el delta de este encargo. No hay PR ni despliegue asociado.

## Cierre y manifiesto

- 92 archivos bajo `frontend/` y este `FERRY.md`: **93 entradas** en `SHA256SUMS`, verificadas.
- Back: 387 suites / 3977 → 3995 pruebas aprobadas; 18 suites / 95 pruebas omitidas en ambas corridas. Front: 182 archivos / 1404 → 186 archivos / 1429 pruebas aprobadas. Builds completos aprobados.
- Veredictos: puntos 1–3 y 5–7/9 construidos; puntos 4 y 8 completan la presentación fija, pues su bloqueo de catálogo ya existía. Cantidades discretas reforzadas también en el back para 01/03; ZZ, medidas, agrupaciones y cantidades históricas de notas conservan sus usos válidos.
- Aplicación: identidad, unidad, valor y afectación fijos; altas solo desde búsqueda; bolsas enteras por línea y selector conservado. Descuentos, Gratuita, totales y detracción mantienen sus mecanismos.
- [Informe de fase 0 y cierre](docs/m1/emitir-grilla.md). El inventario íntegro con hashes y rutas está en [SHA256SUMS](SHA256SUMS).

Los archivos de pruebas del ferry adaptan las preparaciones al catálogo. Los módulos del maestro de terceros y los paneles de detalle no tienen cambios de implementación. La rama contiene un commit de fase 0 y uno por punto en el orden solicitado.
