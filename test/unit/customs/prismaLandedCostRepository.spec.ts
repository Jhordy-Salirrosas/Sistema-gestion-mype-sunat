import { PrismaLandedCostRepository } from '../../../src/modules/customs/infrastructure/persistence/prismaLandedCostRepository';
import type { PrismaService } from '../../../src/database/prismaService';
import { LandedCostStatus } from '../../../src/modules/customs/domain/enums/landedCostStatus.enum';
import { ShipmentStatus } from '../../../src/modules/customs/domain/enums/shipmentStatus.enum';

describe('PrismaLandedCostRepository', () => {
  let repository: PrismaLandedCostRepository;
  let prismaMock: any;
  let txMock: any;

  beforeEach(() => {
    txMock = {
      landedCostSheet: {
        upsert: jest.fn(),
      },
      customsItem: {
        update: jest.fn(),
      },
      customsShipment: {
        update: jest.fn(),
      },
    };

    prismaMock = {
      localExpenseInvoice: {
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      landedCostSheet: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(txMock)),
    };

    repository = new PrismaLandedCostRepository(prismaMock as unknown as PrismaService);
  });

  it('debe registrar un gasto local en localExpenseInvoice', async () => {
    prismaMock.localExpenseInvoice.create.mockResolvedValue({ id: 'exp-1' });

    const result = await repository.addLocalExpense({
      shipmentId: 'ship-1',
      supplierRuc: '20100070970',
      supplierName: 'Agencia Ransa',
      expenseConcept: 'ALMACENAJE',
      invoiceSerialNumber: 'F001-001',
      issueDate: new Date('2026-03-20'),
      netAmountPen: 1000,
      igvAmountPen: 180,
      totalAmountPen: 1180,
      prorationMethod: 'VALOR_FOB',
    });

    expect(result.id).toBe('exp-1');
    expect(prismaMock.localExpenseInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shipment_id: 'ship-1',
          expense_concept: 'ALMACENAJE',
          spot_detraction_rate: 0.0,
          is_capitalizable: true,
          proration_method: 'VALOR_FOB',
        }),
      }),
    );
  });

  it('debe listar gastos locales por ID de expediente ordenados por fecha', async () => {
    prismaMock.localExpenseInvoice.findMany.mockResolvedValue([{ id: 'exp-1' }]);

    const result = await repository.findLocalExpensesByShipmentId('ship-1');
    expect(result.length).toBe(1);
    expect(prismaMock.localExpenseInvoice.findMany).toHaveBeenCalledWith({
      where: { shipment_id: 'ship-1' },
      orderBy: { issue_date: 'asc' },
    });
  });

  it('debe eliminar un gasto local por id', async () => {
    prismaMock.localExpenseInvoice.delete.mockResolvedValue({ id: 'exp-1' });

    await repository.deleteLocalExpense('exp-1');
    expect(prismaMock.localExpenseInvoice.delete).toHaveBeenCalledWith({
      where: { id: 'exp-1' },
    });
  });

  it('debe persistir hoja de liquidación, actualizar ítems y cambiar embarque a COSTEADO en una transacción', async () => {
    txMock.landedCostSheet.upsert.mockResolvedValue({ id: 'sheet-1' });
    txMock.customsItem.update.mockResolvedValue({ id: 'item-1' });
    txMock.customsShipment.update.mockResolvedValue({ id: 'ship-1', status: ShipmentStatus.COSTEADO });

    const result = await repository.saveLandedCostSheet({
      shipmentId: 'ship-1',
      totalCifPen: 385000,
      totalDutiesPen: 15400,
      totalLocalExpensesPen: 2500,
      totalInventoryCostPen: 402900,
      status: LandedCostStatus.DEFINITIVO,
      approvedByAccountant: true,
      itemsProration: [
        {
          itemId: 'item-1',
          allocatedLocalCostPen: 2500,
          finalLandedCostUnitPen: 4029,
        },
      ],
    });

    expect(result.id).toBe('sheet-1');
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.landedCostSheet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shipment_id: 'ship-1' },
      }),
    );
    expect(txMock.customsItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        allocated_local_cost_pen: 2500,
        final_landed_cost_unit_pen: 4029,
      },
    });
    expect(txMock.customsShipment.update).toHaveBeenCalledWith({
      where: { id: 'ship-1' },
      data: { status: ShipmentStatus.COSTEADO },
    });
  });

  it('debe buscar hoja de costeo por shipmentId con relaciones anidadas', async () => {
    prismaMock.landedCostSheet.findUnique.mockResolvedValue({
      id: 'sheet-1',
      shipment_id: 'ship-1',
    });

    const result = await repository.findLandedCostSheetByShipmentId('ship-1');
    expect(result?.id).toBe('sheet-1');
    expect(prismaMock.landedCostSheet.findUnique).toHaveBeenCalledWith({
      where: { shipment_id: 'ship-1' },
      include: expect.objectContaining({
        shipment: expect.any(Object),
      }),
    });
  });
});
