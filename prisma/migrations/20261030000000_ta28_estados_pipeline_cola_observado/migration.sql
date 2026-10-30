-- TA-28: estados del pipeline de cola y de la observacion del CDR.
-- EN_COLA: el comprobante quedo encolado y el Circuit Breaker lo retuvo sin tocar SUNAT.
-- OBSERVADO: SUNAT acepto el comprobante con observaciones (codigo >= 4000).
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'EN_COLA';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'OBSERVADO';
