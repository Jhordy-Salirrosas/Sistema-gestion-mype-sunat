-- Tabla de valores por defecto de forma y medio de pago por empresa.
--
-- Existía en Supabase pero ninguna migración la creaba: se creó fuera de control
-- de versiones y la consulta InvoiceCommercialDefaultsService con SQL crudo, así
-- que una base nueva fallaba al emitir comprobantes.

CREATE TABLE "invoice_commercial_defaults" (
    "company_id" TEXT NOT NULL,
    "forma_pago" TEXT NOT NULL DEFAULT 'Contado',
    "medio_pago" TEXT NOT NULL DEFAULT 'EFECTIVO',

    CONSTRAINT "invoice_commercial_defaults_pkey" PRIMARY KEY ("company_id")
);

ALTER TABLE "invoice_commercial_defaults"
  ADD CONSTRAINT "invoice_commercial_defaults_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE;

ALTER TABLE "invoice_commercial_defaults"
  ADD CONSTRAINT "invoice_commercial_defaults_forma_pago_check"
  CHECK ("forma_pago" IN ('Contado', 'Credito'));

ALTER TABLE "invoice_commercial_defaults"
  ADD CONSTRAINT "invoice_commercial_defaults_medio_pago_check"
  CHECK ("medio_pago" IN ('EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA', 'DEPOSITO', 'CHEQUE'));
