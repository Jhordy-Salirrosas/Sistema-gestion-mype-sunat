import {
  LandedCostSheetEntity,
  LandedCostItemEntity,
} from '../../../src/modules/customs/domain/entities/landedCostSheetEntity';

describe('LandedCostSheetEntity (Domain Entity)', () => {
  it('debe exponer todas las propiedades y métodos de LandedCostItemEntity', () => {
    const item = new LandedCostItemEntity({
      id: 'item-1',
      landedCostSheetId: 'sheet-1',
      customsItemId: 'customs-item-1',
      productCode: 'PROD-A',
      commercialDescription: 'Producto Mercaderia',
      quantity: 100,
      fobUnitUsd: 10,
      fobTotalUsd: 1000,
      grossWeightKg: 50,
      allocatedFreightPen: 100,
      allocatedInsurancePen: 50,
      allocatedCifPen: 3800,
      allocatedDutiesPen: 150,
      allocatedLocalExpensesPen: 200,
      totalLandedCostPen: 4300,
      unitLandedCostPen: 43,
      destinationType: 'MERCADERIA',
    });

    expect(item.id).toBe('item-1');
    expect(item.productCode).toBe('PROD-A');
    expect(item.commercialDescription).toBe('Producto Mercaderia');
    expect(item.quantity).toBe(100);
    expect(item.fobTotalUsd).toBe(1000);
    expect(item.allocatedCifPen).toBe(3800);
    expect(item.allocatedDutiesPen).toBe(150);
    expect(item.allocatedLocalExpensesPen).toBe(200);
    expect(item.totalLandedCostPen).toBe(4300);
    expect(item.unitLandedCostPen).toBe(43);
    expect(item.destinationType).toBe('MERCADERIA');
    expect(item.isMercaderia).toBe(true);
    expect(item.isActivoFijo).toBe(false);

    const primitives = item.toPrimitives();
    expect(primitives.productCode).toBe('PROD-A');

    // Item con valores por defecto y Activo Fijo
    const itemActivo = new LandedCostItemEntity({
      productCode: 'ACT-01',
      commercialDescription: 'Servidor',
      quantity: 1,
      fobUnitUsd: 5000,
      fobTotalUsd: 5000,
      allocatedCifPen: 19000,
      allocatedDutiesPen: 0,
      totalLandedCostPen: 19000,
      unitLandedCostPen: 19000,
      destinationType: 'ACTIVO_FIJO',
    });
    expect(itemActivo.allocatedLocalExpensesPen).toBe(0);
    expect(itemActivo.destinationType).toBe('ACTIVO_FIJO');
    expect(itemActivo.isMercaderia).toBe(false);
    expect(itemActivo.isActivoFijo).toBe(true);
  });

  it('debe crear una hoja de costos en borrador y permitir aprobación formal', () => {
    const item1 = new LandedCostItemEntity({
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

    const item2 = new LandedCostItemEntity({
      productCode: 'ACT-01',
      commercialDescription: 'Servidor',
      quantity: 1,
      fobUnitUsd: 2000,
      fobTotalUsd: 2000,
      allocatedCifPen: 7600,
      allocatedDutiesPen: 0,
      totalLandedCostPen: 7600,
      unitLandedCostPen: 7600,
      destinationType: 'ACTIVO_FIJO',
    });

    const sheet = new LandedCostSheetEntity({
      id: 'sheet-01',
      companyId: 'company-01',
      shipmentId: 'ship-01',
      declarationId: 'decl-01',
      totalCifPen: 11400,
      totalDutiesPen: 0,
      totalLocalExpensesPen: 200,
      totalInventoryCostPen: 11600,
      itemsProration: [item1, item2],
    });

    expect(sheet.id).toBe('sheet-01');
    expect(sheet.companyId).toBe('company-01');
    expect(sheet.shipmentId).toBe('ship-01');
    expect(sheet.declarationId).toBe('decl-01');
    expect(sheet.version).toBe(1);
    expect(sheet.status).toBe('BORRADOR');
    expect(sheet.totalCifPen).toBe(11400);
    expect(sheet.totalDutiesPen).toBe(0);
    expect(sheet.totalLocalExpensesPen).toBe(200);
    expect(sheet.totalInventoryCostPen).toBe(11600);
    expect(sheet.isApproved).toBe(false);
    expect(sheet.itemsProration).toHaveLength(2);
    expect(sheet.getCommercialCostItems()).toHaveLength(1);
    expect(sheet.getFixedAssetCostItems()).toHaveLength(1);

    sheet.markForAdjustment();
    expect(sheet.status).toBe('A_AJUSTAR');

    sheet.approve(true);
    expect(sheet.status).toBe('APROBADO');
    expect(sheet.isApproved).toBe(true);

    const primitives = sheet.toPrimitives();
    expect(primitives.shipmentId).toBe('ship-01');
    expect(primitives.itemsProration).toHaveLength(2);
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

    expect(sheet.isApproved).toBe(true);
    expect(() => sheet.approve(true)).toThrow('La hoja de costos ya fue aprobada.');

    const definitivoSheet = new LandedCostSheetEntity({
      companyId: 'company-01',
      shipmentId: 'ship-01',
      totalCifPen: 1000,
      totalDutiesPen: 0,
      totalLocalExpensesPen: 0,
      totalInventoryCostPen: 1000,
      status: 'DEFINITIVO',
    });
    expect(definitivoSheet.isApproved).toBe(true);
  });
});
