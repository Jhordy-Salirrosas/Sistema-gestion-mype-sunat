/**
 * Seed de la Fase 1: maestros, saneamiento de inventario y datos demo.
 *
 * Es idempotente en lo posible: usa upsert/findFirst para no duplicar.
 * No elimina usuarios ni empresas.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/client/client';

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEMO_RUC = '20601234567';

const currencies = [
  { code: 'PEN', name: 'Sol peruano', symbol: 'S/', decimals: 2, is_active: true },
  { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', decimals: 2, is_active: true },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, is_active: true },
  { code: 'CNY', name: 'Yuan chino', symbol: '¥', decimals: 2, is_active: true },
];

const incoterms = [
  ['EXW', 'Ex Works', true],
  ['FCA', 'Free Carrier', true],
  ['FAS', 'Free Alongside Ship', true],
  ['FOB', 'Free On Board', true],
  ['CFR', 'Cost and Freight', true],
  ['CIF', 'Cost, Insurance and Freight', true],
  ['CPT', 'Carriage Paid To', true],
  ['CIP', 'Carriage and Insurance Paid To', true],
  ['DAP', 'Delivered At Place', true],
  ['DPU', 'Delivered At Place Unloaded', true],
  ['DDP', 'Delivered Duty Paid', true],
] as const;

const documentTypes = [
  ['OC', 'Orden de compra', 'SOLICITUD', true],
  ['PROFORMA', 'Factura proforma', 'SOLICITUD', true],
  ['FAC_COMERCIAL', 'Factura comercial', 'EMBARQUE', true],
  ['PACKING_LIST', 'Packing list', 'EMBARQUE', true],
  ['BL', 'Bill of Lading', 'EMBARQUE', true],
  ['AWB', 'Air Waybill', 'EMBARQUE', true],
  ['SEGURO', 'Póliza de seguro de transporte', 'EMBARQUE', true],
  ['CERT_ORIGEN', 'Certificado de origen', 'ADUANA', false],
  ['VUCE', 'Documento resolutivo VUCE', 'ADUANA', false],
  ['DAM', 'Declaración Aduanera de Mercancías', 'ADUANA', true],
  ['LIQUIDACION', 'Liquidación de tributos', 'ADUANA', true],
  ['VOUCHER', 'Voucher de pago de tributos', 'ADUANA', true],
  ['ACTA_RECEPCION', 'Acta de recepción en almacén', 'RECEPCION', true],
] as const;

const partners = [
  {
    doc_type: '6',
    doc_number: '20100000001',
    legal_name: 'Cementos Andinos S.A.C.',
    trade_name: 'Cementos Andinos',
    country_code: 'PE',
    roles: ['PROVEEDOR'],
    payment_terms: '30_DIAS',
    currency_code: 'PEN',
    email: 'ventas@cementosandinos.pe',
  },
  {
    doc_type: '6',
    doc_number: '20100000002',
    legal_name: 'Aceros del Perú S.A.',
    trade_name: 'Aceros Perú',
    country_code: 'PE',
    roles: ['PROVEEDOR'],
    payment_terms: '30_DIAS',
    currency_code: 'PEN',
    email: 'ventas@acerosperu.pe',
  },
  {
    doc_type: '6',
    doc_number: '20100000003',
    legal_name: 'Agregados Lima S.A.C.',
    trade_name: 'Agregados Lima',
    country_code: 'PE',
    roles: ['PROVEEDOR'],
    payment_terms: 'CONTADO',
    currency_code: 'PEN',
  },
  {
    doc_type: '6',
    doc_number: '20100000004',
    legal_name: 'Transportes Callao S.A.C.',
    trade_name: 'Transportes Callao',
    country_code: 'PE',
    roles: ['PROVEEDOR', 'TRANSPORTISTA'],
    payment_terms: 'CONTADO',
    currency_code: 'PEN',
  },
  {
    doc_type: '6',
    doc_number: '20100000005',
    legal_name: 'Agencia de Aduanas Pacífico S.A.C.',
    trade_name: 'Agencia Pacífico',
    country_code: 'PE',
    roles: ['PROVEEDOR', 'AGENTE'],
    payment_terms: '15_DIAS',
    currency_code: 'PEN',
  },
  {
    doc_type: '6',
    doc_number: 'CN91440300MA5XYZ12',
    legal_name: 'Shenzhen Construction Supplies Ltd.',
    trade_name: 'Shenzhen Supplies',
    country_code: 'CN',
    roles: ['PROVEEDOR', 'IMPORTADOR'],
    payment_terms: '30_DIAS',
    currency_code: 'USD',
    email: 'sales@shenzhen-supplies.cn',
    address: 'Bao’an District, Shenzhen, China',
  },
  {
    doc_type: '6',
    doc_number: '20500000001',
    legal_name: 'Constructora Los Andes S.A.C.',
    trade_name: 'Constructora Los Andes',
    country_code: 'PE',
    roles: ['CLIENTE'],
    payment_terms: '30_DIAS',
    currency_code: 'PEN',
    email: 'compras@losandes.pe',
  },
  {
    doc_type: '1',
    doc_number: '12345678',
    legal_name: 'José Pérez',
    trade_name: 'Maestro de obra',
    country_code: 'PE',
    roles: ['CLIENTE'],
    payment_terms: 'CONTADO',
    currency_code: 'PEN',
  },
  {
    doc_type: '6',
    doc_number: '20500000002',
    legal_name: 'Inmobiliaria Miraflores S.A.C.',
    trade_name: 'Inmobiliaria Miraflores',
    country_code: 'PE',
    roles: ['CLIENTE'],
    payment_terms: '45_DIAS',
    currency_code: 'PEN',
  },
];

const products = [
  {
    sku: 'CEM-001',
    description: 'Cemento Portland tipo I (bolsa 42.5 kg)',
    sunat_type_code: '01',
    sunat_unit_code: 'NIU',
    min_stock_alert: 20,
    is_inventory: true,
    hs_code: '2523290000',
    category: 'Cementos',
    brand: 'Andino',
    tax_affectation: '10',
  },
  {
    sku: 'CLV-2',
    description: 'Clavo de 2 pulgadas',
    sunat_type_code: '01',
    sunat_unit_code: 'KGM',
    min_stock_alert: 5,
    is_inventory: true,
    hs_code: '7317000000',
    category: 'Fijaciones',
    tax_affectation: '10',
  },
  {
    sku: 'LAD-001',
    description: 'Ladrillo King Kong 18 huecos',
    sunat_type_code: '01',
    sunat_unit_code: 'NIU',
    min_stock_alert: 500,
    is_inventory: true,
    hs_code: '6904100000',
    category: 'Albañilería',
    tax_affectation: '10',
  },
  {
    sku: 'FIE-001',
    description: 'Fierro corrugado 1/2" x 9 m',
    sunat_type_code: '01',
    sunat_unit_code: 'NIU',
    min_stock_alert: 50,
    is_inventory: true,
    hs_code: '7214200000',
    category: 'Aceros',
    brand: 'Aceros Perú',
    tax_affectation: '10',
  },
  {
    sku: 'ARE-001',
    description: 'Arena gruesa (m3)',
    sunat_type_code: '01',
    sunat_unit_code: 'MTQ',
    min_stock_alert: 10,
    is_inventory: true,
    hs_code: '2505900000',
    category: 'Agregados',
    tax_affectation: '10',
  },
  {
    sku: 'CEM-002',
    description: 'Cemento Portland tipo V (bolsa 42.5 kg)',
    sunat_type_code: '01', sunat_unit_code: 'NIU', min_stock_alert: 20, is_inventory: true,
    hs_code: '2523290000', category: 'Cementos', brand: 'Pacasmayo', tax_affectation: '10',
  },
  {
    sku: 'CEM-003',
    description: 'Cemento blanco (bolsa 25 kg)',
    sunat_type_code: '01', sunat_unit_code: 'NIU', min_stock_alert: 10, is_inventory: true,
    hs_code: '2523210000', category: 'Cementos', brand: 'Yura', tax_affectation: '10',
  },
  {
    sku: 'FIE-002',
    description: 'Fierro corrugado 3/8" x 9 m',
    sunat_type_code: '01', sunat_unit_code: 'NIU', min_stock_alert: 40, is_inventory: true,
    hs_code: '7214200000', category: 'Aceros', brand: 'Aceros Arequipa', tax_affectation: '10',
  },
  {
    sku: 'FIE-003',
    description: 'Fierro corrugado 1/4" x 9 m',
    sunat_type_code: '01', sunat_unit_code: 'NIU', min_stock_alert: 40, is_inventory: true,
    hs_code: '7214200000', category: 'Aceros', brand: 'Siderperú', tax_affectation: '10',
  },
  {
    sku: 'LAD-002',
    description: 'Ladrillo pandereta 18 huecos',
    sunat_type_code: '01', sunat_unit_code: 'NIU', min_stock_alert: 300, is_inventory: true,
    hs_code: '6904100000', category: 'Albañilería', brand: 'Ladrillos Pirámide', tax_affectation: '10',
  },
  {
    sku: 'TUB-001',
    description: 'Tubo PVC desagüe 4" x 3 m',
    sunat_type_code: '01', sunat_unit_code: 'NIU', min_stock_alert: 20, is_inventory: true,
    hs_code: '3917230000', category: 'Sanitarias', brand: 'Pavco', tax_affectation: '10',
  },
  {
    sku: 'TUB-002',
    description: 'Tubo PVC agua 1/2" x 5 m',
    sunat_type_code: '01', sunat_unit_code: 'NIU', min_stock_alert: 30, is_inventory: true,
    hs_code: '3917230000', category: 'Sanitarias', brand: 'Plástica Andina', tax_affectation: '10',
  },
  {
    sku: 'ELE-001',
    description: 'Cable eléctrico THW 12 AWG (rollo 100 m)',
    sunat_type_code: '01', sunat_unit_code: 'NIU', min_stock_alert: 5, is_inventory: true,
    hs_code: '8544491000', category: 'Eléctricas', brand: 'Indeco', tax_affectation: '10',
  },
  {
    sku: 'PIN-001',
    description: 'Pintura látex lavable blanca (galón)',
    sunat_type_code: '01', sunat_unit_code: 'NIU', min_stock_alert: 10, is_inventory: true,
    hs_code: '3209100000', category: 'Pinturas', brand: 'Anypsa', tax_affectation: '10',
  },
  {
    sku: 'YES-001',
    description: 'Yeso cerámico (bolsa 25 kg)',
    sunat_type_code: '01', sunat_unit_code: 'NIU', min_stock_alert: 15, is_inventory: true,
    hs_code: '2520200000', category: 'Acabados', brand: 'Yesera Perú', tax_affectation: '10',
  },
  {
    sku: 'MAY-001',
    description: 'Mayólica blanca 45 x 45 cm (m2)',
    sunat_type_code: '01', sunat_unit_code: 'MTQ', min_stock_alert: 20, is_inventory: true,
    hs_code: '6907220000', category: 'Acabados', brand: 'Celima', tax_affectation: '10',
  },
  {
    sku: 'PEG-001',
    description: 'Pegamento para mayólica (bolsa 25 kg)',
    sunat_type_code: '01', sunat_unit_code: 'NIU', min_stock_alert: 10, is_inventory: true,
    hs_code: '3824500000', category: 'Acabados', brand: 'Chema', tax_affectation: '10',
  },
  {
    sku: 'ALM-001',
    description: 'Alambre negro recocido N° 16 (kg)',
    sunat_type_code: '01', sunat_unit_code: 'KGM', min_stock_alert: 20, is_inventory: true,
    hs_code: '7217100000', category: 'Fijaciones', brand: 'Aceros Arequipa', tax_affectation: '10',
  },
  {
    sku: 'PIE-001',
    description: 'Piedra chancada 1/2" (m3)',
    sunat_type_code: '01',
    sunat_unit_code: 'MTQ',
    min_stock_alert: 10,
    is_inventory: true,
    hs_code: '2517100000',
    category: 'Agregados',
    tax_affectation: '10',
  },
  {
    sku: 'SRV-FLE',
    description: 'Servicio de flete local',
    sunat_type_code: '02',
    sunat_unit_code: 'NIU',
    min_stock_alert: 0,
    is_inventory: false,
    category: 'Servicios',
    tax_affectation: '10',
  },
];

async function upsertCurrency(data: (typeof currencies)[number]) {
  return prisma.currency.upsert({ where: { code: data.code }, update: data, create: data });
}

async function upsertIncoterm(code: string, name: string, named: boolean) {
  return prisma.incoterm.upsert({
    where: { code },
    update: { name, named_place_required: named, is_active: true },
    create: { code, name, named_place_required: named, is_active: true },
  });
}

async function upsertDocumentType(code: string, name: string, stage: string, required: boolean) {
  return prisma.documentType.upsert({
    where: { code },
    update: { name, stage, is_required: required, is_active: true },
    create: { code, name, stage, is_required: required, is_active: true },
  });
}

async function main() {
  console.log('--- Seed Fase 1: maestros y saneamiento ---');

  await prisma.$connect();

  const company = await prisma.company.findFirst({ where: { ruc: DEMO_RUC } });
  if (!company) throw new Error(`No existe la empresa demo con RUC ${DEMO_RUC}`);

  for (const c of currencies) await upsertCurrency(c);
  console.log(`✓ Monedas: ${currencies.length}`);

  for (const [code, name, named] of incoterms) await upsertIncoterm(code, name, named);
  console.log(`✓ Incoterms: ${incoterms.length}`);

  for (const [code, name, stage, required] of documentTypes) {
    await upsertDocumentType(code, name, stage, required);
  }
  console.log(`✓ Tipos de documento: ${documentTypes.length}`);

  // Tipo de cambio de referencia para la demo.
  const rateDate = new Date('2026-11-05T00:00:00.000Z');
  await prisma.exchangeRate.upsert({
    where: {
      base_currency_quote_currency_date: {
        base_currency: 'USD',
        quote_currency: 'PEN',
        date: rateDate,
      },
    },
    update: { rate: 3.75, source: 'MANUAL' },
    create: {
      base_currency: 'USD',
      quote_currency: 'PEN',
      rate: 3.75,
      date: rateDate,
      source: 'MANUAL',
    },
  });
  console.log('✓ Tipo de cambio USD/PEN');

  // Terceros
  for (const p of partners) {
    const existing = await prisma.businessPartner.findFirst({
      where: { company_id: company.id, doc_type: p.doc_type, doc_number: p.doc_number },
    });

    const data = {
      company_id: company.id,
      doc_type: p.doc_type,
      doc_number: p.doc_number,
      legal_name: p.legal_name,
      trade_name: p.trade_name ?? null,
      country_code: p.country_code,
      address: p.address ?? null,
      email: p.email ?? null,
      phone: (p as any).phone ?? null,
      website: (p as any).website ?? null,
      roles: p.roles,
      payment_terms: p.payment_terms ?? null,
      currency_code: p.currency_code ?? 'PEN',
      is_active: true,
    };

    if (existing) {
      await prisma.businessPartner.update({ where: { id: existing.id }, data });
    } else {
      await prisma.businessPartner.create({ data });
    }
  }
  console.log(`✓ Terceros: ${partners.length}`);

  // Cuenta bancaria del proveedor de importación.
  const importSupplier = await prisma.businessPartner.findFirst({
    where: { company_id: company.id, doc_number: 'CN91440300MA5XYZ12' },
  });
  if (importSupplier) {
    const existingBank = await prisma.partnerBankAccount.findFirst({
      where: { partner_id: importSupplier.id, account_number: 'CN-6222-0000-1111' },
    });
    if (!existingBank) {
      await prisma.partnerBankAccount.create({
        data: {
          partner_id: importSupplier.id,
          bank_name: 'Bank of China',
          bank_country: 'CN',
          account_number: 'CN-6222-0000-1111',
          swift: 'BKCHCNBJ',
          beneficiary: importSupplier.legal_name,
          currency_code: 'USD',
          is_default: true,
        },
      });
    }
  }

  // Productos
  for (const p of products) {
    await prisma.inventoryProduct.upsert({
      where: { company_id_sku: { company_id: company.id, sku: p.sku } },
      update: {
        description: p.description,
        sunat_type_code: p.sunat_type_code,
        sunat_unit_code: p.sunat_unit_code,
        min_stock_alert: p.min_stock_alert,
        is_inventory: p.is_inventory,
        hs_code: p.hs_code ?? null,
        category: p.category ?? null,
        brand: p.brand ?? null,
        tax_affectation: p.tax_affectation ?? null,
        is_active: true,
      },
      create: {
        company_id: company.id,
        sku: p.sku,
        description: p.description,
        sunat_type_code: p.sunat_type_code,
        sunat_unit_code: p.sunat_unit_code,
        min_stock_alert: p.min_stock_alert,
        is_inventory: p.is_inventory,
        hs_code: p.hs_code ?? null,
        category: p.category ?? null,
        brand: p.brand ?? null,
        tax_affectation: p.tax_affectation ?? null,
        is_active: true,
      },
    });
  }
  console.log(`✓ Productos: ${products.length}`);

  // Saneamiento: servicio sin stock y sin balance útil.
  const service = await prisma.inventoryProduct.findFirst({
    where: { company_id: company.id, sku: 'SRV-FLE' },
  });
  if (service) {
    await prisma.inventoryBalance.updateMany({
      where: { company_id: company.id, product_id: service.id },
      data: { current_stock: 0, average_unit_cost: 0, total_inventory_value: 0 },
    });
    await prisma.inventoryMovement.updateMany({
      where: { company_id: company.id, product_id: service.id, archived_at: null },
      data: { is_test: true, archived_at: new Date(), source_module: 'TEST' },
    });
  }

  // Archivar los movimientos de prueba anteriores al 03/11/2026.
  await prisma.inventoryMovement.updateMany({
    where: {
      company_id: company.id,
      archived_at: null,
      is_test: false,
      created_at: { lt: new Date('2026-11-03T00:00:00.000Z') },
    },
    data: { is_test: true, archived_at: new Date(), source_module: 'TEST' },
  });
  console.log('✓ Movimientos de prueba archivados');

  // Saldo inicial limpio para los productos que conservan stock.
  const warehouse = await prisma.inventoryWarehouse.findFirst({
    where: { company_id: company.id, warehouse_code: 'ALM-01' },
  });
  if (!warehouse) throw new Error('No existe el almacén ALM-01');

  // Almacén de obra para demostrar transferencias entre almacenes.
  await prisma.inventoryWarehouse.upsert({
    where: {
      company_id_warehouse_code: {
        company_id: company.id,
        warehouse_code: 'ALM-02',
      },
    },
    update: { description: 'Almacén de obra (demo)', is_active: true },
    create: {
      company_id: company.id,
      warehouse_code: 'ALM-02',
      sunat_establishment_code: '0000',
      description: 'Almacén de obra (demo)',
      address: 'Obra Miraflores',
      is_active: true,
    },
  });
  console.log('✓ Almacén ALM-02 para transferencias');

  for (const sku of ['CEM-001', 'CLV-2']) {
    const product = await prisma.inventoryProduct.findFirst({
      where: { company_id: company.id, sku },
    });
    if (!product) continue;

    const existingOpening = await prisma.inventoryMovement.findFirst({
      where: {
        company_id: company.id,
        product_id: product.id,
        source_reference_id: `OPENING-${sku}`,
        operation_type_code: '16',
      },
    });
    if (existingOpening) continue;

    const balance = await prisma.inventoryBalance.findFirst({
      where: { company_id: company.id, product_id: product.id, warehouse_id: warehouse.id },
    });
    const quantity = Number(balance?.current_stock ?? 0);
    const unitCost = Number(balance?.average_unit_cost ?? 0);
    if (quantity <= 0) continue;

    await prisma.inventoryMovement.create({
      data: {
        company_id: company.id,
        warehouse_id: warehouse.id,
        product_id: product.id,
        movement_number: `OPEN-${sku}`,
        movement_date: new Date('2026-11-01T00:00:00.000Z'),
        accounting_date: new Date('2026-11-01T00:00:00.000Z'),
        operation_type_code: '16',
        document_type_code: '00',
        document_serial: 'SI',
        document_number: '2026',
        direction: 'ENTRADA',
        quantity,
        unit_cost: unitCost,
        total_cost: Number((quantity * unitCost).toFixed(2)),
        previous_stock: 0,
        previous_unit_cost: 0,
        previous_total_value: 0,
        resulting_stock: quantity,
        resulting_unit_cost: unitCost,
        resulting_total_value: Number((quantity * unitCost).toFixed(2)),
        source_reference_id: `OPENING-${sku}`,
        source_module: 'MIGRATION',
        notes: `Saldo inicial Fase 1 para ${sku}`,
      },
    });
    console.log(`✓ Saldo inicial ${sku}: ${quantity} x ${unitCost}`);
  }

  console.log('--- Seed Fase 1 completado ---');
}

main()
  .catch((error) => {
    console.error('Error en seed Fase 1:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
