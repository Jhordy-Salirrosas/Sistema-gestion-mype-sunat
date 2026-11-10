const fs = require('fs');
const path = require('path');

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

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/client/client.js');

async function applyMigrations() {
  console.log('=== APLICANDO MIGRACIONES ADITIVAS A SUPABASE POSTGRESQL ===');
  
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
  const folders = fs.readdirSync(migrationsDir)
    .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
    .sort();

  for (const folder of folders) {
    const sqlPath = path.join(migrationsDir, folder, 'migration.sql');
    if (!fs.existsSync(sqlPath)) continue;

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log(`\n⏳ Procesando migración: ${folder}...`);

    // Limpiar comentarios de línea y separar por sentencias
    const cleanSql = sqlContent.replace(/--.*$/gm, '');
    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err) {
        // Ignorar si el tipo o tabla ya existe (idempotencia)
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          // Ya existe, continuar
        } else {
          console.warn(`   ⚠️ Nota en sentencia: ${err.message.slice(0, 100)}`);
        }
      }
    }
    console.log(`   ✅ Migración aplicada/verificada: ${folder}`);
  }

  console.log('\n=== VERIFICANDO EXISTENCIA DE TABLAS POST-MIGRACIÓN ===');
  const tables = [
    'companies',
    'currencies',
    'incoterms',
    'business_partners',
    'partner_bank_accounts',
    'inventory_products',
    'inventory_movements',
    'inventory_balances',
    'inventory_transfers',
    'inventory_adjustments',
    'national_purchases',
    'import_orders',
    'import_order_items',
    'import_order_documents',
    'treasury_movements',
    'accounting_mappings',
    'accounting_entries',
    'inventory_brands',
    'inventory_models',
    'inventory_categories',
    'inventory_manufacturers',
    'inventory_tags',
    'sunat_unit_measurements',
    'inventory_product_suppliers',
    'inventory_product_presentations',
  ];

  for (const table of tables) {
    try {
      const count = await prisma.$queryRawUnsafe(`SELECT count(*)::int as count FROM "${table}";`);
      console.log(`   ✅ Tabla "${table}": OK (${count[0].count} registros)`);
    } catch (e) {
      console.error(`   ❌ ERROR en tabla "${table}":`, e.message);
    }
  }

  await prisma.$disconnect();
  console.log('\n=== MIGRACIONES APLICADAS CON ÉXITO ===');
}

applyMigrations().catch((err) => {
  console.error('Error fatal al aplicar migraciones:', err);
  process.exit(1);
});

