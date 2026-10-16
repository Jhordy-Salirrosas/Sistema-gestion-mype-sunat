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

## Alcance: qué tiene modelo propio y qué no

Los cinco módulos con persistencia propia son **facturación, aduanas,
contabilidad, SIRE y resiliencia**.

**El dashboard no tiene tablas propias:** es una **función de lectura** que agrega
y resume datos de los cinco módulos. No persiste configuración ni estado, así que
no requiere modelo. Si en el futuro necesita preferencias por usuario, se
evaluaría un modelo aparte.

## Agregados (DDD táctico)

Un **agregado** es un conjunto de entidades que se modifican juntas y cuya
consistencia se garantiza dentro de **una sola transacción**. El acceso desde
fuera del agregado se hace **siempre por su raíz** (_Aggregate Root_), nunca
directamente sobre las entidades internas.

El límite de cada agregado se deduce del schema: las relaciones con
`onDelete: Cascade` indican que la entidad interna **no existe sin su raíz**;
las relaciones con `onDelete: Restrict` indican **agregados separados** que solo
se referencian entre sí.

### Raíces de agregado con entidades internas

| Raíz de agregado         | Entidades internas                  | Invariante que protege                                                            | Consistencia                                   |
| ------------------------ | ----------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| **`Invoice`**            | `InvoiceItem`, `TransactionHistory` | `Σ InvoiceItem.total_amount = monto_total`; IGV = 18% de las operaciones gravadas | Una transacción: `saveWithTransactionalOutbox` |
| **`CustomsDeclaration`** | `CustomsItem`                       | `Σ allocated_cif_pen = cif_value_pen`; tributos = CIF × tasas                     | Pendiente (M3)                                 |
| **`AccountingEntry`**    | `AccountingLine`                    | **`Σ debit_amount = Σ credit_amount`** (partida doble)                            | Pendiente (M5)                                 |
| **`SireReconciliation`** | `SireDiscrepancy`                   | `discrepancies_count = Σ discrepancias`                                           | Pendiente (M4)                                 |
| **`User`**               | `RefreshToken`                      | Un usuario pertenece a una sola empresa                                           | Pendiente (Auth)                               |

### Raíces independientes

Sin entidades internas: cada una es su propio agregado.

| Raíz de agregado     | Invariante propia                                                        |
| -------------------- | ------------------------------------------------------------------------ |
| **`Company`**        | `ruc` único; todo dato tributario cuelga de una empresa (_multi-tenant_) |
| **`PleBook`**        | `file_sha256_hash` corresponde al archivo generado                       |
| **`KardexMovement`** | `final_stock_quantity` = existencia anterior ± el movimiento             |
| **`SireProposal`**   | Propuesta importada de SUNAT: inmutable                                  |
| **`AuditLog`**       | `digest_hash` encadenado con el registro anterior (SHA-256)              |

`Company` y `User` son **agregados separados** aunque estén relacionados: la
relación es `onDelete: Restrict`, no `Cascade`. `User` referencia a `Company` por
`company_id`, pero la existencia de la empresa no depende de sus usuarios.

### Regla de aislamiento entre agregados

**Un agregado referencia a otro solo por su identificador, nunca por sus
entidades internas.** Por eso `Invoice` guarda `series_rel_id` —una clave hacia
`InvoiceSeries`— y no una copia de la serie: `InvoiceSeries` es un agregado
aparte y su consistencia se garantiza por separado.

**Y cada módulo escribe solo en sus agregados.** La comunicación entre módulos se
realiza por eventos de dominio, no por acceso directo a las tablas de otro
contexto (`specs/PLAN.md`, regla 4 de dependencia entre capas).

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

### Estado de los repositorios por contexto

| Contexto     | Entidad de dominio      | Puerto de repositorio       | Adaptador                     |
| ------------ | ----------------------- | --------------------------- | ----------------------------- |
| `invoices`   | `InvoiceEntity`         | `IInvoiceRepositoryPort`    | `PrismaInvoiceRepository`     |
| `auth`       | `UserEntity`            | `IUserRepositoryPort`       | `PrismaUserRepositoryAdapter` |
| `accounting` | `AccountingEntryEntity` | `IAccountingRepositoryPort` | Pendiente (M5)                |
| `sire`       | `SireProposalEntity`    | Pendiente (M4)              | Pendiente (M4)                |
| `customs`    | Pendiente (M3)          | Pendiente (M3)              | Pendiente (M3)                |

Un puerto de repositorio depende de la entidad que persiste. Por eso `customs`,
`sire` y `resilience` aún no tienen puerto: sus entidades de dominio se definen en
las tareas de cada módulo (M3, M4 y M2 respectivamente). Este documento define el
**modelo de datos** —las tablas, sus relaciones y sus agregados—, no la capa de
dominio de cada módulo.
