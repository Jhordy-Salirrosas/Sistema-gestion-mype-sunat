require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/client/client.js');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('No company found');

  const fierro = await prisma.inventoryProduct.findFirst({ where: { sku: 'FIE-001' } });
  const clavo = await prisma.inventoryProduct.findFirst({ where: { sku: 'CLV-2' } });
  const alambre = await prisma.inventoryProduct.findFirst({ where: { sku: 'ALM-ARQ-16' } });

  const variants = [];

  if (fierro) {
    variants.push(
      { company_id: company.id, product_id: fierro.id, sku: 'FIE-001-6MM', variant_name: 'Diámetro 6 mm (1/4 pulg) x 9m', attribute_values: { diametro: '6 mm (1/4 pulg)', longitud: '9m', peso_nominal: '0.222 kg/m' }, price_override: 14.50, current_stock: 120 },
      { company_id: company.id, product_id: fierro.id, sku: 'FIE-001-8MM', variant_name: 'Diámetro 8 mm x 9m', attribute_values: { diametro: '8 mm', longitud: '9m', peso_nominal: '0.395 kg/m' }, price_override: 19.80, current_stock: 180 },
      { company_id: company.id, product_id: fierro.id, sku: 'FIE-001-38', variant_name: 'Diámetro 3/8 pulg (9.5 mm) x 9m', attribute_values: { diametro: '3/8 pulg (9.5 mm)', longitud: '9m', peso_nominal: '0.560 kg/m' }, price_override: 26.50, current_stock: 350 },
      { company_id: company.id, product_id: fierro.id, sku: 'FIE-001-12', variant_name: 'Diámetro 1/2 pulg (12.7 mm) x 9m', attribute_values: { diametro: '1/2 pulg (12.7 mm)', longitud: '9m', peso_nominal: '0.994 kg/m' }, price_override: 46.90, current_stock: 280 },
      { company_id: company.id, product_id: fierro.id, sku: 'FIE-001-58', variant_name: 'Diámetro 5/8 pulg (15.9 mm) x 9m', attribute_values: { diametro: '5/8 pulg (15.9 mm)', longitud: '9m', peso_nominal: '1.552 kg/m' }, price_override: 73.20, current_stock: 150 },
      { company_id: company.id, product_id: fierro.id, sku: 'FIE-001-34', variant_name: 'Diámetro 3/4 pulg (19.1 mm) x 9m', attribute_values: { diametro: '3/4 pulg (19.1 mm)', longitud: '9m', peso_nominal: '2.235 kg/m' }, price_override: 105.00, current_stock: 90 },
      { company_id: company.id, product_id: fierro.id, sku: 'FIE-001-1P', variant_name: 'Diámetro 1 pulg (25.4 mm) x 9m', attribute_values: { diametro: '1 pulg (25.4 mm)', longitud: '9m', peso_nominal: '3.973 kg/m' }, price_override: 186.50, current_stock: 45 }
    );
  }

  if (clavo) {
    variants.push(
      { company_id: company.id, product_id: clavo.id, sku: 'CLV-2-1P', variant_name: 'Medida 1 pulg c/cabeza (Madera)', attribute_values: { medida: '1 pulgada', tipo: 'Con cabeza para madera', presentacion: 'Caja x 15 kg' }, price_override: 6.80, current_stock: 65 },
      { company_id: company.id, product_id: clavo.id, sku: 'CLV-2-15P', variant_name: 'Medida 1 1/2 pulg c/cabeza (Madera)', attribute_values: { medida: '1 1/2 pulgadas', tipo: 'Con cabeza para madera', presentacion: 'Caja x 15 kg' }, price_override: 6.50, current_stock: 90 },
      { company_id: company.id, product_id: clavo.id, sku: 'CLV-2-2P', variant_name: 'Medida 2 pulg c/cabeza (Madera estándar)', attribute_values: { medida: '2 pulgadas', tipo: 'Con cabeza para madera', presentacion: 'Caja x 20 kg' }, price_override: 6.20, current_stock: 220 },
      { company_id: company.id, product_id: clavo.id, sku: 'CLV-2-25P', variant_name: 'Medida 2 1/2 pulg c/cabeza (Madera)', attribute_values: { medida: '2 1/2 pulgadas', tipo: 'Con cabeza para madera', presentacion: 'Caja x 20 kg' }, price_override: 6.20, current_stock: 140 },
      { company_id: company.id, product_id: clavo.id, sku: 'CLV-2-3P', variant_name: 'Medida 3 pulg c/cabeza (Madera y encofrado)', attribute_values: { medida: '3 pulgadas', tipo: 'Con cabeza para madera', presentacion: 'Caja x 25 kg' }, price_override: 5.90, current_stock: 180 },
      { company_id: company.id, product_id: clavo.id, sku: 'CLV-2-4P', variant_name: 'Medida 4 pulg c/cabeza (Madera pesada)', attribute_values: { medida: '4 pulgadas', tipo: 'Con cabeza para madera', presentacion: 'Caja x 25 kg' }, price_override: 5.90, current_stock: 75 }
    );
  }

  if (alambre) {
    variants.push(
      { company_id: company.id, product_id: alambre.id, sku: 'ALM-16-AMARRE', variant_name: 'Calibre N° 16 Negro Recocido (Amarre)', attribute_values: { calibre: 'N° 16 (1.65 mm)', uso: 'Amarre de estribos y losas', formato: 'Rollo x 100 kg' }, price_override: 5.80, current_stock: 310 },
      { company_id: company.id, product_id: alambre.id, sku: 'ALM-08-ENCOFRADO', variant_name: 'Calibre N° 8 Negro Recocido (Encofrado)', attribute_values: { calibre: 'N° 8 (4.19 mm)', uso: 'Encofrados pesados y apuntalamiento', formato: 'Rollo x 100 kg' }, price_override: 5.60, current_stock: 190 },
      { company_id: company.id, product_id: alambre.id, sku: 'ALM-14-GALVANIZADO', variant_name: 'Calibre N° 14 Galvanizado (Antioxidante)', attribute_values: { calibre: 'N° 14 (2.11 mm)', uso: 'Cercos y aplicaciones exteriores', formato: 'Rollo x 50 kg' }, price_override: 7.40, current_stock: 80 }
    );
  }

  for (const v of variants) {
    await prisma.inventoryProductVariant.upsert({
      where: { company_id_sku: { company_id: v.company_id, sku: v.sku } },
      update: v,
      create: v
    });
  }

  const count = await prisma.inventoryProductVariant.count();
  console.log('Total variantes creadas con exito en PostgreSQL:', count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
