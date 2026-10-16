# Modelo de datos — SYNC-SUNAT

Documenta los **17 modelos** de los cinco módulos (facturación, aduanas,
contabilidad, SIRE y resiliencia) definidos en `prisma/schema/`.

> El diagrama se renderiza directamente en GitHub.

## Diagrama entidad-relación

```mermaid
erDiagram
    %% ---------- Contexto: Autenticación y Multi-Tenancy ----------
    Company {
        string id PK
        string ruc UK
        string legal_name
        string trade_name
        string sol_user
        string sol_pass_encrypted
        string cert_storage_url
        boolean is_active
    }
    User {
        string id PK
        string company_id FK
        string email
        string password_hash
        string full_name
        Role role
        boolean is_active
    }
    RefreshToken {
        string id PK
        string user_id FK
        string token_hash
        timestamp expires_at
        boolean is_revoked
    }

    %% ---------- Contexto: Facturación (M1) ----------
    InvoiceSeries {
        string id PK
        string company_id FK
        string document_type
        string series
        int current_correlative
        boolean is_active
    }
    Invoice {
        string id PK
        string company_id FK
        string series_rel_id FK
        string ruc_emisor
        string serie
        int correlativo
        string tipo_comprobante
        decimal monto_total
        timestamp fecha_emision
        InvoiceStatus estado
        json payload_ubl
        json cdr_sunat
        string currency_code
        decimal total_igv
        string sunat_response_code
    }
    InvoiceItem {
        string id PK
        string invoice_id FK
        int item_order
        string description
        decimal quantity
        decimal unit_value
        decimal igv_amount
        decimal total_amount
    }

    %% ---------- Contexto: Resiliencia (M2) ----------
    TransactionHistory {
        string id PK
        string invoice_id FK
        string company_id
        int intento
        InvoiceStatus estado_anterior
        InvoiceStatus estado_nuevo
        string codigo_error
        int tiempo_respuesta_ms
        string circuit_breaker_state
    }
    AuditLog {
        string id PK
        string company_id FK
        string user_id FK
        string module
        string action
        string entity_name
        string entity_id
        string digest_hash
    }

    %% ---------- Contexto: Aduanas (M3) ----------
    CustomsDeclaration {
        string id PK
        string company_id FK
        string dua_number
        string customs_agency_code
        string regime_code
        decimal cif_value_usd
        decimal total_customs_taxes_pen
        CustomsStatus status
    }
    CustomsItem {
        string id PK
        string declaration_id FK
        int item_order
        string hs_code
        decimal quantity
        decimal fob_total_usd
        decimal landed_cost_unit_pen
    }
    KardexMovement {
        string id PK
        string company_id FK
        timestamp movement_date
        KardexMovementType movement_type
        string item_code
        decimal quantity_in
        decimal quantity_out
        decimal final_stock_quantity
        decimal final_total_inventory_value
    }

    %% ---------- Contexto: SIRE (M4) ----------
    SireProposal {
        string id PK
        string company_id FK
        string period
        SireBookType book_type
        string car_sunat
        string emitter_ruc
        string document_type
        string series
        string correlative
        decimal total_amount
    }
    SireReconciliation {
        string id PK
        string company_id FK
        string reconciled_by FK
        string period
        SireBookType book_type
        int total_sunat_records
        int total_local_records
        int discrepancies_count
        ReconciliationStatus status
    }
    SireDiscrepancy {
        string id PK
        string reconciliation_id FK
        string sire_proposal_id FK
        DiscrepancyType discrepancy_type
        decimal amount_difference
        ResolutionAction resolution_action
    }

    %% ---------- Contexto: Contabilidad (M5) ----------
    AccountingEntry {
        string id PK
        string company_id FK
        string period
        int entry_number
        timestamp entry_date
        string glosa
        string source_module
        decimal total_debit
        decimal total_credit
        boolean is_balanced
        EntryStatus status
    }
    AccountingLine {
        string id PK
        string entry_id FK
        int line_order
        string account_code
        decimal debit_amount
        decimal credit_amount
    }
    PleBook {
        string id PK
        string company_id FK
        string generated_by FK
        string period
        string book_code
        string official_file_name
        int records_count
        string file_storage_url
        string file_sha256_hash
    }

    %% ---------- Relaciones ----------
    Company ||--o{ User : "emplea"
    Company ||--o{ RefreshToken : ""
    User ||--o{ RefreshToken : "posee"

    Company ||--o{ InvoiceSeries : "configura"
    Company |o--o{ Invoice : "emite"
    InvoiceSeries |o--o{ Invoice : "numera"
    Invoice ||--o{ InvoiceItem : "contiene"
    Invoice ||--o{ TransactionHistory : "audita"

    Company ||--o{ AuditLog : "registra"

    Company ||--o{ CustomsDeclaration : "declara"
    CustomsDeclaration ||--o{ CustomsItem : "detalla"
    Company ||--o{ KardexMovement : "mueve"

    Company ||--o{ SireProposal : "importa"
    Company ||--o{ SireReconciliation : "concilia"
    SireReconciliation ||--o{ SireDiscrepancy : "detecta"
    SireProposal |o--o{ SireDiscrepancy : "origina"

    Company ||--o{ AccountingEntry : "asienta"
    AccountingEntry ||--o{ AccountingLine : "compone"
    Company ||--o{ PleBook : "genera"
    User |o--o{ PleBook : "genera"
    User |o--o{ AuditLog : "ejecuta"
    User |o--o{ SireReconciliation : "reconcilia"
```

## Correspondencia modelo ↔ tabla

Los modelos usan `PascalCase` y las tablas `snake_case` plural, mediante `@@map`:

| Modelo Prisma        | Tabla en PostgreSQL    |
| -------------------- | ---------------------- |
| `Company`            | `companies`            |
| `User`               | `users`                |
| `RefreshToken`       | `refresh_tokens`       |
| `Invoice`            | `invoices`             |
| `InvoiceSeries`      | `invoice_series`       |
| `InvoiceItem`        | `invoice_items`        |
| `TransactionHistory` | `transaction_history`  |
| `AuditLog`           | `audit_logs`           |
| `CustomsDeclaration` | `customs_declarations` |
| `CustomsItem`        | `customs_items`        |
| `KardexMovement`     | `kardex_movements`     |
| `SireProposal`       | `sire_proposals`       |
| `SireReconciliation` | `sire_reconciliations` |
| `SireDiscrepancy`    | `sire_discrepancies`   |
| `AccountingEntry`    | `accounting_entries`   |
| `AccountingLine`     | `accounting_lines`     |
| `PleBook`            | `ple_books`            |

## Cómo se generan las migraciones

**Las migraciones se generan SOLO contra la base local.** Supabase no otorga el
permiso `CREATEDB` que Prisma necesita para la shadow database, así que
`migrate dev` falla contra Supabase. El flujo es:

```bash
# 1. Base local descartable (una vez)
docker run -d --name postgres-ta19 \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=ta19_test \
  -p 5435:5432 postgres:16

# 2. Shadow database, que Prisma no crea sola al estar declarada en el config (una vez)
docker exec postgres-ta19 psql -U postgres -c "CREATE DATABASE ta19_shadow;"

# 3. Apuntar el CLI a la base local
$env:DIRECT_URL="postgresql://postgres:test@localhost:5435/ta19_test"
$env:SHADOW_DATABASE_URL="postgresql://postgres:test@localhost:5435/ta19_shadow"

# 4. Generar y aplicar
npx prisma migrate dev --name <descripcion>

# 5. Desplegar a Supabase (aditivo, no borra)
$env:DIRECT_URL="<URL directa de Supabase>"
npx prisma migrate deploy
```

### Verificar que no hay desviación

```bash
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema prisma/schema --script
```

Si imprime `-- This is an empty migration.`, el historial de migraciones reproduce
exactamente el schema.

## Advertencia de seguridad

**El CLI de Prisma lee `DIRECT_URL`, no `DATABASE_URL`.** El archivo `.env` apunta
a Supabase, así que **si no se sobreescribe `DIRECT_URL` en la sesión, cualquier
comando de migración actúa sobre producción.**

Verificar siempre antes de un comando destructivo:

```powershell
echo $env:DIRECT_URL
```

| Comando          | Base permitida                           |
| ---------------- | ---------------------------------------- |
| `migrate reset`  | **Solo local.** Nunca Supabase           |
| `migrate dev`    | **Solo local.** Requiere shadow database |
| `migrate deploy` | Supabase (es aditivo)                    |
