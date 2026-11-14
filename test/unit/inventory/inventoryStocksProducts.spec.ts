import { UnauthorizedException } from '@nestjs/common';
import { InventoryStocksController } from '../../../src/modules/inventory/infrastructure/controllers/inventoryStocksController';

describe('InventoryStocksController - listAllProducts', () => {
  let controller: InventoryStocksController;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      inventoryProduct: {
        findMany: jest.fn(),
      },
    };

    controller = new InventoryStocksController(
      {} as any,
      {} as any,
      {} as any,
      prismaMock as any,
      {} as any,
    );
  });

  it('debe lanzar UnauthorizedException si no se envía companyId', async () => {
    await expect(controller.listAllProducts(undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('debe listar productos con mapeo de campos booleanos y precios', async () => {
    prismaMock.inventoryProduct.findMany.mockResolvedValue([
      {
        id: 'p-1',
        sku: 'POR-120',
        description: 'Porcelanato',
        is_service: false,
        is_inventory: true,
        sunat_unit_code: 'NIU',
        cost_price: 25.5,
        sale_price: 45.0,
      },
      {
        id: 'p-2',
        sku: 'SRV-AGENCIA',
        description: 'Agencia',
        is_service: true,
        is_inventory: false,
        sunat_unit_code: 'ZZ',
        cost_price: null,
        sale_price: null,
      },
    ]);

    const result = await controller.listAllProducts('c-1');

    expect(prismaMock.inventoryProduct.findMany).toHaveBeenCalledWith({
      where: {
        company_id: 'c-1',
        is_active: true,
      },
      orderBy: { sku: 'asc' },
    });
    expect(result).toHaveLength(2);
    expect(result[0].isInventory).toBe(true);
    expect(result[0].costPrice).toBe(25.5);
    expect(result[1].isService).toBe(true);
    expect(result[1].costPrice).toBeUndefined();
  });

  it('debe excluir servicios si includeServices es false', async () => {
    prismaMock.inventoryProduct.findMany.mockResolvedValue([]);

    await controller.listAllProducts('c-1', 'false');

    expect(prismaMock.inventoryProduct.findMany).toHaveBeenCalledWith({
      where: {
        company_id: 'c-1',
        is_active: true,
        is_service: false,
      },
      orderBy: { sku: 'asc' },
    });
  });
});
