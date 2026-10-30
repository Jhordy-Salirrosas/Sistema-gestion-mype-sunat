import { EventEmitter } from 'events';
import { ProcessImportCostOrderUseCase } from '../../../src/modules/inventory/application/use-cases/processImportCostOrderUseCase';
import { GeneratePleBookUseCase } from '../../../src/modules/inventory/application/use-cases/generatePleBookUseCase';
import { PleStructureValidatorService } from '../../../src/modules/inventory/infrastructure/adapters/pleStructureValidatorService';
import { Ple13_1FlatFileWriterAdapter } from '../../../src/modules/inventory/infrastructure/adapters/ple13_1FlatFileWriterAdapter';
import { Ple12_1FlatFileWriterAdapter } from '../../../src/modules/inventory/infrastructure/adapters/ple12_1FlatFileWriterAdapter';
import { ImportCostApprovedEventListener } from '../../../src/modules/inventory/application/listeners/importCostApprovedEventListener';
import { ImportCostApprovedEvent } from '../../../src/modules/customs/domain/events/ImportCostApprovedEvent';
import { InventoryWarehouseEntity } from '../../../src/modules/inventory/domain/entities/inventoryWarehouseEntity';
import { InventoryProductEntity } from '../../../src/modules/inventory/domain/entities/inventoryProductEntity';

describe('Customs to Autonomous Inventory Integration Flow', () => {
  let eventEmitter: EventEmitter;
  let processImportCostOrderUseCase: ProcessImportCostOrderUseCase;
  let generatePleBookUseCase: GeneratePleBookUseCase;
  let listener: ImportCostApprovedEventListener;

  // Repositorios en memoria para la prueba de integración desacoplada
  const warehousesDb: any[] = [];
  const productsDb: any[] = [];
  const balancesDb: Map<string, any> = new Map();
  const movementsDb: any[] = [];

  const warehouseRepoMock: any = {
    ensureDefaultWarehouse: jest.fn().mockImplementation((companyId) => {
      const existing = warehousesDb.find((w) => w.companyId === companyId);
      if (existing) return Promise.resolve(existing);
      const wh = new InventoryWarehouseEntity({
        id: 'wh-main',
        companyId,
        warehouseCode: 'ALM-01',
        description: 'Almacén Principal',
      });
      warehousesDb.push(wh);
      return Promise.resolve(wh);
    }),
    findByCode: jest.fn().mockImplementation((code, companyId) => {
      return Promise.resolve(warehousesDb.find((w) => w.warehouseCode === code && w.companyId === companyId) || null);
    }),
  };

  const productRepoMock: any = {
    findOrCreateBySku: jest.fn().mockImplementation((companyId, sku, description) => {
      const existing = productsDb.find((p) => p.sku === sku && p.companyId === companyId);
      if (existing) return Promise.resolve(existing);
      const p = new InventoryProductEntity({
        id: `prod-${sku}`,
        companyId,
        sku,
        description,
      });
      productsDb.push(p);
      return Promise.resolve(p);
    }),
  };

  const balanceRepoMock: any = {
    findByWarehouseAndProduct: jest.fn().mockImplementation((whId, prodId, companyId) => {
      const key = `${companyId}_${whId}_${prodId}`;
      return Promise.resolve(balancesDb.get(key) || null);
    }),
    upsertBalance: jest.fn().mockImplementation((b) => {
      const key = `${b.companyId}_${b.warehouseId}_${b.productId}`;
      balancesDb.set(key, b);
      return Promise.resolve(b);
    }),
  };

  const movementRepoMock: any = {
    findBySourceReference: jest.fn().mockImplementation((refId, op, prodId, companyId) => {
      const found = movementsDb.find(
        (m) =>
          m.sourceReferenceId === refId &&
          m.operationTypeCode === op &&
          m.productId === prodId &&
          m.companyId === companyId,
      );
      return Promise.resolve(found || null);
    }),
    create: jest.fn().mockImplementation((m) => {
      movementsDb.push(m);
      return Promise.resolve(m);
    }),
    findAllByCompany: jest.fn().mockImplementation((companyId) => {
      return Promise.resolve(
        movementsDb
          .filter((m) => m.companyId === companyId)
          .map((m) => {
            const p = productsDb.find((prod) => prod.id === m.productId);
            return Object.assign({}, m, {
              sku: p?.sku || 'SKU-UNKNOWN',
              productDescription: p?.description || 'Desc',
              warehouseCode: 'ALM-01',
            });
          }),
      );
    }),
  };

  beforeAll(() => {
    eventEmitter = new EventEmitter();

    processImportCostOrderUseCase = new ProcessImportCostOrderUseCase(
      warehouseRepoMock,
      productRepoMock,
      balanceRepoMock,
      movementRepoMock,
    );

    const validator = new PleStructureValidatorService();
    const ple13 = new Ple13_1FlatFileWriterAdapter(validator);
    const ple12 = new Ple12_1FlatFileWriterAdapter(validator);

    generatePleBookUseCase = new GeneratePleBookUseCase(
      movementRepoMock,
      ple13,
      ple12,
    );

    listener = new ImportCostApprovedEventListener(
      processImportCostOrderUseCase,
      eventEmitter as any,
    );
    listener.onModuleInit();
  });

  it('procesa evento ImportCostApprovedEvent desacoplado, actualiza existencias y genera libro PLE 13.1 conforme a SUNAT', async () => {
    const companyId = 'comp-peru-2026';
    const shipmentId = 'EXP-2026-0088';

    // 1. Simulación del Evento de Dominio emitido por customs tras aprobar Landed Cost
    const approvedEvent = new ImportCostApprovedEvent({
      companyId,
      landedCostSheetId: 'lcs-999',
      version: 1,
      shipmentId,
      declarationId: '118-2026-10-987654',
      approvedAt: new Date('2026-03-25T14:00:00Z'),
      totalCifPen: 120000,
      totalDutiesPen: 4800,
      totalLocalExpensesPen: 1200,
      totalInventoryCostPen: 126000,
      costItems: [
        {
          productCode: 'LAP-GAMER-16',
          commercialDescription: 'Laptop Gamer 16GB RAM i7',
          quantity: 30,
          unitLandedCostPen: 4200.0,
          totalLandedCostPen: 126000.0,
          destinationType: 'MERCADERIA',
        },
        {
          productCode: 'SRV-ADMIN-01',
          commercialDescription: 'Servidor Interno Administración',
          quantity: 1,
          unitLandedCostPen: 25000.0,
          totalLandedCostPen: 25000.0,
          destinationType: 'ACTIVO_FIJO', // Activo fijo debe ser excluido de Kardex
        },
      ],
    });

    // 2. Disparar evento a través del bus desacoplado
    eventEmitter.emit(approvedEvent.eventName, approvedEvent);

    // Esperar tick asíncrono para permitir que el listener complete
    await new Promise((r) => setTimeout(r, 50));

    // 3. Verificaciones de Inventario
    // Solo debe haberse registrado la MERCADERIA (1 movimiento tipo 18), ignorando el ACTIVO_FIJO
    expect(movementsDb.length).toBe(1);
    const movement = movementsDb[0];
    expect(movement.operationTypeCode).toBe('18');
    expect(movement.documentTypeCode).toBe('50');
    expect(movement.quantity).toBe(30);
    expect(movement.unitCost).toBe(4200.0);
    expect(movement.resultingStock).toBe(30);
    expect(movement.resultingTotalValue).toBe(126000.0);

    // Verificar balance del producto
    const balanceKey = `${companyId}_wh-main_prod-LAP-GAMER-16`;
    const balance = balancesDb.get(balanceKey);
    expect(balance).toBeDefined();
    expect(balance.currentStock).toBe(30);
    expect(balance.averageUnitCost).toBe(4200.0);
    expect(balance.totalInventoryValue).toBe(126000.0);

    // 4. Generación y exportación de Libro Electrónico PLE 13.1
    const pleResult = await generatePleBookUseCase.execute(
      {
        book_type: '13.1',
        fiscal_year: 2026,
      },
      companyId,
      '20609999991',
    );

    expect(pleResult.recordsCount).toBe(1);
    expect(pleResult.fileName).toBe('LE2060999999120260000130100001111.txt');
    expect(pleResult.content).toContain('LAP-GAMER-16');
    expect(pleResult.content).toContain('126000.00');

    const linePipes = (pleResult.content.trim().match(/\|/g) || []).length;
    expect(linePipes).toBe(27); // 27 campos obligatorios SUNAT Res. 234-2006
  });
});

