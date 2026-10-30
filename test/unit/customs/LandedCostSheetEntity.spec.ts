import {
  LandedCostSheetEntity,
  LandedCostItemEntity,
} from '../../../src/modules/customs/domain/entities/landedCostSheetEntity';

describe('LandedCostSheetEntity (Domain Entity)', () => {
  it('debe crear una hoja de costos en borrador y permitir aprobación formal', () => {
    const item = new LandedCostItemEntity({
      productCode: 'PROD-A',
      commercialDescription: 'Producto A',
      quantity: 100,
      fobUnitUsd: 10,
      fobTotalUsd: 1000,
      allocatedCifPen: 3800,
      allocatedDutiesPen: 0,
      allocatedLocalExpensesPen: 200,
      totalLandedCostPen: 4000,
      unitLandedCostPen: 40,
      destinationType: 'MERCADERIA',
    });

    const sheet = new LandedCostSheetEntity({
      companyId: 'company-01',
      shipmentId: 'ship-01',
      totalCifPen: 3800,
      totalDutiesPen: 0,
      totalLocalExpensesPen: 200,
      totalInventoryCostPen: 4000,
      itemsProration: [item],
    });

    expect(sheet.status).toBe('BORRADOR');
    expect(sheet.isApproved).toBe(false);

    sheet.approve(true);
    expect(sheet.status).toBe('APROBADO');
    expect(sheet.isApproved).toBe(true);
  });

  it('debe arrojar error si se intenta aprobar una hoja ya aprobada', () => {
    const sheet = new LandedCostSheetEntity({
      companyId: 'company-01',
      shipmentId: 'ship-01',
      totalCifPen: 1000,
      totalDutiesPen: 0,
      totalLocalExpensesPen: 0,
      totalInventoryCostPen: 1000,
      status: 'APROBADO',
    });

    expect(() => sheet.approve(true)).toThrow('La hoja de costos ya fue aprobada.');
  });
});

