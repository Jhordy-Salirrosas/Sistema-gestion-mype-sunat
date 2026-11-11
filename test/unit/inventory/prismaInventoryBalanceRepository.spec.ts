import { PrismaInventoryBalanceRepository } from '../../../src/modules/inventory/infrastructure/persistence/prismaInventoryBalanceRepository';
import { InventoryBalanceEntity } from '../../../src/modules/inventory/domain/entities/inventoryBalanceEntity';

describe('PrismaInventoryBalanceRepository', () => {
  let repo: PrismaInventoryBalanceRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      inventoryBalance: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      inventoryProduct: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryWarehouse: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    repo = new PrismaInventoryBalanceRepository(mockPrisma);
  });

  it('encuentra saldo por almacén y producto o retorna null', async () => {
    mockPrisma.inventoryBalance.findFirst.mockResolvedValueOnce(null);
    expect(await repo.findByWarehouseAndProduct('w-1', 'p-1', 'c-1')).toBeNull();

    mockPrisma.inventoryBalance.findFirst.mockResolvedValueOnce({
      id: 'b-1',
      company_id: 'c-1',
      warehouse_id: 'w-1',
      product_id: 'p-1',
      current_stock: 12,
      average_unit_cost: 25.5,
      total_inventory_value: 306,
      last_movement_at: new Date('2026-11-01'),
    });
    const entity = await repo.findByWarehouseAndProduct('w-1', 'p-1', 'c-1');
    expect(entity?.currentStock).toBe(12);
    expect(entity?.averageUnitCost).toBe(25.5);
  });

  it('persiste y mapea saldos en upsertBalance y findAllByCompany con campos extendidos', async () => {
    const balance = new InventoryBalanceEntity({
      id: 'b-1',
      companyId: 'c-1',
      warehouseId: 'w-1',
      productId: 'p-1',
      currentStock: 10,
      averageUnitCost: 50,
      totalInventoryValue: 500,
    });
    mockPrisma.inventoryBalance.upsert.mockResolvedValueOnce({
      id: 'b-1',
      company_id: 'c-1',
      warehouse_id: 'w-1',
      product_id: 'p-1',
      current_stock: 10,
      average_unit_cost: 50,
      total_inventory_value: 500,
      last_movement_at: null,
    });
    const saved = await repo.upsertBalance(balance);
    expect(saved.totalInventoryValue).toBe(500);

    mockPrisma.inventoryBalance.findMany.mockResolvedValueOnce([
      {
        id: 'b-1',
        company_id: 'c-1',
        warehouse_id: 'w-1',
        product_id: 'p-1',
        current_stock: 10,
        average_unit_cost: 50,
        total_inventory_value: 500,
        last_movement_at: null,
        warehouse: { warehouse_code: 'ALM-01' },
        product: {
          sku: 'CEM-01',
          description: 'Cemento Sol',
          origin_type: 'IMPORTADO',
          is_service: false,
          brand: 'Sol',
          model: 'T1',
          category: 'CEM',
          manufacturer: 'UNACEM',
          country_of_origin: 'PE',
          tags: ['obra-civil'],
          barcode: '775001',
          hs_code: '2523.29',
          weight_kg: 42.5,
          volume_m3: 0.03,
          tax_affectation: '10',
          cost_price: 22,
          sale_price: 29,
          wholesale_price: 26,
          promo_price: 25,
          commission_rate: 5,
          min_price: 24,
          warehouse_location: 'A-01',
          attributes: [{ name: 'Peso', value: '42.5 kg' }],
          sunat_type_code: '01',
          sunat_unit_code: 'NIU',
          min_stock_alert: 5,
        },
      },
      {
        id: 'b-2',
        company_id: 'c-1',
        warehouse_id: 'w-2',
        product_id: 'p-2',
        current_stock: 0,
        average_unit_cost: 0,
        total_inventory_value: 0,
        last_movement_at: null,
        warehouse: null,
        product: null,
      },
    ]);

    const items = await repo.findAllByCompany('c-1');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      sku: 'CEM-01',
      warehouseCode: 'ALM-01',
      origin_type: 'IMPORTADO',
      weightKg: 42.5,
      sale_price: 29,
      minStockAlert: 5,
    });
    expect(items[1]).toMatchObject({
      sku: 'SIN-SKU',
      warehouseCode: 'ALM-01',
      weightKg: null,
      sale_price: null,
    });
  });
});

