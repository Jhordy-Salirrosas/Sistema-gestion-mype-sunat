# Ferry — grilla híbrida del detalle de líneas de emisión

Rama `fix/m1-emitir-grilla-hibrida-ag`, base back `03890af881fea82e45801870a16a6e97ca229391`.
Cadena front en `CarlosSoles/Fronted-sistema-mype-sunat`: base `d649d6520a1670029984c4cf2d0ca06b64091095` → PR #306 (grilla híbrida) → main `ec515ebc4404d090cbb80fe02bbd0a95af5d8161` → PR #307 (ajuste de columnas) → main `44cad5fad75902b906dc91819ea0ee6fc668fc3d`.

Cambio SOLO de presentación del componente `InvoiceItemsGrid`: desde 1024px, tabla compacta de una fila por línea; por debajo, tarjeta densa por línea. Los campos de solo lectura se renderizan como texto; sin textos de ayuda duplicados ni scroll horizontal. El ajuste posterior pasa la tabla a `table-auto` con `min-w-[110px]` en Descripción para que ninguna columna quede recortada entre 1024 y 1280 px. Sin cambios de campos, validaciones, payload ni atajos.

## Aplicación

1. Verificar `sha256sum -c SHA256SUMS` (inventaría los 12 archivos entregados en su estado final y este documento).
2. Los archivos ya están integrados en el front (PR #306 y #307); este ferry es el registro en el back y actualiza en el espejo `frontend/` solo esos 12 archivos.

## Cierre y manifiesto

- Delta final: 12 archivos (1 componente + 11 pruebas adaptadas a leer los campos de solo lectura como texto).
- Front: 194 archivos / 1462 pruebas aprobadas antes y después de cada PR; builds correctos; CI verde en ambos PR.
- Certificación en la app servida: descripción y unidad visibles, botón de eliminar visible y funcional, totales correctos, sin scroll horizontal.
