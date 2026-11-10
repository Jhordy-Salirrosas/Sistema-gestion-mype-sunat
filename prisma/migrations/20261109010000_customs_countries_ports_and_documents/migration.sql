-- CreateTable
CREATE TABLE IF NOT EXISTS "countries" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ports" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country_code" TEXT NOT NULL DEFAULT 'PE',
    "type" TEXT NOT NULL DEFAULT 'AMBOS',
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ports_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ports_type_idx" ON "ports"("type");
CREATE INDEX IF NOT EXISTS "ports_country_code_idx" ON "ports"("country_code");

-- AlterTable foreign_suppliers
ALTER TABLE "foreign_suppliers" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "foreign_suppliers" ADD COLUMN IF NOT EXISTS "postal_code" TEXT;

-- AlterTable local_expense_invoices
ALTER TABLE "local_expense_invoices" ADD COLUMN IF NOT EXISTS "purchase_id" TEXT;

-- CreateTable customs_declaration_documents
CREATE TABLE IF NOT EXISTS "customs_declaration_documents" (
    "id" TEXT NOT NULL,
    "declaration_id" TEXT NOT NULL,
    "format_type" TEXT NOT NULL,
    "document_number" TEXT,
    "file_name" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "mime_type" TEXT DEFAULT 'application/pdf',
    "file_size_bytes" INTEGER,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customs_declaration_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customs_declaration_documents_declaration_id_idx" ON "customs_declaration_documents"("declaration_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customs_declaration_documents_declaration_id_fkey'
    ) THEN
        ALTER TABLE "customs_declaration_documents" 
        ADD CONSTRAINT "customs_declaration_documents_declaration_id_fkey" 
        FOREIGN KEY ("declaration_id") REFERENCES "customs_declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

