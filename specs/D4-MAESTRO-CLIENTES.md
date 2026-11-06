# D4 — Maestro de clientes y retención automática

## Estado

Propuesta para acuerdo. No aplicar migración ni cambiar M1 hasta que Jhordy, Diego y Oliver confirmen.

## Decisión de diseño

No crear una entidad nueva: reutilizar `BusinessPartner` como maestro compartido.

Motivos:

- ya existe en `prisma/schema/master-data.prisma`;
- tiene `doc_type`, `doc_number`, `legal_name`, `address`, `roles`;
- ya lo usan Aduanas y Compras;
- tiene unicidad por empresa + documento.

Dueño: **núcleo compartido/master-data**, no M1.

## Modelo propuesto

Agregar una tabla de vigencia por indicador, en lugar de booleanos sueltos:

```prisma
enum PartnerTaxIndicator {
  RETENCION
  PERCEPCION
  BUEN_CONTRIBUYENTE
}

model PartnerTaxStatus {
  id          String              @id @default(uuid())
  partner_id  String
  partner     BusinessPartner     @relation(fields: [partner_id], references: [id], onDelete: Cascade)
  indicator   PartnerTaxIndicator
  value       Boolean
  valid_from  DateTime
  valid_to    DateTime?
  source      String              @default("MANUAL") // MANUAL | SUNAT
  updated_by  String?
  created_at  DateTime            @default(now())

  @@index([partner_id, indicator, valid_from])
  @@map("partner_tax_status")
}
```

Y en `BusinessPartner`:

```prisma
tax_status PartnerTaxStatus[]
```

Ventaja: permite historial y vigencia. La consulta toma el registro con `valid_from <= hoy` y `valid_to` nulo o futuro.

## Migración propuesta

1. Crear enum y tabla `partner_tax_status`.
2. Agregar relación en `BusinessPartner`.
3. Backfill de clientes desde comprobantes:

```sql
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
```

4. No borrar la cartera derivada todavía. El buscador usa el maestro y cae al método anterior si no hay resultados.

## API

Reutilizar:

```text
GET  /api/v1/master-data/partners?q=
POST /api/v1/master-data/partners
PUT  /api/v1/master-data/partners/:id
```

Agregar:

```text
GET /api/v1/master-data/partners/:id/tax-status
PUT /api/v1/master-data/partners/:id/tax-status
```

Respuesta mínima:

```json
{
  "partnerId": "...",
  "retencion": { "value": true, "validFrom": "2026-01-01", "source": "SUNAT" },
  "percepcion": { "value": false },
  "buenContribuyente": { "value": false }
}
```

## Cambio en M1

1. Al escribir el RUC, buscar en `business_partners`.
2. Si existe, leer `RETENCION` vigente.
3. Aplicar retención del 3 % automáticamente; no tocar la fórmula.
4. Si no existe, ofrecer crearlo; no crear comprobante sin cliente.
5. La casilla manual:
   - opción A: eliminarla;
   - opción B: dejarla como corrección excepcional, con auditoría.

Recomendación: opción A para la primera versión; si se necesitaoverride, opción B con registro en `audit_logs`.

## Criterios de aceptación

- Cliente con `RETENCION=true` vigente: retención automática.
- Cliente con `RETENCION=false`: sin retención.
- Buscador por RUC y nombre funciona contra el maestro.
- Si el maestro no tiene resultados, la cartera derivada sigue funcionando.
- SIRE y Aduanas no se rompen.
- Se prueba migración en una copia de Supabase antes de producción.

## Riesgos

- La base es compartida: la migración debe coordinarse y probarse en una copia.
- El backfill puede duplicar documentos con distinto `doc_type`; la unicidad lo evita.
- El indicador puede cambiar con el tiempo: por eso `valid_from/valid_to`, no un booleano.
- La casilla manual no debe ser la fuente de verdad.

## Acuerdos

- Jhordy: adopta el maestro en emisión y define el destino de la casilla.
- Diego: confirma los campos que SIRE espera del cliente.
- Oliver: dueño de la migración y del maestro compartido.
