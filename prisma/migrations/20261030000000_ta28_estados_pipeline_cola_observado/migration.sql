-- TA-28: estados que exige el pipeline asincrono de TA-28.
--   EN_COLA      -> el comprobante esta esperando en sunat-invoice-queue
--   OBSERVADO    -> el CDR trae observaciones (codigo >= 4000): tiene
--                   validez tributaria pero no es una aceptacion limpia
--
-- PostgreSQL 12+ permite agregar varios valores a un enum en un solo
-- ALTER TYPE, que es lo que usa el pooler de Supabase (PG 17).
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'EN_COLA';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'OBSERVADO';
