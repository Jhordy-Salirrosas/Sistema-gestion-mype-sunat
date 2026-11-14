# Registro de depósitos de detracción

Rama `fix/m1-detracciones-registro`. Base back `9f61bc553955d6e2c332bc35780c5865aeb62e6d`; destino frontend main `8393ea1c72b865d2c4442147e2453f479e11c84b`.

Verificar `sha256sum -c SHA256SUMS` en el back. Copiar `frontend/.` sobre la raíz del checkout frontend indicado, conservando los demás archivos del destino. Este ferry reemplaza el inventario heredado: los cambios anteriores ya están en ambos main. No crear una carpeta frontend adicional en el destino.

Archivos transportados:

- `src/modules/invoices/lib/invoiceDepositValidation.ts`
- `src/modules/invoices/pages/InvoiceDetractionsPage.tsx`
- `test/unit/modules/invoices/invoiceDepositValidation.test.tsx`
- `test/unit/modules/invoices/invoiceDepositMovements.test.tsx`

El cierre y los conteos están en `docs/m1/detracciones-registro.md`. El backend de movimientos requiere aplicar previamente el SQL mediante el script manual entregado; no se ejecutan migraciones sobre bases compartidas en este encargo. No se crea PR ni se realizan emisiones.

## Validación final

Base → final: back 401 suites / 4034 pruebas → 403 suites / 4049 pruebas; front 182 archivos / 1404 pruebas → 183 archivos / 1417 pruebas. Suites completas verdes; back mantiene 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. Builds back/front y lint backend OK. La repetición completa del back se ejecutó sin front concurrente tras una aserción de tiempo de outbox; no se modificó el umbral.

Son cuatro archivos frontend más FERRY.md (cinco entradas SHA-256). El esquema no se aplicó a bases compartidas. Aplicación manual previa mediante `scripts/manual/apply-detraction-deposits.cjs`; instrucciones y checksum SQL en `scripts/manual/README-detraction-deposits.md` y `scripts/manual/detraction-deposits.sha256`.
