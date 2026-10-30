import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GetProductKardexLedgerUseCase } from '../../../src/modules/inventory/application/use-cases/getProductKardexLedgerUseCase';
import { ListWarehouseStockUseCase } from '../../../src/modules/inventory/application/use-cases/listWarehouseStockUseCase';
import { InventoryStocksController } from '../../../src/modules/inventory/infrastructure/controllers/inventoryStocksController';
import { InventoryMovementsController } from '../../../src/modules/inventory/infrastructure/controllers/inventoryMovementsController';
import { InventoryPleController } from '../../../src/modules/inventory/infrastructure/controllers/inventoryPleController';
import { InventoryProductEntity } from '../../../src/modules/inventory/domain/entities/inventoryProductEntity';
import { SunatTable12VO } from '../../../src/modules/inventory/domain/value-objects/sunatTable12Vo';
import { SunatTable10VO } from '../../../src/modules/inventory/domain/value-objects/sunatTable10Vo';
import { SunatTable5VO } from '../../../src/modules/inventory/domain/value-objects/sunatTable5Vo';
import { SunatTable6VO } from '../../../src/modules/inventory/domain/value-objects/sunatTable6Vo';

describe('Remaining Inventory Coverage', () => {
  describe('Value Objects (SUNAT Tables)', () => {
    it('SunatTable12VO valida operaciones válidas e inválidas', () => {
      const vo = new SunatTable12VO('18');
      expect(vo.code).toBe('18');
      expect(vo.description).toBe('IMPORTACION');
      expect(vo.defaultDirection).toBe('ENTRADA');
      expect(SunatTable12VO.isValid('18')).toBe(true);
      expect(SunatTable12VO.isValid('999')).toBe(false);

      const saleVo = new SunatTable12VO('01');
      expect(saleVo.defaultDirection).toBe('SALIDA');
      expect(saleVo.code).toBe('01');

      expect(() => new SunatTable12VO('999')).toThrow();
    });

    it('SunatTable10VO valida comprobantes válidos e inválidos', () => {
      const vo = new SunatTable10VO('50');
      expect(vo.code).toBe('50');
      expect(vo.description).toBe('DECLARACION ADUANERA DE MERCANCIAS (DAM/DUA)');
      expect(SunatTable10VO.isValid('50')).toBe(true);
      expect(SunatTable10VO.isValid('XYZ')).toBe(false);

      const factVo = new SunatTable10VO('01');
      expect(factVo.code).toBe('01');

      expect(() => new SunatTable10VO('XYZ')).toThrow();
    });

    it('SunatTable5VO y SunatTable6VO validan códigos', () => {
      const t5 = new SunatTable5VO('01');
      expect(t5.code).toBe('01');
      expect(t5.description).toBe('MERCADERIAS');
      expect(SunatTable5VO.isValid('01')).toBe(true);
      expect(SunatTable5VO.isValid('999')).toBe(false);
      expect(() => new SunatTable5VO('999')).toThrow();

      const t6 = new SunatTable6VO('NIU');
      expect(t6.code).toBe('NIU');
      expect(t6.description).toBe('UNIDAD (BIENES)');
      expect(SunatTable6VO.isValid('NIU')).toBe(true);
      expect(SunatTable6VO.isValid('INVALID')).toBe(false);
      expect(() => new SunatTable6VO('INVALID')).toThrow();
    });
  });

  describe('GetProductKardexLedgerUseCase', () => {
    let useCase: GetProductKardexLedgerUseCase;
    let productRepoMock: any;
    let movementRepoMock: any;
    let balanceRepoMock: any;

    beforeEach(() => {
      productRepoMock = {
        findById: jest.fn(),
        findBySku: jest.fn(),
      };
      movementRepoMock = {
        findMovementsByProduct: jest.fn().mockResolvedValue([
          {
            id: 'mov-1',
            movementNumber: 'MOV-001',
            movementDate: new Date('2026-10-15'),
            operationTypeCode: '18',
            documentTypeCode: '50',
            documentSerial: '118',
            documentNumber: '048291',
            direction: 'ENTRADA',
            quantity: 100,
            unitCost: 2000,
            totalCost: 200000,
            previousStock: 0,
            resultingStock: 100,
            resultingUnitCost: 2000,
            resultingTotalValue: 200000,
            sourceReferenceId: 'ship-1',
            notes: 'Importación',
          },
        ]),
      };
      balanceRepoMock = {};

      useCase = new GetProductKardexLedgerUseCase(
        productRepoMock,
        movementRepoMock,
        balanceRepoMock,
      );
    });

    it('arroja BadRequestException si no hay companyId', async () => {
      await expect(useCase.execute({ sku: 'LAP-001' }, '')).rejects.toThrow(BadRequestException);
    });

    it('arroja NotFoundException si no encuentra el producto por SKU o ID', async () => {
      productRepoMock.findBySku.mockResolvedValueOnce(null);
      await expect(useCase.execute({ sku: 'LAP-NONEXISTENT' }, 'comp-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retorna el kardex mapeado cuando busca por SKU o product_id', async () => {
      const mockProd = new InventoryProductEntity({
        id: 'p-1',
        companyId: 'comp-1',
        sku: 'LAP-001',
        description: 'Laptop',
        sunatTypeCode: '01',
        sunatUnitCode: 'NIU',
      });
      productRepoMock.findBySku.mockResolvedValueOnce(mockProd);

      const result = await useCase.execute(
        { sku: 'LAP-001', start_date: '2026-01-01', end_date: '2026-12-31' },
        'comp-1',
      );

      expect(result.product.sku).toBe('LAP-001');
      expect(result.movements.length).toBe(1);
      expect(result.movements[0].resultingStock).toBe(100);

      // Buscar por product_id
      productRepoMock.findById.mockResolvedValueOnce(mockProd);
      const resById = await useCase.execute({ product_id: 'p-1' }, 'comp-1');
      expect(resById.product.id).toBe('p-1');
    });
  });

  describe('ListWarehouseStockUseCase', () => {
    let useCase: ListWarehouseStockUseCase;
    let balanceRepoMock: any;

    beforeEach(() => {
      balanceRepoMock = {
        findAllByCompany: jest.fn().mockResolvedValue([
          {
            id: 'b-1',
            warehouseCode: '0000',
            sku: 'LAP-001',
            productDescription: 'Laptop',
            currentStock: 10,
            averageUnitCost: 2000,
            totalInventoryValue: 20000,
            lastMovementAt: new Date(),
          },
        ]),
      };
      useCase = new ListWarehouseStockUseCase(balanceRepoMock);
    });

    it('arroja BadRequestException si no hay companyId', async () => {
      await expect(useCase.execute('')).rejects.toThrow(BadRequestException);
    });

    it('retorna la valorización agregada y lista de balances', async () => {
      const result = await useCase.execute('comp-1');
      expect(result.totalValuationPen).toBe(20000);
      expect(result.totalItemsCount).toBe(1);
      expect(result.balances[0].sku).toBe('LAP-001');
    });
  });

  describe('Inventory Controllers', () => {
    let stocksController: InventoryStocksController;
    let movementsController: InventoryMovementsController;
    let pleController: InventoryPleController;

    let listStockMock: any;
    let getKardexMock: any;
    let productRepoMock: any;
    let movementRepoMock: any;
    let registerMovementMock: any;
    let evaluateUseCaseMock: any;
    let generatePleUseCaseMock: any;
    let obligationRepoMock: any;
    let prismaMock: any;

    beforeEach(() => {
      listStockMock = { execute: jest.fn().mockResolvedValue({ totalValuationPen: 5000 }) };
      getKardexMock = { execute: jest.fn().mockResolvedValue({ movements: [] }) };
      productRepoMock = {
        create: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      };
      movementRepoMock = {
        findAllByCompany: jest.fn().mockResolvedValue([]),
      };
      registerMovementMock = {
        execute: jest.fn().mockResolvedValue({
          movementId: 'm-new',
          movementNumber: 'MOV-001',
          sku: 'SKU-001',
          direction: 'ENTRADA',
          quantity: 10,
          unitCost: 100,
          totalCost: 1000,
          resultingStock: 10,
          resultingAverageCost: 100,
          resultingTotalValue: 1000,
        }),
      };
      evaluateUseCaseMock = { execute: jest.fn().mockResolvedValue({ ple13_1Status: 'OBLIGATORIO' }) };
      generatePleUseCaseMock = {
        execute: jest.fn().mockResolvedValue({
          fileName: 'LE20601012341202600130100001111.txt',
          content: 'TEST|CONTENT',
          recordsCount: 1,
        }),
      };
      obligationRepoMock = {
        findByFiscalYear: jest.fn().mockResolvedValue({ fiscalYear: 2026 }),
      };
      prismaMock = {
        company: {
          findUnique: jest.fn().mockResolvedValue({ ruc: '20601012341' }),
        },
      };

      stocksController = new InventoryStocksController(
        listStockMock,
        getKardexMock,
        productRepoMock,
      );

      movementsController = new InventoryMovementsController(
        registerMovementMock,
        movementRepoMock,
      );

      pleController = new InventoryPleController(
        evaluateUseCaseMock,
        generatePleUseCaseMock,
        obligationRepoMock,
        prismaMock,
      );
    });

    it('InventoryStocksController valida companyId y delega acciones', async () => {
      await expect(stocksController.listStock(undefined)).rejects.toThrow(UnauthorizedException);
      const stock = await stocksController.listStock('comp-1');
      expect(stock.totalValuationPen).toBe(5000);

      await expect(
        stocksController.registerProduct(
          {
            sku: 'PROD-NEW',
            description: 'Item Desc',
            sunat_type_code: '01',
            sunat_unit_code: 'NIU',
            min_stock_alert: 5,
          },
          undefined,
        ),
      ).rejects.toThrow(UnauthorizedException);

      const created = await stocksController.registerProduct(
        {
          sku: 'PROD-NEW',
          description: 'Item Desc',
          sunat_type_code: '01',
          sunat_unit_code: 'NIU',
          min_stock_alert: 5,
        },
        'comp-1',
      );
      expect(created.sku).toBe('PROD-NEW');

      await expect(stocksController.getKardex('PROD-NEW', undefined, undefined, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      const kardex = await stocksController.getKardex('PROD-NEW', undefined, undefined, 'comp-1');
      expect(kardex.movements).toEqual([]);
    });

    it('InventoryMovementsController valida companyId y maneja filtros', async () => {
      await expect(movementsController.listMovements(undefined)).rejects.toThrow(
        UnauthorizedException,
      );

      const list = await movementsController.listMovements('comp-1', '2026-01-01', '2026-12-31');
      expect(list).toEqual({ items: [], total: 0 });

      await expect(movementsController.createMovement({} as any, undefined)).rejects.toThrow(
        UnauthorizedException,
      );

      const reg = await movementsController.createMovement(
        {
          warehouse_id: 'wh-1',
          product_id: 'p-1',
          operation_type_code: '01',
          direction: 'SALIDA',
          quantity: 5,
        } as any,
        'comp-1',
      );
      expect(reg.movementId).toBe('m-new');
    });

    it('InventoryPleController valida y exporta archivos PLE', async () => {
      await expect(pleController.getObligation(2026, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      const ob = await pleController.getObligation(2026, 'comp-1');
      expect(ob?.fiscalYear).toBe(2026);

      await expect(pleController.evaluateObligation({} as any, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      const evalRes = await pleController.evaluateObligation(
        { annual_revenue_uit: 1800, fiscal_year: 2026, tax_regime: 'MYPE_TRIBUTARIO' },
        'comp-1',
      );
      expect(evalRes.ple13_1Status).toBe('OBLIGATORIO');

      const resMock = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      await expect(
        pleController.exportPleBook({ book_type: '13.1', fiscal_year: 2026 }, undefined, resMock),
      ).rejects.toThrow(UnauthorizedException);

      await pleController.exportPleBook(
        { book_type: '13.1', fiscal_year: 2026 },
        'comp-1',
        resMock,
      );
      expect(resMock.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; charset=ISO-8859-1',
      );
      expect(resMock.send).toHaveBeenCalledWith('TEST|CONTENT');
    });
  });
});
