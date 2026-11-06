-- D4: backfill del maestro desde comprobantes ya emitidos.
-- NO ejecutar en la base compartida sin acuerdo del equipo.
INSERT INTO business_partners
  (id, company_id, doc_type, doc_number, legal_name, roles, is_active)
SELECT
  gen_random_uuid(),
  i.company_id,
  COALESCE(i.customer_identity_type, '6'),
  i.customer_identity_number,
  MAX(i.customer_legal_name),
  ARRAY['CLIENTE'],
  true
FROM invoices i
WHERE i.customer_identity_number IS NOT NULL
  AND i.customer_identity_number <> ''
GROUP BY i.company_id, i.customer_identity_type, i.customer_identity_number
ON CONFLICT (company_id, doc_type, doc_number) DO NOTHING;
