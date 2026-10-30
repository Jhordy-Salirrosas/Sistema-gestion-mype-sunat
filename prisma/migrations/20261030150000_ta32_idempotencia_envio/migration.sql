-- TA-32: llave de idempotencia del envío.
--
-- Aditiva a propósito. El criterio 1 del backlog pide unicidad sobre
-- (ruc_emisor, tipo_comprobante, serie, correlativo); se implementa AÑADIENDO
-- ruc_emisor a la llave existente uq_invoices_fiscal, que ya cubre
-- (company_id, tipo_comprobante, serie, correlativo).
--
-- Por qué ADICIONAL y no un reemplazo literal:
--   1. uq_invoices_fiscal ya está en producción y PrismaInvoiceRepository
--      depende de su P2002 para responder 409 (ver su comentario). Quitarla
--      dejaría sin defensa la emisión duplicada desde la misma empresa.
--   2. ruc_emisor por sí solo no basta como llave fiscal: dos empresas
--      distintas de la plataforma pueden emitir la misma serie-correlativo
--      (dos tenants independientes), y ahí hay dos filas legítimas.
--   3. (company_id, ruc_emisor, tipo, serie, correlativo) sí es único sin ser
--      tan estricto como (ruc_emisor, tipo, serie, correlativo) a secas.
--
-- Reversible: basta con DROP INDEX "uq_invoices_idempotencia" (ver el final).
--
-- El índice se llama distinto del constraint porque PostgreSQL ya crea un
-- índice con el nombre del constraint para la UNIQUE existente.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoices_idempotencia"
  ON "invoices" (
    "company_id",
    "ruc_emisor",
    "tipo_comprobante",
    "serie",
    "correlativo"
  );

-- Rollback manual:
--   DROP INDEX IF EXISTS "uq_invoices_idempotencia";
