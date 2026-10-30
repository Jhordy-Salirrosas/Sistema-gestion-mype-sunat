import {
  GoodsReceiptEntity,
  GoodsReceiptItemEntity,
} from '../../../src/modules/customs/domain/entities/goodsReceiptEntity';

describe('GoodsReceiptEntity (Domain Entity)', () => {
  it('debe crear un acta de recepción conforme cuando no hay discrepancias ni averías', () => {
    const item1 = new GoodsReceiptItemEntity({
      productCode: 'LAP-ASUS-16',
      commercialDescription: 'Laptop Gamer Asus',
      declaredQuantity: 50,
      receivedQuantity: 50,
      damagedQuantity: 0,
      unitCode: 'NIU',
      destinationType: 'MERCADERIA',
    });

    const receipt = new GoodsReceiptEntity({
      companyId: 'company-01',
      receiptNumber: 'REC-2026-0001',
      declarationId: 'decl-01',
      responsibleName: 'Carlos Recepción',
      items: [item1],
    });

    expect(receipt.status).toBe('CONFORME');
    expect(receipt.hasDiscrepancies()).toBe(false);
    expect(receipt.getCommercialConformingItems()).toHaveLength(1);
    expect(receipt.getFixedAssetConformingItems()).toHaveLength(0);
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

