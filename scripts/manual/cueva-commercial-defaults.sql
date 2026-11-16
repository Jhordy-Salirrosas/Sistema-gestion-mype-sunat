-- Expansión aditiva. Ejecutar solo tras revisar el preflight y el checksum.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.companies') IS NULL THEN RAISE EXCEPTION 'Falta companies'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS invoice_commercial_defaults (
  company_id text PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  forma_pago text NOT NULL DEFAULT 'Contado' CHECK (forma_pago IN ('Contado','Credito')),
  medio_pago text NOT NULL DEFAULT 'EFECTIVO' CHECK (medio_pago IN ('EFECTIVO','YAPE','PLIN','TARJETA','TRANSFERENCIA','DEPOSITO','CHEQUE'))
);
COMMIT;
-- Reversa (solo si no se requiere conservar la configuración):
-- BEGIN; DROP TABLE invoice_commercial_defaults; COMMIT;
