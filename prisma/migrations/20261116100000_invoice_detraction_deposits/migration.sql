-- Aplicación manual revisada: no ejecutar la cola oficial en la base compartida.
-- Se detiene ante resúmenes incompletos o incompatibles, sin descartar datos.
DO $$ BEGIN
 IF EXISTS (
  SELECT 1 FROM invoices WHERE
   (detraccion_deposited_at IS NOT NULL OR detraccion_deposited_amount IS NOT NULL OR detraccion_constancia IS NOT NULL)
   AND (detraccion_deposited_at IS NULL OR detraccion_deposited_amount IS NULL
    OR detraccion_deposited_amount <= 0
    OR COALESCE((payload_ubl->>'montoDetraccion')::numeric, 0) < detraccion_deposited_amount)
 ) THEN RAISE EXCEPTION 'Hay depósitos históricos incompletos o superiores a la detracción; revisar antes de aplicar.';
 END IF;
END $$;

CREATE TABLE "invoice_detraction_deposits" (
 "id" TEXT NOT NULL,
 "company_id" TEXT NOT NULL,
 "invoice_id" TEXT NOT NULL,
 "date" TIMESTAMP(3) NOT NULL,
 "amount" DECIMAL(14,2) NOT NULL,
 "constancia" TEXT,
 "legacy" BOOLEAN NOT NULL DEFAULT false,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "invoice_detraction_deposits_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "invoice_detraction_deposits_amount_check" CHECK ("amount" > 0),
 CONSTRAINT "invoice_detraction_deposits_constancia_check" CHECK ("legacy" OR "constancia" IS NULL OR "constancia" ~ '^[0-9]+$'),
 CONSTRAINT "invoice_detraction_deposits_invoice_fkey" FOREIGN KEY ("company_id", "invoice_id") REFERENCES "invoices"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "invoice_detraction_deposits_company_id_invoice_id_date_idx" ON "invoice_detraction_deposits"("company_id", "invoice_id", "date");

-- Copia literal del resumen previo: no normaliza constancias antiguas ni inventa eventos de usuario.
INSERT INTO "invoice_detraction_deposits" ("id", "company_id", "invoice_id", "date", "amount", "constancia", "legacy", "created_at", "updated_at")
 SELECT md5('detraction-legacy:' || id), company_id, id, detraccion_deposited_at,
 detraccion_deposited_amount, detraccion_constancia, true, created_at, updated_at
 FROM invoices WHERE detraccion_deposited_amount IS NOT NULL;
