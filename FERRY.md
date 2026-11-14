# Ferry — formulario de emisión y grilla

Rama `fix/m1-emitir-grilla`, base back `9f61bc553955d6e2c332bc35780c5865aeb62e6d`.
Base front explícita `8393ea1c72b865d2c4442147e2453f479e11c84b` del repo `CarlosSoles/Fronted-sistema-mype-sunat`.

El ferry conserva los 55 archivos heredados, idénticos a esa base, y compone los cambios del formulario de emisión. Los veredictos, conteos y límites están en `docs/m1/emitir-grilla.md`.

## Aplicación

1. Verificar `sha256sum -c SHA256SUMS` en la raíz del back.
2. Preparar el checkout del front sobre la base indicada y copiar `frontend/.` sobre su raíz, sin crear otra carpeta frontend.
3. Conservar las demás rutas del destino y revisar intersecciones si este avanzó. El main observado `0993a9ac6cbb868d3eda0e88d179271385ef1ec7` no intersecta las rutas de emisión modificadas por este encargo.
4. Ejecutar suite y build del front antes de integrar.

`SHA256SUMS` inventaría todos los archivos de `frontend/` y este documento; excluye su propio hash. El manifiesto es compuesto, no solo el delta de este encargo. No hay PR ni despliegue asociado.
