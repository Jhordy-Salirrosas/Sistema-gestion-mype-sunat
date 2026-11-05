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

async function main() {
  console.log('--- TEST DE CONEXION BASE DE DATOS Y PRISMA ---');
  console.log('DATABASE_URL configurada:', process.env.DATABASE_URL ? 'SI' : 'NO');
  
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const res = await prisma.$queryRawUnsafe('SELECT NOW() as current_time, current_database() as db;');
    console.log('✅ 1. Conexión a PostgreSQL (Supabase) EXITOSA:');
    console.log(res);

    const companies = await prisma.company.findMany({ select: { id: true, ruc: true, legal_name: true } });
    console.log(`✅ 2. Tabla companies accesible (${companies.length} empresas encontradas):`);
    companies.forEach(c => console.log(`   - RUC: ${c.ruc} | ${c.legal_name} (ID: ${c.id})`));

    const companyId = companies[0]?.id;

    if (companyId) {
      const products = await prisma.inventoryProduct.count({ where: { company_id: companyId } });
      console.log(`✅ 3. Tabla inventory_products accesible: ${products} productos para la empresa.`);

      const movements = await prisma.inventoryMovement.count({ where: { company_id: companyId } });
      console.log(`✅ 4. Tabla inventory_movements (Kardex) accesible: ${movements} movimientos.`);

      const currencies = await prisma.currency.count();
      console.log(`✅ 5. Tabla currencies (Monedas) accesible: ${currencies} monedas.`);

      const incoterms = await prisma.incoterm.count();
      console.log(`✅ 6. Tabla incoterms accesible: ${incoterms} incoterms.`);

      const partners = await prisma.businessPartner.count({ where: { company_id: companyId } });
      console.log(`✅ 7. Tabla business_partners (Proveedores/Clientes) accesible: ${partners} socios.`);

      const orders = await prisma.importOrder.count({ where: { company_id: companyId } });
      console.log(`✅ 8. Tabla import_orders accesible: ${orders} órdenes.`);

      // Comprobar tabla treasury_movements creada en la Fase 4
      try {
        const treasury = await prisma.treasuryMovement.count({ where: { company_id: companyId } });
        console.log(`✅ 9. Tabla treasury_movements (Caja y Bancos) accesible: ${treasury} registros.`);
      } catch (e) {
        console.log(`ℹ️ 9. Tabla treasury_movements pendiente en BD remota. Creándola ahora...`);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "treasury_movements" (
              "id" TEXT NOT NULL,
              "company_id" TEXT NOT NULL,
              "movement_date" TIMESTAMP(3) NOT NULL,
              "direction" TEXT NOT NULL,
              "document_reference" TEXT,
              "counterpart_name" TEXT NOT NULL,
              "concept" TEXT NOT NULL,
              "amount" DECIMAL(14,2) NOT NULL,
              "currency_code" TEXT NOT NULL DEFAULT 'PEN',
              "exchange_rate" DECIMAL(14,6),
              "source_module" TEXT NOT NULL,
              "source_reference_id" TEXT,
              "payment_method" TEXT NOT NULL DEFAULT 'TRANSFERENCIA',
              "bank_name" TEXT,
              "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "treasury_movements_pkey" PRIMARY KEY ("id"),
              CONSTRAINT "treasury_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
          );
          CREATE INDEX IF NOT EXISTS "treasury_movements_company_id_movement_date_idx" ON "treasury_movements"("company_id", "movement_date");
          CREATE INDEX IF NOT EXISTS "treasury_movements_company_id_direction_idx" ON "treasury_movements"("company_id", "direction");
        `);
        console.log('✅ Tabla treasury_movements creada exitosamente en PostgreSQL.');
      }
    }

    await prisma.$disconnect();
    console.log('\n--- VERIFICACION DE BASE DE DATOS COMPLETADA CON EXITO ---');
  } catch (err) {
    console.error('❌ ERROR FATAL:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
