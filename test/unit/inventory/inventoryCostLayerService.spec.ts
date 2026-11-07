import { InventoryCostLayerService } from '../../../src/modules/inventory/application/services/inventoryCostLayerService';

describe('InventoryCostLayerService', () => {
  const prisma = {
    company: { findUnique: jest.fn() },
    inventoryCostLayer: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const service = new InventoryCostLayerService(prisma as never);
  beforeEach(() => jest.clearAllMocks());

  it('lee el método de la empresa', async () => {
    prisma.company.findUnique.mockResolvedValue({ inventory_cost_method: 'FIFO' });
    await expect(service.metodo('c1')).resolves.toBe('FIFO');
    prisma.company.findUnique.mockResolvedValue(null);
    await expect(service.metodo('c1')).resolves.toBe('PROMEDIO');
  });

  it('lista capas abiertas', async () => {
    prisma.inventoryCostLayer.findMany.mockResolvedValue([{ quantity_remaining: 2, unit_cost: 10 }]);
    await expect(service.capas('c1', 'w1', 'p1')).resolves.toEqual([{ quantity: 2, unitCost: 10 }]);
  });

  it('registra una capa de entrada', async () => {
    prisma.inventoryCostLayer.create.mockResolvedValue({ id: 'l1' });
    await service.registrarEntrada('c1', 'w1', 'p1', 5, 20);
    expect(prisma.inventoryCostLayer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantity_remaining: 5, unit_cost: 20 }),
    });
  });

  it('consume capas en orden', async () => {
    prisma.inventoryCostLayer.findMany.mockResolvedValue([
      { id: 'l1', quantity_remaining: 2 }, { id: 'l2', quantity_remaining: 5 },
    ]);
    prisma.inventoryCostLayer.update.mockResolvedValue({});
    await service.consumir('c1', 'w1', 'p1', 4);
    expect(prisma.inventoryCostLayer.update).toHaveBeenCalledTimes(2);
  });
});
