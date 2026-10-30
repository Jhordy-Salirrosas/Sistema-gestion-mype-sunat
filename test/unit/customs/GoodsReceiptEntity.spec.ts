import {
  GoodsReceiptEntity,
  GoodsReceiptItemEntity,
} from '../../../src/modules/customs/domain/entities/goodsReceiptEntity';

describe('GoodsReceiptEntity (Domain Entity)', () => {
  it('debe arrojar error si declaredQuantity o receivedQuantity son negativas', () => {
    expect(
      () =>
        new GoodsReceiptItemEntity({
          productCode: 'PROD-01',
          commercialDescription: 'Desc',
          declaredQuantity: -5,
          receivedQuantity: 10,
        }),
    ).toThrow('Las cantidades declaradas o recibidas no pueden ser negativas.');

    expect(
      () =>
        new GoodsReceiptItemEntity({
          productCode: 'PROD-01',
          commercialDescription: 'Desc',
          declaredQuantity: 10,
          receivedQuantity: -1,
        }),
    ).toThrow('Las cantidades declaradas o recibidas no pueden ser negativas.');
  });

  it('debe crear un acta de recepción conforme cuando no hay discrepancias ni averías', () => {
    const item1 = new GoodsReceiptItemEntity({
      id: 'item-1',
      goodsReceiptId: 'rec-1',
      customsItemId: 'c-item-1',
      productCode: 'LAP-ASUS-16',
      commercialDescription: 'Laptop Gamer Asus',
      declaredQuantity: 50,
      receivedQuantity: 50,
      damagedQuantity: 0,
      unitCode: 'NIU',
      destinationType: 'MERCADERIA',
    });

    expect(item1.id).toBe('item-1');
    expect(item1.productCode).toBe('LAP-ASUS-16');
    expect(item1.commercialDescription).toBe('Laptop Gamer Asus');
    expect(item1.declaredQuantity).toBe(50);
    expect(item1.receivedQuantity).toBe(50);
    expect(item1.damagedQuantity).toBe(0);
    expect(item1.differenceQuantity).toBe(0);
    expect(item1.discrepancyReason).toBeUndefined();
    expect(item1.unitCode).toBe('NIU');
    expect(item1.destinationType).toBe('MERCADERIA');
    expect(item1.isMercaderia).toBe(true);
    expect(item1.isActivoFijo).toBe(false);

    const primitives = item1.toPrimitives();
    expect(primitives.productCode).toBe('LAP-ASUS-16');

    const receipt = new GoodsReceiptEntity({
      id: 'rec-01',
      companyId: 'company-01',
      receiptNumber: 'REC-2026-0001',
      declarationId: 'decl-01',
      shipmentId: 'ship-01',
      warehouseCode: 'ALM-01',
      receptionDate: new Date('2026-10-15'),
      receptionType: 'TOTAL',
      responsibleName: 'Carlos Recepción',
      responsibleDni: '12345678',
      items: [item1],
    });

    expect(receipt.id).toBe('rec-01');
    expect(receipt.companyId).toBe('company-01');
    expect(receipt.receiptNumber).toBe('REC-2026-0001');
    expect(receipt.declarationId).toBe('decl-01');
    expect(receipt.shipmentId).toBe('ship-01');
    expect(receipt.warehouseCode).toBe('ALM-01');
    expect(receipt.receptionType).toBe('TOTAL');
    expect(receipt.responsibleName).toBe('Carlos Recepción');
    expect(receipt.status).toBe('CONFORME');
    expect(receipt.hasDiscrepancies()).toBe(false);
    expect(receipt.getCommercialConformingItems()).toHaveLength(1);
    expect(receipt.getFixedAssetConformingItems()).toHaveLength(0);
    expect(receipt.items).toHaveLength(1);

    const receiptPrimitives = receipt.toPrimitives();
    expect(receiptPrimitives.receiptNumber).toBe('REC-2026-0001');
  });

  it('debe clasificar como CON_DISCREPANCIA si hay faltantes o mercancía dañada', () => {
    const itemWithFaltante = new GoodsReceiptItemEntity({
      productCode: 'LAP-ASUS-16',
      commercialDescription: 'Laptop Gamer Asus',
      declaredQuantity: 50,
      receivedQuantity: 48,
      damagedQuantity: 2,
      discrepancyReason: 'FALTANTE_ORIGEN',
      unitCode: 'NIU',
      destinationType: 'MERCADERIA',
    });

    const receipt = new GoodsReceiptEntity({
      companyId: 'company-01',
      receiptNumber: 'REC-2026-0002',
      declarationId: 'decl-01',
      responsibleName: 'Carlos Recepción',
      items: [itemWithFaltante],
    });

    expect(receipt.status).toBe('CON_DISCREPANCIA');
    expect(receipt.hasDiscrepancies()).toBe(true);
    expect(itemWithFaltante.differenceQuantity).toBe(-2);
    expect(itemWithFaltante.damagedQuantity).toBe(2);
    expect(itemWithFaltante.discrepancyReason).toBe('FALTANTE_ORIGEN');
  });

  it('debe separar mercancías comerciales de bienes de activo fijo', () => {
    const mercaderia = new GoodsReceiptItemEntity({
      productCode: 'PROD-01',
      commercialDescription: 'Insumo Comercial',
      declaredQuantity: 100,
      receivedQuantity: 100,
      destinationType: 'MERCADERIA',
    });

    const activoFijo = new GoodsReceiptItemEntity({
      productCode: 'ACT-01',
      commercialDescription: 'Servidor para Rack',
      declaredQuantity: 1,
      receivedQuantity: 1,
      destinationType: 'ACTIVO_FIJO',
    });

    const receipt = new GoodsReceiptEntity({
      companyId: 'company-01',
      receiptNumber: 'REC-2026-0003',
      declarationId: 'decl-02',
      responsibleName: 'Carlos Recepción',
      items: [mercaderia, activoFijo],
    });

    expect(receipt.getCommercialConformingItems()).toHaveLength(1);
    expect(receipt.getFixedAssetConformingItems()).toHaveLength(1);
  });
});
