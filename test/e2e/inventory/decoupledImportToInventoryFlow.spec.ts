import { EventEmitter } from 'events';
import { ProcessImportCostOrderUseCase } from '../../../src/modules/inventory/application/use-cases/processImportCostOrderUseCase';
import { RegisterManualMovementUseCase } from '../../../src/modules/inventory/application/use-cases/registerManualMovementUseCase';
import { GeneratePleBookUseCase } from '../../../src/modules/inventory/application/use-cases/generatePleBookUseCase';
import { EvaluateBookObligationUseCase } from '../../../src/modules/inventory/application/use-cases/evaluateBookObligationUseCase';
import { PleStructureValidatorService } from '../../../src/modules/inventory/infrastructure/adapters/pleStructureValidatorService';
import { Ple13_1FlatFileWriterAdapter } from '../../../src/modules/inventory/infrastructure/adapters/ple13_1FlatFileWriterAdapter';
import { Ple12_1FlatFileWriterAdapter } from '../../../src/modules/inventory/infrastructure/adapters/ple12_1FlatFileWriterAdapter';
import { ImportCostApprovedEventListener } from '../../../src/modules/inventory/application/listeners/importCostApprovedEventListener';
import { ImportCostApprovedEvent } from '../../../src/modules/customs/domain/events/ImportCostApprovedEvent';
import { InventoryWarehouseEntity } from '../../../src/modules/inventory/domain/entities/inventoryWarehouseEntity';
import { InventoryProductEntity } from '../../../src/modules/inventory/domain/entities/inventoryProductEntity';
import { InventoryBalanceEntity } from '../../../src/modules/inventory/domain/entities/inventoryBalanceEntity';

describe('Decoupled Importation to Autonomous Inventory & Kardex (E2E Multi-Profile)', () => {
  let eventEmitter: EventEmitter;
  let processImportUseCase: ProcessImportCostOrderUseCase;
  let registerMovementUseCase: RegisterManualMovementUseCase;
  let generatePleUseCase: GeneratePleBookUseCase;
  let evaluateObligationUseCase: EvaluateBookObligationUseCase;
  let listener: ImportCostApprovedEventListener;

  const companyId = 'company-mype-e2e-2026';
  const companyRuc = '20601234567';

  // Almacenamiento en memoria para simular persistencia
  const warehousesDb = new Map<string, InventoryWarehouseEntity>();
  const productsDb = new Map<string, InventoryProductEntity>();
  const balancesDb = new Map<string, InventoryBalanceEntity>();
  const movementsDb: any[] = [];
  const obligationsDb = new Map<number, any>();

  const warehouseRepo: any = {
    ensureDefaultWarehouse: jest.fn().mockImplementation(async (cId) => {
      const key = `${cId}_ALM-01`;
      if (warehousesDb.has(key)) return warehousesDb.get(key)!;
      const wh = new InventoryWarehouseEntity({
        id: 'wh-main-01',
        companyId: cId,
        warehouseCode: 'ALM-01',
        description: 'Almacén Central',
      });
      warehousesDb.set(key, wh);
      return wh;
    }),
    findByCode: jest.fn().mockImplementation(async (code, cId) => {
      return warehousesDb.get(`${cId}_${code}`) || null;
    }),
  };

  const productRepo: any = {
    findOrCreateBySku: jest.fn().mockImplementation(async (cId, sku, desc) => {
      const key = `${cId}_${sku}`;
      if (productsDb.has(key)) return productsDb.get(key)!;
      const p = new InventoryProductEntity({
        id: `prod-${sku}`,
        companyId: cId,
        sku,
        description: desc,
      });
      productsDb.set(key, p);
      return p;
    }),
    findBySku: jest.fn().mockImplementation(async (sku, cId) => {
      return productsDb.get(`${cId}_${sku}`) || null;
    }),
  };

  const balanceRepo: any = {
    findByWarehouseAndProduct: jest.fn().mockImplementation(async (whId, prodId, cId) => {
      return balancesDb.get(`${cId}_${whId}_${prodId}`) || null;
    }),
    upsertBalance: jest.fn().mockImplementation(async (b) => {
      balancesDb.set(`${b.companyId}_${b.warehouseId}_${b.productId}`, b);
      return b;
    }),
    findAllByCompany: jest.fn().mockImplementation(async (cId) => {
      return Array.from(balancesDb.values())
        .filter((b) => b.companyId === cId)
        .map((b) => {
          const prod = Array.from(productsDb.values()).find((p) => p.id === b.productId);
          return Object.assign({}, b, {
            sku: prod?.sku || 'SKU',
            productDescription: prod?.description || 'Desc',
            warehouseCode: 'ALM-01',
          });
        });
    }),
  };

  const movementRepo: any = {
    create: jest.fn().mockImplementation(async (m) => {
      const created = Object.assign({}, m, { id: `mov-${Date.now()}-${movementsDb.length}` });
      movementsDb.push(created);
      return created;
    }),
    findBySourceReference: jest.fn().mockImplementation(async (refId, op, prodId, cId) => {
      return movementsDb.find(
        (m) =>
          m.sourceReferenceId === refId &&
          m.operationTypeCode === op &&
          m.productId === prodId &&
          m.companyId === cId,
      ) || null;
    }),
    findAllByCompany: jest.fn().mockImplementation(async (cId, _start, _end) => {
      return movementsDb
        .filter((m) => m.companyId === cId)
        .map((m) => {
          const prod = Array.from(productsDb.values()).find((p) => p.id === m.productId);
          return Object.assign({}, m, {
            sku: prod?.sku || 'SKU',
            productDescription: prod?.description || 'Desc',
            warehouseCode: 'ALM-01',
          });
        });
    }),
  };

  const obligationRepo: any = {
    saveDecision: jest.fn().mockImplementation(async (d) => {
      obligationsDb.set(d.fiscalYear, d);
      return d;
    }),
    findByFiscalYear: jest.fn().mockImplementation(async (_cId, year) => {
      return obligationsDb.get(year) || null;
    }),
  };

  beforeAll(() => {
    eventEmitter = new EventEmitter();

    processImportUseCase = new ProcessImportCostOrderUseCase(
      warehouseRepo,
      productRepo,
      balanceRepo,
      movementRepo,
    );

    registerMovementUseCase = new RegisterManualMovementUseCase(
      warehouseRepo,
      productRepo,
      balanceRepo,
      movementRepo,
    );

    const validator = new PleStructureValidatorService();
    const ple13 = new Ple13_1FlatFileWriterAdapter(validator);
    const ple12 = new Ple12_1FlatFileWriterAdapter(validator);

    generatePleUseCase = new GeneratePleBookUseCase(movementRepo, ple13, ple12);
    evaluateObligationUseCase = new EvaluateBookObligationUseCase(obligationRepo);

    listener = new ImportCostApprovedEventListener(processImportUseCase, eventEmitter as any);
    listener.onModuleInit();
  });

  it('Perfil 1 (MYPE Comercial): Importación nacionalizada con descarte de activo fijo, venta nacional y PLE 13.1', async () => {
    // 1. Recepción y aprobación de costo aduanero (Evento de Dominio)
    const event = new ImportCostApprovedEvent({
      companyId,
      landedCostSheetId: 'lcs-001',
      version: 1,
      shipmentId: 'EXP-2026-COMERCIAL',
      declarationId: '118-2026-10-100200',
      approvedAt: new Date('2026-03-20T10:00:00Z'),
      totalCifPen: 200000,
      totalDutiesPen: 8000,
      totalLocalExpensesPen: 2000,
      totalInventoryCostPen: 210000,
      costItems: [
        {
          productCode: 'LAPTOP-PRO-16',
          commercialDescription: 'Laptop Pro 16 Pulgadas',
          quantity: 50,
          unitLandedCostPen: 4200.0,
          totalLandedCostPen: 210000.0,
          destinationType: 'MERCADERIA',
        },
        {
          productCode: 'SERVER-AI-RACK',
          commercialDescription: 'Servidor DeepLearning TI',
          quantity: 1,
          unitLandedCostPen: 45000.0,
          totalLandedCostPen: 45000.0,
          destinationType: 'ACTIVO_FIJO',
        },
      ],
    });

    eventEmitter.emit(event.eventName, event);
    await new Promise((r) => setTimeout(r, 60));

    // Verificación de existencia inicial en inventario
    const initialBalance = balancesDb.get(`${companyId}_wh-main-01_prod-LAPTOP-PRO-16`);
    expect(initialBalance).toBeDefined();
    expect(initialBalance?.currentStock).toBe(50);
    expect(initialBalance?.averageUnitCost).toBe(4200.0);
    expect(initialBalance?.totalInventoryValue).toBe(210000.0);

    // Verificación de exclusión de Activo Fijo
    const fixedAssetBalance = balancesDb.get(`${companyId}_wh-main-01_prod-SERVER-AI-RACK`);
    expect(fixedAssetBalance).toBeUndefined();

    // 2. Operación de mercado local: Venta nacional (Tipo 01) de 10 laptops
    const saleResult = await registerMovementUseCase.execute(
      {
        sku: 'LAPTOP-PRO-16',
        direction: 'SALIDA',
        operation_type_code: '01',
        quantity: 10,
        document_type_code: '01',
        document_serial: 'F001',
        document_number: '000055',
      },
      companyId,
    );

    expect(saleResult.quantity).toBe(10);
    expect(saleResult.unitCost).toBe(4200.0);
    expect(saleResult.totalCost).toBe(42000.0);
    expect(saleResult.resultingStock).toBe(40);
    expect(saleResult.resultingAverageCost).toBe(4200.0);
    expect(saleResult.resultingTotalValue).toBe(168000.0);

    // 3. Generación y exportación de Libro Electrónico PLE 13.1
    const ple = await generatePleUseCase.execute({ book_type: '13.1', fiscal_year: 2026 }, companyId, companyRuc);
    expect(ple.recordsCount).toBe(2); // 1 entrada importación + 1 salida venta
    expect(ple.fileName).toBe('LE2060123456720260000130100001111.txt');
    expect(ple.fileName.length).toBe(37);
  });

  it('Perfil 2 (MYPE Jurídica): Evaluación de obligatoriedad según Art. 35 LIR y RS 239-2008', async () => {
    // Caso MYPE Tributario con ingresos de 2,200 UIT (>1,500 UIT)
    const decision = await evaluateObligationUseCase.execute(
      {
        fiscal_year: 2026,
        annual_revenue_uit: 2200,
        tax_regime: 'MYPE_TRIBUTARIO',
      },
      companyId,
    );

    expect(decision.ple13_1Status).toBe('OBLIGATORIO');
    expect(decision.ple12_1Status).toBe('EXCEPTUADO');
    expect(decision.legalBasisNotes).toContain('RS 239-2008/SUNAT');
  });

  it('Perfil 3 (Idempotencia y Resiliencia): Reintento de publicación no distorsiona existencias ni saldos', async () => {
    const duplicateEvent = new ImportCostApprovedEvent({
      companyId,
      landedCostSheetId: 'lcs-001',
      version: 1,
      shipmentId: 'EXP-2026-COMERCIAL', // Mismo expediente ya procesado en Perfil 1
      declarationId: '118-2026-10-100200',
      approvedAt: new Date(),
      totalCifPen: 200000,
      totalDutiesPen: 8000,
      totalLocalExpensesPen: 2000,
      totalInventoryCostPen: 210000,
      costItems: [
        {
          productCode: 'LAPTOP-PRO-16',
          commercialDescription: 'Laptop Pro 16 Pulgadas',
          quantity: 50,
          unitLandedCostPen: 4200.0,
          totalLandedCostPen: 210000.0,
          destinationType: 'MERCADERIA',
        },
      ],
    });

    eventEmitter.emit(duplicateEvent.eventName, duplicateEvent);
    await new Promise((r) => setTimeout(r, 60));

    // El stock de LAPTOP-PRO-16 debe permanecer en 40 (sin haberse sumado otras 50 unidades)
    const balance = balancesDb.get(`${companyId}_wh-main-01_prod-LAPTOP-PRO-16`);
    expect(balance?.currentStock).toBe(40);
  });
});

