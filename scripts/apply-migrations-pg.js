const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Leer .env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✅ Conectado a PostgreSQL en Supabase.');

  // 1. Crear enums si no existen
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "GoodsReceiptStatus" AS ENUM ('CONFORME', 'CON_DISCREPANCIA', 'OBSERVADO');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "SeriesDestinationType" AS ENUM ('MERCADERIA', 'ACTIVO_FIJO');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // 2. Crear goods_receipts
  await client.query(`
    CREATE TABLE IF NOT EXISTS "goods_receipts" (
      "id" TEXT NOT NULL,
      "company_id" TEXT NOT NULL,
      "receipt_number" TEXT NOT NULL,
      "declaration_id" TEXT NOT NULL,
      "shipment_id" TEXT,
      "order_id" TEXT,
      "warehouse_code" TEXT NOT NULL DEFAULT 'ALM-01',
      "reception_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "reception_type" TEXT NOT NULL DEFAULT 'TOTAL',
      "responsible_name" TEXT NOT NULL,
      "responsible_dni" TEXT,
      "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'CONFORME',
      "observation_notes" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "goods_receipts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "goods_receipts_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "customs_declarations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "goods_receipts_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "customs_shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "goods_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "import_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "goods_receipts_company_id_receipt_number_key" ON "goods_receipts"("company_id", "receipt_number");
  `);
  console.log('✅ Tabla goods_receipts creada/verificada.');

  // 3. Crear goods_receipt_items
  await client.query(`
    CREATE TABLE IF NOT EXISTS "goods_receipt_items" (
      "id" TEXT NOT NULL,
      "goods_receipt_id" TEXT NOT NULL,
      "customs_item_id" TEXT,
      "product_code" TEXT NOT NULL,
      "commercial_description" TEXT NOT NULL,
      "declared_quantity" DECIMAL(12,4) NOT NULL,
      "received_quantity" DECIMAL(12,4) NOT NULL,
      "damaged_quantity" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
      "difference_quantity" DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
      "discrepancy_reason" TEXT,
      "unit_code" TEXT NOT NULL DEFAULT 'NIU',
      "destination_type" "SeriesDestinationType" NOT NULL DEFAULT 'MERCADERIA',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "goods_receipt_items_goods_receipt_id_idx" ON "goods_receipt_items"("goods_receipt_id");
  `);
  console.log('✅ Tabla goods_receipt_items creada/verificada.');

  // 4. Crear import_order_documents
  await client.query(`
    CREATE TABLE IF NOT EXISTS "import_order_documents" (
      "id" TEXT NOT NULL,
      "order_id" TEXT NOT NULL,
      "stage_index" INTEGER NOT NULL,
      "stage_name" TEXT NOT NULL,
      "document_type" TEXT NOT NULL,
      "document_number" TEXT NOT NULL,
      "file_name" TEXT NOT NULL,
      "storage_url" TEXT NOT NULL,
      "file_hash" TEXT,
      "file_size_bytes" INTEGER,
      "mime_type" TEXT,
      "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
      "is_verified" BOOLEAN NOT NULL DEFAULT false,
      "uploaded_by" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "import_order_documents_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "import_order_documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "import_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "import_order_documents_order_id_stage_index_idx" ON "import_order_documents"("order_id", "stage_index");
  `);
  console.log('✅ Tabla import_order_documents creada/verificada.');

  // 5. Vincular customs_declarations con import_orders
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE "customs_declarations" ADD COLUMN "order_id" TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "customs_declarations"
        ADD CONSTRAINT "customs_declarations_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "import_orders"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  console.log('\n=== VERIFICANDO TODAS LAS TABLAS DEL SISTEMA ===');
  const tables = [
    'companies',
    'users',
    'invoices',
    'currencies',
    'exchange_rates',
    'incoterms',
    'business_partners',
    'partner_bank_accounts',
    'inventory_products',
    'inventory_warehouses',
    'inventory_movements',
    'inventory_balances',
    'inventory_transfers',
    'inventory_adjustments',
    'national_purchases',
    'national_purchase_items',
    'customs_shipments',
    'customs_declarations',
    'import_orders',
    'import_order_items',
    'import_order_documents',
    'goods_receipts',
    'goods_receipt_items',
    'treasury_movements',
    'accounting_mappings',
    'accounting_entries',
  ];

  let allOk = true;
  for (const t of tables) {
    try {
      const res = await client.query(`SELECT count(*)::int as count FROM "${t}";`);
      console.log(`   ✅ Tabla "${t}": OK (${res.rows[0].count} registros)`);
    } catch (e) {
      console.error(`   ❌ Error en tabla "${t}":`, e.message);
      allOk = false;
    }
  }

  await client.end();
  if (allOk) {
    console.log('\n🎉 ¡TODAS LAS TABLAS DE LA BASE DE DATOS ESTÁN 100% OPERATIVAS Y SINCRONIZADAS!');
  } else {
    console.log('\n⚠️ Hubo algún detalle con alguna tabla.');
  }
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
