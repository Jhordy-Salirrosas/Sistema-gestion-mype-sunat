import { ImportCostApprovedEventListener } from '../../../src/modules/inventory/application/listeners/importCostApprovedEventListener';

describe('ImportCostApprovedEventListener - asiento de importación', () => {
  it('procesa el evento y registra el asiento 201/421', async () => {
    let handler: ((event: any) => Promise<void>) | undefined;
    const publisher = {
      on: jest.fn((_name: string, cb: (event: any) => Promise<void>) => {
        handler = cb;
      }),
    };
    const process = { execute: jest.fn().mockResolvedValue({}) };
    const prisma = { accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) } };
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const listener = new ImportCostApprovedEventListener(
      process as any,
      publisher as any,
      prisma as any,
      accounting as any,
    );

    listener.onModuleInit();
    expect(handler).toBeDefined();

    await handler!({
      payload: {
        companyId: 'comp-1',
        shipmentId: 'ship-1',
        declarationId: 'dam-1',
        approvedAt: new Date('2026-11-05T00:00:00.000Z'),
        totalInventoryCostPen: 1500,
        costItems: [
          {
            productCode: 'CEM-001',
            commercialDescription: 'Cemento',
            quantity: 10,
            unitLandedCostPen: 150,
            destinationType: 'MERCADERIA',
          },
        ],
      },
    });

    expect(process.execute).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'comp-1',
      shipmentId: 'ship-1',
      items: expect.any(Array),
    }));
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({
      sourceModule: 'PURCHASES_IMPORT',
      sourceReferenceId: 'ship-1',
      period: '2026-11',
      lines: expect.arrayContaining([
        expect.objectContaining({ accountCode: '201', debitAmount: 1500 }),
        expect.objectContaining({ accountCode: expect.stringMatching(/281|421/), creditAmount: 1500 }),
      ]),
    }));
  });
});
