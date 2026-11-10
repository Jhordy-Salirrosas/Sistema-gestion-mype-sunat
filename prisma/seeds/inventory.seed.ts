import type { PrismaClient } from '../../src/generated/client/client';

export interface SeedProductDef {
  sku: string;
  description: string;
  brand: string;
  category: string;
  sunatTypeCode: string;
  sunatUnitCode: string;
  hsCode?: string;
  minStockAlert: number;
  initialStock: number;
  unitCostNet: number;
  isImported?: boolean;
}

export const CONSTRUCTION_PRODUCTS: SeedProductDef[] = [
  // ==========================================
  // PRODUCTOS NACIONALES - MARCAS PERUANAS
  // ==========================================
  // Cementos
  {
    sku: 'CEM-SOL-01',
    description: 'Cemento Portland Tipo I Bolsa 42.5 kg',
    brand: 'Sol (UNACEM)',
    category: 'Cementos y Aglomerantes',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '2523290000',
    minStockAlert: 100,
    initialStock: 1500,
    unitCostNet: 28.5,
  },
  {
    sku: 'CEM-AND-01',
    description: 'Cemento Andino Tipo IP Puzolánico Bolsa 42.5 kg',
    brand: 'Andino (UNACEM)',
    category: 'Cementos y Aglomerantes',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '2523290000',
    minStockAlert: 50,
    initialStock: 800,
    unitCostNet: 31.0,
  },
  {
    sku: 'CEM-YUR-01',
    description: 'Cemento Yura Tipo HE Alta Resistencia Bolsa 42.5 kg',
    brand: 'Yura',
    category: 'Cementos y Aglomerantes',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '2523290000',
    minStockAlert: 40,
    initialStock: 500,
    unitCostNet: 29.8,
  },
  {
    sku: 'CEM-001',
    description: 'Cemento Portland tipo I (bolsa 42.5 kg)',
    brand: 'Andino',
    category: 'Cementos',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '2523290000',
    minStockAlert: 20,
    initialStock: 300,
    unitCostNet: 28.0,
  },

  // Aceros y Fierros
  {
    sku: 'ACE-ARQ-12',
    description: 'Fierro Corrugado 1/2" x 9m Grado 60',
    brand: 'Aceros Arequipa',
    category: 'Aceros y Encofrados',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '7214200000',
    minStockAlert: 60,
    initialStock: 650,
    unitCostNet: 42.0,
  },
  {
    sku: 'ACE-ARQ-38',
    description: 'Fierro Corrugado 3/8" x 9m Grado 60',
    brand: 'Aceros Arequipa',
    category: 'Aceros y Encofrados',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '7214200000',
    minStockAlert: 80,
    initialStock: 900,
    unitCostNet: 25.5,
  },
  {
    sku: 'ACE-ARQ-58',
    description: 'Fierro Corrugado 5/8" x 9m Grado 60',
    brand: 'Aceros Arequipa',
    category: 'Aceros y Encofrados',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '7214200000',
    minStockAlert: 40,
    initialStock: 400,
    unitCostNet: 68.0,
  },
  {
    sku: 'ALM-ARQ-16',
    description: 'Alambre Negro Recocido N° 16',
    brand: 'Aceros Arequipa',
    category: 'Alambres y Clavos',
    sunatTypeCode: '01',
    sunatUnitCode: 'KGM',
    hsCode: '7217100000',
    minStockAlert: 30,
    initialStock: 250,
    unitCostNet: 5.8,
  },
  {
    sku: 'SID-PER-12',
    description: 'Barra de Construcción ASTM A615 1/2" x 9m',
    brand: 'SIDERPERU',
    category: 'Aceros y Encofrados',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '7214200000',
    minStockAlert: 50,
    initialStock: 450,
    unitCostNet: 41.5,
  },
  {
    sku: 'CLV-2',
    description: 'Clavo de 2 pulgadas para madera',
    brand: 'Aceros Arequipa',
    category: 'Alambres y Clavos',
    sunatTypeCode: '01',
    sunatUnitCode: 'KGM',
    hsCode: '7317000000',
    minStockAlert: 10,
    initialStock: 180,
    unitCostNet: 6.2,
  },

  // Albañilería y Ladrillos
  {
    sku: 'LAD-LRK-18',
    description: 'Ladrillo King Kong 18 Huecos 9x12.5x23 cm',
    brand: 'Ladrillos Lark',
    category: 'Albañilería y Techos',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '6904100000',
    minStockAlert: 1000,
    initialStock: 12000,
    unitCostNet: 0.95,
  },
  {
    sku: 'LAD-PIR-TE',
    description: 'Ladrillo Hueco para Techo 15x30x30 cm',
    brand: 'Cerámicos Pirámide',
    category: 'Albañilería y Techos',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '6904100000',
    minStockAlert: 500,
    initialStock: 6000,
    unitCostNet: 2.8,
  },
  {
    sku: 'LAD-001',
    description: 'Ladrillo King Kong 18 huecos estándar',
    brand: 'Lark',
    category: 'Albañilería',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '6904100000',
    minStockAlert: 500,
    initialStock: 5000,
    unitCostNet: 0.92,
  },

  // Tuberías y Saneamiento
  {
    sku: 'TUB-PAV-01',
    description: 'Tubo PVC-SAP Presión 1/2" x 3m Clase 10',
    brand: 'Pavco Wavin',
    category: 'Tuberías y Saneamiento',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '3917230000',
    minStockAlert: 40,
    initialStock: 300,
    unitCostNet: 11.2,
  },
  {
    sku: 'TUB-TBP-04',
    description: 'Tubo PVC Desagüe 4" x 3m Clase Pesada',
    brand: 'Tuboplast',
    category: 'Tuberías y Saneamiento',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '3917230000',
    minStockAlert: 20,
    initialStock: 180,
    unitCostNet: 32.5,
  },

  // Acabados, Pinturas y Pegamentos
  {
    sku: 'PEG-CHM-01',
    description: 'Pegamento para Porcelanato Blanco Flexible 25 kg',
    brand: 'Chema',
    category: 'Acabados y Adhesivos',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '3506910000',
    minStockAlert: 30,
    initialStock: 350,
    unitCostNet: 28.0,
  },
  {
    sku: 'PIN-CPP-01',
    description: 'Pintura Látex Pato Blanco Galón',
    brand: 'CPP',
    category: 'Pinturas y Recubrimientos',
    sunatTypeCode: '01',
    sunatUnitCode: 'GLI',
    hsCode: '3209100000',
    minStockAlert: 20,
    initialStock: 120,
    unitCostNet: 46.0,
  },
  {
    sku: 'PIN-ANY-01',
    description: 'Pintura Esmalte Sintético Maestro Galón',
    brand: 'Anypsa',
    category: 'Pinturas y Recubrimientos',
    sunatTypeCode: '01',
    sunatUnitCode: 'GLI',
    hsCode: '3208100000',
    minStockAlert: 15,
    initialStock: 90,
    unitCostNet: 52.0,
  },

  // Agregados
  {
    sku: 'ARE-001',
    description: 'Arena gruesa zarandeada (m3)',
    brand: 'Cantera Lima',
    category: 'Agregados',
    sunatTypeCode: '01',
    sunatUnitCode: 'MTQ',
    hsCode: '2505900000',
    minStockAlert: 10,
    initialStock: 80,
    unitCostNet: 55.0,
  },
  {
    sku: 'PIE-001',
    description: 'Piedra chancada 1/2" (m3)',
    brand: 'Cantera Lima',
    category: 'Agregados',
    sunatTypeCode: '01',
    sunatUnitCode: 'MTQ',
    hsCode: '2517100000',
    minStockAlert: 10,
    initialStock: 60,
    unitCostNet: 65.0,
  },

  // ==========================================
  // PRODUCTOS IMPORTADOS (ACABADOS / INSTALACIONES)
  // ==========================================
  {
    sku: 'POR-IMP-60',
    description: 'Porcelanato Pulido Rectificado 60x60 cm Carrara White (Caja 1.44 m2)',
    brand: 'Foshan Ceramics',
    category: 'Porcelanatos y Revestimientos',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '6907210000',
    minStockAlert: 50,
    initialStock: 450,
    unitCostNet: 54.0,
    isImported: true,
  },
  {
    sku: 'POR-IMP-120',
    description: 'Porcelanato Gran Formato 60x120 cm Marquina Black (Caja 1.44 m2)',
    brand: 'Guangdong Tile Group',
    category: 'Porcelanatos y Revestimientos',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '6907210000',
    minStockAlert: 30,
    initialStock: 280,
    unitCostNet: 88.0,
    isImported: true,
  },
  {
    sku: 'GRI-IMP-01',
    description: 'Grifería Monocomando Acero Inox 304 Cuello Cisne para Lavadero',
    brand: 'Zhejiang Sanitary Tech',
    category: 'Griferías y Sanitarios',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '8481809000',
    minStockAlert: 20,
    initialStock: 160,
    unitCostNet: 115.0,
    isImported: true,
  },
  {
    sku: 'VAL-IMP-02',
    description: 'Válvula de Esfera Paso Total Bronce 1" PN25 Roscada',
    brand: 'Rubinetterie Bresciane',
    category: 'Válvulas y Conexiones',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '8481801000',
    minStockAlert: 25,
    initialStock: 220,
    unitCostNet: 38.5,
    isImported: true,
  },
  {
    sku: 'HER-IMP-01',
    description: 'Rotomartillo SDS Plus 800W Profesional con Maletín y Brocas',
    brand: 'Bavaria Power Tools',
    category: 'Herramientas Eléctricas',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '8467210000',
    minStockAlert: 10,
    initialStock: 45,
    unitCostNet: 320.0,
    isImported: true,
  },
  {
    sku: 'LUM-IMP-01',
    description: 'Panel LED Embutido 60x60 cm 48W 6500K Luz Fría',
    brand: 'Ningbo Opto Lighting',
    category: 'Iluminación y Electricidad',
    sunatTypeCode: '01',
    sunatUnitCode: 'NIU',
    hsCode: '9405109000',
    minStockAlert: 35,
    initialStock: 300,
    unitCostNet: 45.0,
    isImported: true,
  },
];

export async function seedInventory(prisma: PrismaClient) {
  console.log('--- Iniciando Seeding de Inventario y Kardex (Productos de Construcción e Importados) ---');

  const companies = await prisma.company.findMany({
    select: { id: true, ruc: true, legal_name: true },
  });

  if (companies.length === 0) {
    console.warn('No hay empresas registradas en la base de datos. Ejecuta auth.seed primero.');
    return;
  }

  // 0. Asegurar Unidades Oficiales SUNAT (Tabla 6)
  const officialUnits = [
    { code: 'NIU', name: 'UNIDAD (BIENES)', symbol: 'u' },
    { code: 'KGM', name: 'KILOGRAMO', symbol: 'kg' },
    { code: 'LTR', name: 'LITRO', symbol: 'L' },
    { code: 'MTR', name: 'METRO LINEAL', symbol: 'm' },
    { code: 'BX', name: 'CAJA', symbol: 'cja' },
    { code: 'DZN', name: 'DOCENA', symbol: 'doc' },
    { code: 'GRM', name: 'GRAMO', symbol: 'g' },
    { code: 'SET', name: 'JUEGO / CONJUNTO', symbol: 'jgo' },
    { code: 'FDO', name: 'FARDO', symbol: 'fdo' },
    { code: 'BLS', name: 'BOLSA', symbol: 'bls' },
    { code: 'CIL', name: 'CILINDRO', symbol: 'cil' },
    { code: 'BAL', name: 'BALDE', symbol: 'bde' },
    { code: 'BOT', name: 'BOTELLA', symbol: 'bot' },
    { code: 'PK', name: 'PAQUETE', symbol: 'paq' },
    { code: 'ROL', name: 'ROLLO', symbol: 'rol' },
    { code: 'TNE', name: 'TONELADA METRICA', symbol: 't' },
    { code: 'MTK', name: 'METRO CUADRADO', symbol: 'm²' },
    { code: 'MTQ', name: 'METRO CUBICO', symbol: 'm³' },
    { code: 'GLL', name: 'US GALON (3.785 L)', symbol: 'gal' },
    { code: 'ZZ', name: 'SERVICIO / UNIDAD MUTUA', symbol: 'srv' },
  ];
  for (const u of officialUnits) {
    await prisma.sunatUnitMeasurement.upsert({
      where: { code: u.code },
      update: { name: u.name, symbol: u.symbol },
      create: { code: u.code, name: u.name, symbol: u.symbol },
    }).catch(() => {});
  }

  for (const company of companies) {
    console.log(`Poblando catálogo y almacén para empresa ${company.ruc} - ${company.legal_name}...`);

    // 0.1 Asegurar mantenedores de inventario: Marcas, Modelos, Categorías, Fabricantes, Tags
    const defaultBrands = [
      { code: 'SOL', name: 'Sol (UNACEM)', description: 'Cementos y aglomerantes nacionales' },
      { code: 'AND', name: 'Andino (UNACEM)', description: 'Cementos puzolánicos' },
      { code: 'YUR', name: 'Yura', description: 'Cementos de alta resistencia' },
      { code: 'AC-ARE', name: 'Aceros Arequipa', description: 'Barras y perfiles de acero corrugado' },
      { code: 'SID', name: 'Siderperú', description: 'Fierro y barras de construcción' },
      { code: 'PAV', name: 'Pavco Wavin', description: 'Tuberías y conexiones PVC' },
      { code: 'TIG', name: 'Tigre Perú', description: 'Sistemas de tuberías y sanitarios' },
      { code: 'BOS', name: 'Bosch', description: 'Herramientas eléctricas y accesorios' },
      { code: 'MAK', name: 'Makita', description: 'Herramientas y maquinaria ligera' },
      { code: 'DEC', name: 'DecorCeramica', description: 'Porcelanatos y acabados importados' },
      { code: 'GEN', name: 'Genérico / Sin Marca', description: 'Productos estándar sin marca comercial' },
    ];
    for (const b of defaultBrands) {
      await prisma.inventoryBrand.upsert({
        where: { company_id_code: { company_id: company.id, code: b.code } },
        update: { name: b.name, description: b.description },
        create: { company_id: company.id, code: b.code, name: b.name, description: b.description },
      }).catch(() => {});
    }

    const defaultCategories = [
      { code: 'CEM', name: 'Cementos y Aglomerantes', sunat_code: '30111600' },
      { code: 'ACE', name: 'Aceros y Metales', sunat_code: '30102400' },
      { code: 'TUB', name: 'Tuberías y Conexiones', sunat_code: '40171500' },
      { code: 'GRI', name: 'Griferías y Sanitarios', sunat_code: '30181500' },
      { code: 'ACA', name: 'Pisos y Acabados', sunat_code: '30161700' },
      { code: 'HER', name: 'Herramientas Eléctricas y Manuales', sunat_code: '27110000' },
      { code: 'PIN', name: 'Pinturas e Impermeabilizantes', sunat_code: '31211500' },
      { code: 'ILU', name: 'Iluminación y Material Eléctrico', sunat_code: '39111500' },
      { code: 'VAL', name: 'Válvulas y Control de Fluidos', sunat_code: '40141600' },
      { code: 'SEG', name: 'Seguridad Industrial y EPP', sunat_code: '46181500' },
    ];
    for (const c of defaultCategories) {
      await prisma.inventoryCategory.upsert({
        where: { company_id_code: { company_id: company.id, code: c.code } },
        update: { name: c.name, sunat_code: c.sunat_code },
        create: { company_id: company.id, code: c.code, name: c.name, sunat_code: c.sunat_code },
      }).catch(() => {});
    }

    const defaultModels = [
      { code: 'MOD-GSB13', name: 'GSB 13 RE (Taladro Percutor 650W)', brand_name: 'Bosch', description: 'Taladro percutor mandril 1/2"' },
      { code: 'MOD-GWS700', name: 'GWS 700 (Amoladora Angular 710W)', brand_name: 'Bosch', description: 'Esmeril angular disco 4-1/2"' },
      { code: 'MOD-HP1640', name: 'HP1640 (Taladro de Impacto 680W)', brand_name: 'Makita', description: 'Taladro de percusión para concreto y metal' },
      { code: 'MOD-GA4530', name: 'GA4530 (Esmeril Angular 720W)', brand_name: 'Makita', description: 'Amoladora cuerpo delgado' },
      { code: 'MOD-GR60', name: 'Grado 60 (Barra Corrugada ASTM A615)', brand_name: 'Aceros Arequipa', description: 'Acero de refuerzo estructural antisísmico' },
      { code: 'MOD-ALM16', name: 'Alambre N° 16 (Recocido)', brand_name: 'Aceros Arequipa', description: 'Alambre negro para amarre de estribos' },
      { code: 'MOD-SID60', name: 'Sider 60 (Fierro Habilitado)', brand_name: 'Siderperú', description: 'Fierro de construcción normalizado' },
      { code: 'MOD-DES4', name: 'Desagüe Serie Blanca 4" x 3m', brand_name: 'Pavco Wavin', description: 'Tubería sanitaria PVC con unión flexible' },
      { code: 'MOD-AGU12', name: 'Agua Fría Clase 10 1/2" x 5m', brand_name: 'Pavco Wavin', description: 'Tubería de presión roscable para agua potable' },
      { code: 'MOD-SAN4', name: 'PVC Sanitario Clase A 4"', brand_name: 'Tigre Perú', description: 'Tubería y conexiones para evacuación' },
      { code: 'MOD-POR60', name: 'Porcelanato 60x60 Pulido Rectificado', brand_name: 'DecorCeramica', description: 'Acabado vitrificado de alta resistencia' },
      { code: 'MOD-T1-425', name: 'Portland Tipo I Bolsa 42.5 kg', brand_name: 'Sol (UNACEM)', description: 'Cemento para obras generales y estructuras' },
    ];
    for (const m of defaultModels) {
      await prisma.inventoryModel.upsert({
        where: { company_id_code: { company_id: company.id, code: m.code } },
        update: { name: m.name, brand_name: m.brand_name, description: m.description },
        create: { company_id: company.id, code: m.code, name: m.name, brand_name: m.brand_name, description: m.description },
      }).catch(() => {});
    }

    const defaultManufacturers = [
      { name: 'UNACEM S.A.A.', country_code: 'PE', website: 'https://www.unacem.com.pe', contact_info: 'RUC 20100132592 - ventas@unacem.com.pe' },
      { name: 'Yura S.A.', country_code: 'PE', website: 'https://www.yura.com.pe', contact_info: 'RUC 20100180139 - atencion@yura.com.pe' },
      { name: 'Corporación Aceros Arequipa S.A.', country_code: 'PE', website: 'https://www.acerosarequipa.com', contact_info: 'RUC 20100067644 - ventas@acerosarequipa.com' },
      { name: 'Empresa Siderúrgica del Perú S.A.A. (Siderperú)', country_code: 'PE', website: 'https://www.siderperu.com.pe', contact_info: 'RUC 20100055204' },
      { name: 'Mexichem Perú S.A. (Pavco Wavin)', country_code: 'PE', website: 'https://wavin.com/pe', contact_info: 'RUC 20100152941' },
      { name: 'Tigre Perú Tubos y Conexiones S.A.', country_code: 'PE', website: 'https://www.tigre.pe', contact_info: 'RUC 20519129531' },
      { name: 'Robert Bosch Perú S.A.', country_code: 'DE', website: 'https://www.bosch-pt.com.pe', contact_info: 'RUC 20100155029 - Herramientas eléctricas' },
      { name: 'Makita Perú S.A.', country_code: 'JP', website: 'https://www.makita.pe', contact_info: 'RUC 20512803610 - Herramientas industriales' },
      { name: 'Foshan Nanhai Ceramics Co., Ltd.', country_code: 'CN', website: 'https://www.foshanceramics.com', contact_info: 'Guangdong, China - Proveedor de Porcelanatos' },
      { name: 'C&A Industrial Steel Co., Ltd.', country_code: 'CN', website: 'https://www.casteel.com', contact_info: 'Hebei, China - Aceros y perfiles' },
    ];
    for (const mf of defaultManufacturers) {
      await prisma.inventoryManufacturer.upsert({
        where: { company_id_name: { company_id: company.id, name: mf.name } },
        update: { country_code: mf.country_code, website: mf.website, contact_info: mf.contact_info },
        create: { company_id: company.id, name: mf.name, country_code: mf.country_code, website: mf.website, contact_info: mf.contact_info },
      }).catch(() => {});
    }

    const defaultTags = [
      { name: 'alta-rotacion', color: 'emerald' },
      { name: 'rotacion-media', color: 'blue' },
      { name: 'baja-rotacion', color: 'amber' },
      { name: 'producto-importado', color: 'purple' },
      { name: 'compra-nacional', color: 'emerald' },
      { name: 'material-pesado', color: 'amber' },
      { name: 'obra-civil', color: 'blue' },
      { name: 'acabado-fino', color: 'purple' },
    ];
    for (const t of defaultTags) {
      await prisma.inventoryTag.upsert({
        where: { company_id_name: { company_id: company.id, name: t.name } },
        update: { color: t.color },
        create: { company_id: company.id, name: t.name, color: t.color },
      }).catch(() => {});
    }

    // 1. Asegurar almacén principal
    const warehouse = await prisma.inventoryWarehouse.upsert({
      where: {
        company_id_warehouse_code: {
          company_id: company.id,
          warehouse_code: 'ALM-01',
        },
      },
      update: {
        description: 'Almacén Principal Central',
        address: 'Av. Materiales 1240, Lima',
        is_active: true,
      },
      create: {
        company_id: company.id,
        warehouse_code: 'ALM-01',
        description: 'Almacén Principal Central',
        address: 'Av. Materiales 1240, Lima',
        is_active: true,
      },
    });

    let productosCreados = 0;
    let saldosActualizados = 0;

    for (const prod of CONSTRUCTION_PRODUCTS) {
      // 2. Upsert del producto
      const product = await prisma.inventoryProduct.upsert({
        where: {
          company_id_sku: {
            company_id: company.id,
            sku: prod.sku,
          },
        },
        update: {
          description: prod.description,
          brand: prod.brand,
          category: prod.category,
          sunat_type_code: prod.sunatTypeCode,
          sunat_unit_code: prod.sunatUnitCode,
          hs_code: prod.hsCode ?? null,
          min_stock_alert: prod.minStockAlert,
          is_inventory: true,
          is_active: true,
          tax_affectation: '10',
        },
        create: {
          company_id: company.id,
          sku: prod.sku,
          description: prod.description,
          brand: prod.brand,
          category: prod.category,
          sunat_type_code: prod.sunatTypeCode,
          sunat_unit_code: prod.sunatUnitCode,
          hs_code: prod.hsCode ?? null,
          min_stock_alert: prod.minStockAlert,
          is_inventory: true,
          is_active: true,
          tax_affectation: '10',
        },
      });
      productosCreados++;

      // 3. Saldo en almacén e historial inicial de Kardex
      const totalValue = Math.round(prod.initialStock * prod.unitCostNet * 100) / 100;
      const initialDate = new Date('2026-01-01T08:00:00Z');

      await prisma.inventoryBalance.upsert({
        where: {
          company_id_warehouse_id_product_id: {
            company_id: company.id,
            warehouse_id: warehouse.id,
            product_id: product.id,
          },
        },
        update: {
          current_stock: prod.initialStock,
          average_unit_cost: prod.unitCostNet,
          total_inventory_value: totalValue,
          last_movement_at: initialDate,
        },
        create: {
          company_id: company.id,
          warehouse_id: warehouse.id,
          product_id: product.id,
          current_stock: prod.initialStock,
          average_unit_cost: prod.unitCostNet,
          total_inventory_value: totalValue,
          last_movement_at: initialDate,
        },
      });
      saldosActualizados++;

      // 4. Movimiento Kardex de Saldo Inicial (Operación 16 SUNAT Tabla 12)
      const existingMovement = await prisma.inventoryMovement.findFirst({
        where: {
          company_id: company.id,
          warehouse_id: warehouse.id,
          product_id: product.id,
          operation_type_code: '16',
        },
      });

      if (!existingMovement) {
        await prisma.inventoryMovement.create({
          data: {
            company_id: company.id,
            warehouse_id: warehouse.id,
            product_id: product.id,
            movement_number: `INI-${prod.sku}`,
            movement_date: initialDate,
            accounting_date: initialDate,
            operation_type_code: '16', // Saldo Inicial
            document_type_code: '00',
            document_serial: 'INIC',
            document_number: '00000001',
            direction: 'ENTRADA',
            quantity: prod.initialStock,
            unit_cost: prod.unitCostNet,
            total_cost: totalValue,
            previous_stock: 0,
            previous_unit_cost: 0,
            previous_total_value: 0,
            resulting_stock: prod.initialStock,
            resulting_unit_cost: prod.unitCostNet,
            resulting_total_value: totalValue,
            source_reference_id: `INICIAL-${prod.sku}`,
            source_module: 'INVENTORY_OPENING',
            notes: `Inventario inicial de apertura - ${prod.brand} ${prod.description}`,
          },
        });
      }
    }

    console.log(`✓ Empresa ${company.ruc}: ${productosCreados} productos asegurados y ${saldosActualizados} saldos en Kardex.`);
  }

  console.log('--- Seeding de Inventario y Kardex completado con éxito. ---');
}

if (process.argv[1]?.includes('inventory.seed')) {
  // Ejecución directa vía CLI
  import('dotenv/config').then(async () => {
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const { PrismaClient } = await import('../../src/generated/client/client');
    const connectionString = process.env.DATABASE_URL;
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    try {
      await prisma.$connect();
      await seedInventory(prisma);
    } catch (e) {
      console.error(e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });
}

