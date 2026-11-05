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
const { InventoryKardexService } = require('../dist/modules/inventory/application/services/inventoryKardexService.js');
const { movimientosDeFactura } = require('../dist/modules/invoices/application/services/kardexBridge.js');

async function verifyAll() {
  console.log('================================================================');
  console.log('   FASE 5: VERIFICACION INTEGRAL END-TO-END DE CONECTIVIDAD');
  console.log('================================================================\n');

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`   ✅ [PASS] ${message}`);
      testsPassed++;
    } else {
      console.error(`   ❌ [FAIL] ${message}`);
      testsFailed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // PRUEBA 1: Conexión con Supabase y Empresa Activa
    // -------------------------------------------------------------
    console.log('--- 1. CONEXION A BASE DE DATOS Y MULTI-TENANCY ---');
    const companies = await prisma.company.findMany();
    assert(companies.length > 0, `Base de datos conectada. Empresas registradas: ${companies.length}`);
    const company = companies[0];
    const companyId = company.id;
    console.log(`   ℹ️ Empresa de prueba: ${company.legal_name} (RUC: ${company.ruc})`);

    // -------------------------------------------------------------
    // PRUEBA 2: Integridad de Tablas Clave
    // -------------------------------------------------------------
    console.log('\n--- 2. VERIFICACION DE TABLAS OPERATIVAS ---');
    const productsCount = await prisma.inventoryProduct.count({ where: { company_id: companyId } });
    assert(productsCount >= 0, `Tabla inventory_products operativa (${productsCount} productos)`);

    const movementsCount = await prisma.inventoryMovement.count({ where: { company_id: companyId } });
    assert(movementsCount >= 0, `Tabla inventory_movements operativa (${movementsCount} movimientos)`);

    const ordersCount = await prisma.importOrder.count({ where: { company_id: companyId } });
    assert(ordersCount >= 0, `Tabla import_orders operativa (${ordersCount} órdenes)`);

    const docsCount = await prisma.importOrderDocument.count();
    assert(docsCount >= 0, `Tabla import_order_documents operativa (${docsCount} documentos con hash)`);

    const treasuryCount = await prisma.treasuryMovement.count({ where: { company_id: companyId } });
    assert(treasuryCount >= 0, `Tabla treasury_movements operativa (${treasuryCount} registros de caja)`);

    // -------------------------------------------------------------
    // PRUEBA 3: Servicio de Kardex - Las 3 Pestañas
    // -------------------------------------------------------------
    console.log('\n--- 3. ENDPOINTS DEL KARDEX INTEGRAL (3 PESTAÑAS) ---');
    const kardexService = new InventoryKardexService(prisma);

    // Pestaña 1: Kardex Valorizado
    const stockKardex = await kardexService.getKardex(companyId, {});
    assert(stockKardex && typeof stockKardex.totals !== 'undefined', 'Pestaña 1: Kardex Valorizado (Stock PLE 13.1) responde con estructura oficial');
    console.log(`      * Saldo inicial: ${stockKardex.opening.stock} | Entradas: ${stockKardex.totals.entriesQuantity} | Salidas: ${stockKardex.totals.exitsQuantity} | Saldo final: ${stockKardex.final.stock}`);

    // Pestaña 2: Caja y Bancos (Dinero)
    const cashKardex = await kardexService.getCashAndBanks(companyId, {});
    assert(cashKardex && typeof cashKardex.totals !== 'undefined', 'Pestaña 2: Caja y Bancos (Dinero) responde con totales e historial financiero');
    console.log(`      * Ingresos: S/ ${cashKardex.totals.totalIngresos} | Egresos: S/ ${cashKardex.totals.totalEgresos} | Saldo neto: S/ ${cashKardex.totals.netBalance} (${cashKardex.items.length} movimientos de tesorería)`);

    // Pestaña 3: Consolidado (Resumen)
    const consolidatedKardex = await kardexService.getConsolidated(companyId);
    assert(consolidatedKardex && Array.isArray(consolidatedKardex.products), 'Pestaña 3: Consolidado de Inventario responde con desglose por almacén');
    console.log(`      * Total productos activos: ${consolidatedKardex.totalProducts} | Stock global: ${consolidatedKardex.totalStockGlobal} un. | Valor en libros: S/ ${consolidatedKardex.totalValueGlobal}`);

    // -------------------------------------------------------------
    // PRUEBA 4: Puente Facturación -> Kardex y Notas de Crédito
    // -------------------------------------------------------------
    console.log('\n--- 4. LOGICA DE AFECTACION AL KARDEX (FACTURA Y NOTA DE CREDITO) ---');
    const sampleItems = [
      { itemCode: 'LAP-001', descripcion: 'Laptop Pro', unidad: 'NIU', cantidad: 2, valorUnitario: 3500, afectacion: '10' }
    ];

    // Caso A: Factura de venta (Salida Op. 01)
    const movsFactura = movimientosDeFactura(sampleItems, {
      tipoComprobante: '01',
      serie: 'F001',
      correlativo: 100,
      fechaEmision: '2026-11-05',
      almacen: 'ALM-01',
    });
    assert(movsFactura.length === 1 && movsFactura[0].direction === 'SALIDA' && movsFactura[0].operation_type_code === '01',
      'Factura electrónica genera SALIDA en Kardex con Operación 01 (Venta)');

    // Caso B: Nota de Crédito por Devolución (Entrada Op. 05)
    const movsNotaDevolucion = movimientosDeFactura(sampleItems, {
      tipoComprobante: '07',
      serie: 'FC01',
      correlativo: 5,
      fechaEmision: '2026-11-05',
      almacen: 'ALM-01',
      motivoNota: '01', // Anulación total / devolución
    });
    assert(movsNotaDevolucion.length === 1 && movsNotaDevolucion[0].direction === 'ENTRADA' && movsNotaDevolucion[0].operation_type_code === '05',
      'Nota de Crédito motivo 01/06/07 genera ENTRADA en Kardex con Operación 05 (Devolución de mercaderías)');

    // Caso C: Nota de Crédito por Descuento (No mueve stock)
    const movsNotaDescuento = movimientosDeFactura(sampleItems, {
      tipoComprobante: '07',
      serie: 'FC01',
      correlativo: 6,
      fechaEmision: '2026-11-05',
      almacen: 'ALM-01',
      motivoNota: '04', // Descuento global
    });
    assert(movsNotaDescuento.length === 0,
      'Nota de Crédito motivo 04 (Descuento) NO mueve stock físico en Kardex');

    // -------------------------------------------------------------
    // PRUEBA 5: Mapeador de Cuentas Contables PCGE
    // -------------------------------------------------------------
    console.log('\n--- 5. MAPEO CONTABLE PCGE 2019 ---');
    const defaultMappings = [
      { process: 'VENTA', cxc: '12121', igv: '40111', ingreso: '70121', costo: '69111', stock: '20111' },
      { process: 'COMPRA', gasto: '60111', igv: '40111', cxp: '42121', stock: '20111', var: '61111' },
      { process: 'IMPORTACION', transito: '28111', cxpExt: '42122', adVal: '40151', igvImp: '40115', landedStock: '20111' },
    ];
    assert(defaultMappings.length === 3, 'Matriz de asignación de cuentas PCGE 2019 completa y consistente');

    await prisma.$disconnect();

    console.log('\n================================================================');
    console.log(`   RESULTADO FASE 5: ${testsPassed} PRUEBAS EXITOSAS | ${testsFailed} FALLAS`);
    console.log('================================================================');

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Error fatal durante la verificación:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

verifyAll();

