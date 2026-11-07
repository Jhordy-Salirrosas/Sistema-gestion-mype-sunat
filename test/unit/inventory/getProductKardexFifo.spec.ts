import { GetProductKardexLedgerUseCase } from '../../../src/modules/inventory/application/use-cases/getProductKardexLedgerUseCase';

describe('GetProductKardexLedgerUseCase FIFO', () => {
  const product = { id: 'p1', sku: 'SKU1', description: 'Producto', sunatTypeCode: '01', sunatUnitCode: 'NIU' };
  const productRepo = { findBySku: jest.fn().mockResolvedValue(product), findById: jest.fn() };
  const movementRepo = { findMovementsByProduct: jest.fn().mockResolvedValue([
    { id: 'm1', warehouseCode: 'ALM-01', movementNumber: 'M1', movementDate: '2026-11-01', operationTypeCode: '02', direction: 'ENTRADA', quantity: 5, unitCost: 10, totalCost: 50, resultingStock: 5, resultingUnitCost: 10, resultingTotalValue: 50 },
    { id: 'm2', warehouseCode: 'ALM-01', movementNumber: 'M2', movementDate: '2026-11-02', operationTypeCode: '01', direction: 'SALIDA', quantity: 2, unitCost: 10, totalCost: 20, resultingStock: 3, resultingUnitCost: 10, resultingTotalValue: 30 },
  ]) };
  const balanceRepo = {};
  const prisma = { inventoryBalance: { findMany: jest.fn().mockResolvedValue([{ current_stock: 3, total_inventory_value: 30, average_unit_cost: 10, warehouse: { warehouse_code: 'ALM-01' } }]) } };
  const useCase = new GetProductKardexLedgerUseCase(productRepo as never, movementRepo as never, balanceRepo as never, prisma as never);

  it('devuelve método FIFO y recalcula los movimientos', async () => {
    const r = await useCase.execute({ sku: 'SKU1', metodo: 'FIFO' } as never, 'c1');
    expect(r.costMethod).toBe('FIFO');
    expect(r.movements).toHaveLength(2);
    expect(r.summary.totalStock).toBe(3);
  });
});
