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
        expect.objectContaining({ accountCode: '20111', debitAmount: 1500 }),
        expect.objectContaining({ accountCode: '28111', creditAmount: 1500 }),
      ]),
    }));
  });

  it('usa las cuentas del mapeador y la DAM para tributos', async () => {
    let handler: ((event: any) => Promise<void>) | undefined;
    const publisher = { on: jest.fn((_n: string, cb: any) => { handler = cb; }) };
    const prisma = {
      accountingEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      accountingMapping: { findMany: jest.fn().mockResolvedValue([
        { role_code: 'INGRESO_ALMACEN', account_code: '20111' },
        { role_code: 'CXP_EXTERIOR', account_code: '42122' },
        { role_code: 'AD_VALOREM', account_code: '40151' },
        { role_code: 'IGV_IMPORTACION', account_code: '40115' },
        { role_code: 'PERCEPCION_IGV', account_code: '40113' },
      ]) },
      customsDeclaration: { findFirst: jest.fn().mockResolvedValue({
        cif_value_pen: 1000, ad_valorem_amount_pen: 100, igv_ipm_amount_pen: 180, perception_amount_pen: 20,
      }) },
    };
    const accounting = { execute: jest.fn().mockResolvedValue({}) };
    const listener = new ImportCostApprovedEventListener({ execute: jest.fn() } as any, publisher as any, prisma as any, accounting as any);
    listener.onModuleInit();
    await handler!({ payload: {
      companyId: 'c1', shipmentId: 's1', declarationId: 'd1', approvedAt: new Date('2026-11-05'),
      totalCifPen: 1000, totalDutiesPen: 100, totalLocalExpensesPen: 0, totalInventoryCostPen: 1100,
      costItems: [],
    }});
    expect(accounting.execute).toHaveBeenCalledWith(expect.objectContaining({
      lines: expect.arrayContaining([
        expect.objectContaining({ accountCode: '20111', debitAmount: 1100 }),
        expect.objectContaining({ accountCode: '42122', creditAmount: 1000 }),
        expect.objectContaining({ accountCode: '40151', creditAmount: 100 }),
      ]),
    }));
  });
});
