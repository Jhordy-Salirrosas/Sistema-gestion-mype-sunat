-- Rename: preserva las 2 tablas existentes y sus datos (criterio 3 de TA-19).
-- La base actual (Supabase) tiene "Invoice" y "TransactionHistory" en PascalCase.
ALTER TABLE "Invoice" RENAME TO "invoices";
ALTER TABLE "TransactionHistory" RENAME TO "transaction_history";
-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('BORRADOR', 'ASENTADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CONTADOR', 'OPERADOR_FACTURACION', 'OPERADOR_ADUANAS', 'AUDITOR');

-- CreateEnum
CREATE TYPE "CustomsStatus" AS ENUM ('REGISTRADO', 'LIQUIDADO', 'APLICADO_KARDEX', 'ANULADO');

-- CreateEnum
CREATE TYPE "KardexMovementType" AS ENUM ('INGRESO_IMPORTACION', 'SALIDA_VENTA', 'AJUSTE_INVENTARIO');

-- CreateEnum
CREATE TYPE "SireBookType" AS ENUM ('RVIE_VENTAS', 'RCE_COMPRAS');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('EN_REVISION', 'CONCILIADO', 'CERRADO');

-- CreateEnum
CREATE TYPE "DiscrepancyType" AS ENUM ('COINCIDENCIA_EXACTA', 'DIFERENCIA_MONTOS', 'OMISION_LOCAL', 'OMISION_SUNAT');

-- CreateEnum
CREATE TYPE "ResolutionAction" AS ENUM ('ACEPTAR_PROPUESTA_SUNAT', 'MANTENER_REGISTRO_LOCAL', 'PENDIENTE');

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'ANULADO';

-- DropForeignKey
ALTER TABLE "transaction_history" DROP CONSTRAINT "TransactionHistory_invoice_id_fkey";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "cdr_storage_url" TEXT,
ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "credit_debit_reason_code" TEXT,
ADD COLUMN     "currency_code" TEXT NOT NULL DEFAULT 'PEN',
ADD COLUMN     "customer_identity_number" TEXT,
ADD COLUMN     "customer_identity_type" TEXT,
ADD COLUMN     "customer_legal_name" TEXT,
ADD COLUMN     "exempt_operations" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "referenced_document_type" TEXT,
ADD COLUMN     "referenced_invoice_id" TEXT,
ADD COLUMN     "referenced_series_correlative" TEXT,
ADD COLUMN     "series_rel_id" TEXT,
ADD COLUMN     "sunat_response_code" TEXT,
ADD COLUMN     "taxable_operations" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "total_igv" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "unaffected_operations" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "xml_hash_sha256" TEXT,
ADD COLUMN     "xml_storage_url" TEXT,
ALTER COLUMN "monto_total" SET DATA TYPE DECIMAL(14,2);
ALTER TABLE "invoices" RENAME CONSTRAINT "Invoice_pkey" TO "invoices_pkey";

-- AlterTable
ALTER TABLE "transaction_history" ADD COLUMN     "circuit_breaker_state" TEXT NOT NULL DEFAULT 'CLOSED',
ADD COLUMN     "company_id" TEXT;
ALTER TABLE "transaction_history" RENAME CONSTRAINT "TransactionHistory_pkey" TO "transaction_history_pkey";

-- CreateTable
CREATE TABLE "accounting_entries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "entry_number" INTEGER NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "glosa" TEXT NOT NULL,
    "source_module" TEXT NOT NULL,
    "source_reference_id" TEXT,
    "total_debit" DECIMAL(14,2) NOT NULL,
    "total_credit" DECIMAL(14,2) NOT NULL,
    "is_balanced" BOOLEAN NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'ASENTADO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_lines" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "line_order" INTEGER NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "debit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "credit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT "accounting_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ple_books" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "book_code" TEXT NOT NULL,
    "official_file_name" TEXT NOT NULL,
    "records_count" INTEGER NOT NULL,
    "total_taxable_base" DECIMAL(14,2) NOT NULL,
    "total_igv" DECIMAL(14,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "file_storage_url" TEXT NOT NULL,
    "file_sha256_hash" TEXT NOT NULL,
    "generated_by" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ple_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "sol_user" TEXT NOT NULL,
    "sol_pass_encrypted" TEXT NOT NULL,
    "cert_storage_url" TEXT,
    "cert_pass_encrypted" TEXT,
    "sire_client_id_enc" TEXT,
    "sire_client_secret_enc" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERADOR_FACTURACION',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_declarations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "dua_number" TEXT NOT NULL,
    "customs_agency_code" TEXT NOT NULL,
    "regime_code" TEXT NOT NULL DEFAULT '10',
    "numeration_date" TIMESTAMP(3) NOT NULL,
    "fob_value_usd" DECIMAL(14,2) NOT NULL,
    "freight_value_usd" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "insurance_value_usd" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "cif_value_usd" DECIMAL(14,2) NOT NULL,
    "exchange_rate" DECIMAL(6,4) NOT NULL,
    "cif_value_pen" DECIMAL(14,2) NOT NULL,
    "ad_valorem_rate" DECIMAL(5,2) NOT NULL,
    "ad_valorem_amount_pen" DECIMAL(14,2) NOT NULL,
    "igv_rate" DECIMAL(5,2) NOT NULL DEFAULT 16.00,
    "ipm_rate" DECIMAL(5,2) NOT NULL DEFAULT 2.00,
    "igv_ipm_amount_pen" DECIMAL(14,2) NOT NULL,
    "perception_rate" DECIMAL(5,2) NOT NULL,
    "perception_amount_pen" DECIMAL(14,2) NOT NULL,
    "total_customs_taxes_pen" DECIMAL(14,2) NOT NULL,
    "status" "CustomsStatus" NOT NULL DEFAULT 'REGISTRADO',
    "dua_pdf_storage_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customs_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_items" (
    "id" TEXT NOT NULL,
    "declaration_id" TEXT NOT NULL,
    "item_order" INTEGER NOT NULL,
    "hs_code" TEXT NOT NULL,
    "commercial_description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_code" TEXT NOT NULL,
    "fob_unit_usd" DECIMAL(14,4) NOT NULL,
    "fob_total_usd" DECIMAL(14,2) NOT NULL,
    "allocated_cif_pen" DECIMAL(14,2) NOT NULL,
    "allocated_duties_pen" DECIMAL(14,2) NOT NULL,
    "landed_cost_unit_pen" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "customs_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kardex_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "movement_date" TIMESTAMP(3) NOT NULL,
    "movement_type" "KardexMovementType" NOT NULL,
    "item_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source_reference_id" TEXT,
    "quantity_in" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "unit_cost_in" DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
    "total_cost_in" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "quantity_out" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    "unit_cost_out" DECIMAL(14,4) NOT NULL DEFAULT 0.0000,
    "total_cost_out" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "final_stock_quantity" DECIMAL(12,4) NOT NULL,
    "final_average_unit_cost" DECIMAL(14,4) NOT NULL,
    "final_total_inventory_value" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kardex_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_series" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "current_correlative" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "item_order" INTEGER NOT NULL,
    "item_code" TEXT,
    "description" TEXT NOT NULL,
    "unit_code" TEXT NOT NULL DEFAULT 'NIU',
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit_value" DECIMAL(14,4) NOT NULL,
    "unit_price" DECIMAL(14,4) NOT NULL,
    "igv_affectation_type" TEXT NOT NULL,
    "igv_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT,
    "previous_values" JSONB,
    "new_values" JSONB,
    "digest_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sire_proposals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "book_type" "SireBookType" NOT NULL,
    "car_sunat" TEXT NOT NULL,
    "emitter_ruc" TEXT NOT NULL,
    "emitter_legal_name" TEXT,
    "document_type" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "correlative" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "taxable_base" DECIMAL(14,2) NOT NULL,
    "igv_amount" DECIMAL(14,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "raw_line_data" JSONB,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sire_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sire_reconciliations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "book_type" "SireBookType" NOT NULL,
    "total_sunat_records" INTEGER NOT NULL,
    "total_local_records" INTEGER NOT NULL,
    "exact_matches_count" INTEGER NOT NULL,
    "discrepancies_count" INTEGER NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'EN_REVISION',
    "reconciled_by" TEXT,
    "reconciled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sire_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sire_discrepancies" (
    "id" TEXT NOT NULL,
    "reconciliation_id" TEXT NOT NULL,
    "discrepancy_type" "DiscrepancyType" NOT NULL,
    "document_type" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "correlative" TEXT NOT NULL,
    "sire_proposal_id" TEXT,
    "local_invoice_id" TEXT,
    "sire_total_amount" DECIMAL(14,2),
    "local_total_amount" DECIMAL(14,2),
    "amount_difference" DECIMAL(14,2) DEFAULT 0.00,
    "resolution_action" "ResolutionAction" NOT NULL DEFAULT 'PENDIENTE',
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "sire_discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_entries_company_id_period_entry_date_idx" ON "accounting_entries"("company_id", "period", "entry_date");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_entries_company_id_period_entry_number_key" ON "accounting_entries"("company_id", "period", "entry_number");

-- CreateIndex
CREATE INDEX "accounting_lines_entry_id_line_order_idx" ON "accounting_lines"("entry_id", "line_order");

-- CreateIndex
CREATE INDEX "accounting_lines_account_code_idx" ON "accounting_lines"("account_code");

-- CreateIndex
CREATE INDEX "ple_books_company_id_period_book_code_idx" ON "ple_books"("company_id", "period", "book_code");

-- CreateIndex
CREATE UNIQUE INDEX "companies_ruc_key" ON "companies"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "users_company_id_email_key" ON "users"("company_id", "email");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_expires_at_idx" ON "refresh_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "customs_declarations_company_id_numeration_date_status_idx" ON "customs_declarations"("company_id", "numeration_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customs_declarations_company_id_dua_number_key" ON "customs_declarations"("company_id", "dua_number");

-- CreateIndex
CREATE INDEX "customs_items_declaration_id_item_order_idx" ON "customs_items"("declaration_id", "item_order");

-- CreateIndex
CREATE INDEX "kardex_movements_company_id_item_code_movement_date_created_idx" ON "kardex_movements"("company_id", "item_code", "movement_date", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_series_company_id_document_type_series_key" ON "invoice_series"("company_id", "document_type", "series");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_item_order_idx" ON "invoice_items"("invoice_id", "item_order");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_name_entity_id_idx" ON "audit_logs"("entity_name", "entity_id");

-- CreateIndex
CREATE INDEX "sire_proposals_company_id_period_document_type_series_corre_idx" ON "sire_proposals"("company_id", "period", "document_type", "series", "correlative");

-- CreateIndex
CREATE UNIQUE INDEX "sire_proposals_company_id_book_type_car_sunat_key" ON "sire_proposals"("company_id", "book_type", "car_sunat");

-- CreateIndex
CREATE INDEX "sire_discrepancies_reconciliation_id_discrepancy_type_idx" ON "sire_discrepancies"("reconciliation_id", "discrepancy_type");

-- CreateIndex
CREATE INDEX "invoices_company_id_fecha_emision_estado_idx" ON "invoices"("company_id", "fecha_emision", "estado");

-- CreateIndex
CREATE INDEX "transaction_history_invoice_id_intento_idx" ON "transaction_history"("invoice_id", "intento");

-- CreateIndex
CREATE INDEX "transaction_history_company_id_created_at_idx" ON "transaction_history"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_lines" ADD CONSTRAINT "accounting_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "accounting_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ple_books" ADD CONSTRAINT "ple_books_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ple_books" ADD CONSTRAINT "ple_books_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_declarations" ADD CONSTRAINT "customs_declarations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_items" ADD CONSTRAINT "customs_items_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "customs_declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kardex_movements" ADD CONSTRAINT "kardex_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_series" ADD CONSTRAINT "invoice_series_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_series_rel_id_fkey" FOREIGN KEY ("series_rel_id") REFERENCES "invoice_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_history" ADD CONSTRAINT "transaction_history_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sire_proposals" ADD CONSTRAINT "sire_proposals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sire_reconciliations" ADD CONSTRAINT "sire_reconciliations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sire_reconciliations" ADD CONSTRAINT "sire_reconciliations_reconciled_by_fkey" FOREIGN KEY ("reconciled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sire_discrepancies" ADD CONSTRAINT "sire_discrepancies_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "sire_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sire_discrepancies" ADD CONSTRAINT "sire_discrepancies_sire_proposal_id_fkey" FOREIGN KEY ("sire_proposal_id") REFERENCES "sire_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
