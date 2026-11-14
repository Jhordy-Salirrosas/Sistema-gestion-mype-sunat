# Paquete de recorrido M1

Rama `fix/m1-paquete-recorrido`. Base back main `9f61bc553955d6e2c332bc35780c5865aeb62e6d`. Destino frontend main `8393ea1c72b865d2c4442147e2453f479e11c84b`. No incorpora el registro de depósitos de detracción.

Verificar `sha256sum -c SHA256SUMS` en el backend; copiar `frontend/.` sobre la raíz del repo frontend indicado conservando sus demás archivos. No crear otra carpeta frontend en destino. Se sustituye el inventario histórico heredado porque sus cambios ya están en main.

El documento `docs/m1/paquete-recorrido.md` registra los siete veredictos, decisiones y conteos antes/después. Sin PR, despliegues, migraciones nuevas ni emisiones reales.

## Inventario

- `src/modules/invoices/components/InvoiceCdrModal.tsx`
- `src/modules/invoices/components/InvoiceForcedResend.tsx`
- `src/modules/invoices/hooks/useInvoiceDetailRefresh.ts`
- `src/modules/invoices/lib/invoiceCreditAndRules.ts`
- `src/modules/invoices/lib/invoiceMapper.ts`
- `src/modules/invoices/lib/invoiceQueueEvents.ts`
- `src/modules/invoices/services/invoicesApi.ts`
- `src/modules/invoices/types/invoice.types.ts`
- `test/unit/modules/invoices/invoiceCazaQr.test.ts`
- `test/unit/modules/invoices/invoiceDetailRefresh.test.tsx`
- `test/unit/modules/invoices/invoiceNormativeRules.test.ts`
- `test/unit/modules/invoices/invoiceQueueEvents.test.ts`
- `test/unit/modules/invoices/invoiceTramaQrDigest.test.ts`
- `test/unit/modules/invoices/p9-close.test.tsx`

14 archivos frontend y FERRY.md: 15 entradas SHA-256. No se incluye el hash del manifiesto en sí mismo.
