# Registro de depósitos de detracción

Rama `fix/m1-detracciones-registro`. Base back `9f61bc553955d6e2c332bc35780c5865aeb62e6d`; destino frontend main `8393ea1c72b865d2c4442147e2453f479e11c84b`.

Verificar `sha256sum -c SHA256SUMS` en el back. Copiar `frontend/.` sobre la raíz del checkout frontend indicado, conservando los demás archivos del destino. Este ferry reemplaza el inventario heredado: los cambios anteriores ya están en ambos main. No crear una carpeta frontend adicional en el destino.

Archivos transportados:

- `src/modules/invoices/lib/invoiceDepositValidation.ts`
- `src/modules/invoices/pages/InvoiceDetractionsPage.tsx`
- `test/unit/modules/invoices/invoiceDepositValidation.test.tsx`

El cierre y los conteos están en `docs/m1/detracciones-registro.md`. El backend de movimientos requiere aplicar previamente el SQL mediante el script manual entregado; no se ejecutan migraciones sobre bases compartidas en este encargo. No se crea PR ni se realizan emisiones.
