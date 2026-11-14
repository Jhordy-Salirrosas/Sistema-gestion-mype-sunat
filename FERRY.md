# Paquete de recorrido M1

Rama `fix/m1-paquete-recorrido`. Base back main `9f61bc553955d6e2c332bc35780c5865aeb62e6d`. Destino frontend main `8393ea1c72b865d2c4442147e2453f479e11c84b`. No incorpora el registro de depósitos de detracción.

Verificar `sha256sum -c SHA256SUMS` en el backend; copiar `frontend/.` sobre la raíz del repo frontend indicado conservando sus demás archivos. No crear otra carpeta frontend en destino. Se sustituye el inventario histórico heredado porque sus cambios ya están en main.

El documento `docs/m1/paquete-recorrido.md` registra los siete veredictos, decisiones y conteos antes/después. Sin PR, despliegues, migraciones nuevas ni emisiones reales.

## Inventario

- `src/modules/customs/components/PartnerDetailDrawer.tsx`
- `src/modules/customs/components/PartnerFormDialog.tsx`
- `src/modules/customs/lib/partnerRecordValidation.ts`
- `src/modules/customs/lib/partnerSummary.ts`
- `src/modules/customs/libPartnerValidation.ts`
- `src/modules/customs/pages/PartnersPage.tsx`
- `src/modules/customs/services/masterDataApi.ts`
- `src/modules/invoices/components/InvoiceCdrModal.tsx`
- `src/modules/invoices/components/InvoiceForcedResend.tsx`
- `src/modules/invoices/hooks/useInvoiceDetailRefresh.ts`
- `src/modules/invoices/lib/invoiceCreditAndRules.ts`
- `src/modules/invoices/lib/invoiceMapper.ts`
- `src/modules/invoices/lib/invoiceQueueEvents.ts`
- `src/modules/invoices/services/invoicesApi.ts`
- `src/modules/invoices/types/invoice.types.ts`
- `test/fixtures/invoiceDetailFromDemo.ts`
- `test/unit/modules/invoices/bandeja-ui.test.tsx`
- `test/unit/modules/invoices/invoiceCazaQr.test.ts`
- `test/unit/modules/invoices/invoiceConsultaSunat.test.tsx`
- `test/unit/modules/invoices/invoiceDetailRefresh.test.tsx`
- `test/unit/modules/invoices/invoiceIssuerRucPin.test.tsx`
- `test/unit/modules/invoices/invoiceNormativeRules.test.ts`
- `test/unit/modules/invoices/invoiceQueueEvents.test.ts`
- `test/unit/modules/invoices/invoiceTramaQrDigest.test.ts`
- `test/unit/modules/invoices/p9-close.test.tsx`
- `test/unit/modules/invoices/partnerLegacyIdentity.test.tsx`
- `test/unit/modules/invoices/partnerRecords.test.tsx`
- `test/unit/modules/invoices/partnerStatus.test.tsx`
- `test/unit/modules/invoices/partnerSummary.test.tsx`

29 archivos frontend y FERRY.md: 30 entradas SHA-256. No se incluye el hash del manifiesto en sí mismo.

## Validación final

Back: 401 suites / 4034 pruebas → 404 suites / 4051 pruebas. Front: 182 archivos / 1404 pruebas → 188 archivos / 1421 pruebas. Suites completas verdes; back mantiene 4 suites / 38 pruebas omitidas y 12 snapshots aprobados. Builds completos de ambas capas y lint backend OK. Pruebas con dobles y PostgreSQL local, sin emisiones reales. El cierre registra además las pruebas específicas de búsqueda y las regresiones del detalle. No hay migraciones ni PR nuevo.
