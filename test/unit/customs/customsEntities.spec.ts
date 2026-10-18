import { CustomsDeclarationEntity } from '../../../src/modules/customs/domain/entities/customsDeclarationEntity';
import { CustomsItemEntity } from '../../../src/modules/customs/domain/entities/customsItemEntity';

describe('Customs Entities', () => {
  describe('CustomsItemEntity', () => {
    it('debe inicializarse con todas las propiedades y aplicar valores por defecto', () => {
      const item = new CustomsItemEntity({
        id: 'item-1',
        declarationId: 'decl-1',
        itemOrder: 1,
        seriesOrder: 1,
        productCode: 'PROD-001',
        itemCode: 'ITEM-LAPTOP',
        hsCode: '8471300000',
        commercialDescription: 'Laptops Core i7',
        goodsState: 'NUEVO',
        quantity: 100,
        unitCode: 'NIU',
        netWeightKg: 220.5,
        grossWeightKg: 250.0,
        fobUnitUsd: 1000,
        fobTotalUsd: 100000,
        allocatedCifPen: 385000,
        allocatedDutiesPen: 15400,
        landedCostUnitPen: 4004,
      });

      expect(item.id).toBe('item-1');
      expect(item.declarationId).toBe('decl-1');
      expect(item.itemOrder).toBe(1);
      expect(item.seriesOrder).toBe(1);
      expect(item.productCode).toBe('PROD-001');
      expect(item.itemCode).toBe('ITEM-LAPTOP');
      expect(item.hsCode).toBe('8471300000');
      expect(item.commercialDescription).toBe('Laptops Core i7');
      expect(item.goodsState).toBe('NUEVO');
      expect(item.quantity).toBe(100);
      expect(item.unitCode).toBe('NIU');
      expect(item.netWeightKg).toBe(220.5);
      expect(item.grossWeightKg).toBe(250.0);
      expect(item.fobUnitUsd).toBe(1000);
      expect(item.fobTotalUsd).toBe(100000);
      expect(item.allocatedCifPen).toBe(385000);
      expect(item.allocatedDutiesPen).toBe(15400);
      expect(item.allocatedLocalCostPen).toBe(0);
      expect(item.landedCostUnitPen).toBe(4004);
      expect(item.finalLandedCostUnitPen).toBe(4004);

      const primitives = item.toPrimitives();
      expect(primitives.hsCode).toBe('8471300000');
      expect(primitives.quantity).toBe(100);
    });

    it('debe respetar allocatedLocalCostPen y finalLandedCostUnitPen personalizados', () => {
      const item = new CustomsItemEntity({
        itemOrder: 2,
        hsCode: '8471300000',
        commercialDescription: 'Laptop Custom',
        quantity: 10,
        unitCode: 'NIU',
        fobUnitUsd: 500,
        fobTotalUsd: 5000,
        allocatedCifPen: 19000,
        allocatedDutiesPen: 760,
        allocatedLocalCostPen: 500,
        landedCostUnitPen: 1976,
        finalLandedCostUnitPen: 2026,
      });

      expect(item.allocatedLocalCostPen).toBe(500);
      expect(item.finalLandedCostUnitPen).toBe(2026);
    });
  });

  describe('CustomsDeclarationEntity', () => {
    it('debe inicializarse y exponer todos los getters correctamente', () => {
      const date = new Date('2026-03-15T10:00:00.000Z');
      const item = new CustomsItemEntity({
        itemOrder: 1,
        hsCode: '8471300000',
        commercialDescription: 'Item 1',
        quantity: 10,
        unitCode: 'NIU',
        fobUnitUsd: 100,
        fobTotalUsd: 1000,
        allocatedCifPen: 3800,
        allocatedDutiesPen: 152,
        landedCostUnitPen: 395.2,
      });

      const decl = new CustomsDeclarationEntity({
        id: 'decl-123',
        companyId: 'comp-1',
        shipmentId: 'ship-1',
        duaNumber: '118-2026-10-123456',
        customsAgencyCode: '118',
        regimeCode: '10',
        dispatchMode: 'ANTICIPADO',
        channel: 'VERDE',
        transportDocNumber: 'BL-999',
        manifestNumber: 'MAN-2026-44',
        numerationDate: date,
        fobValueUsd: 1000,
        freightValueUsd: 100,
        insuranceValueUsd: 20,
        cifValueUsd: 1120,
        exchangeRate: 3.75,
        cifValuePen: 4200,
        adValoremRate: 0.04,
        adValoremAmountPen: 168,
        igvRate: 0.16,
        ipmRate: 0.02,
        igvIpmAmountPen: 786.24,
        perceptionRate: 0.035,
        perceptionAmountPen: 179.0,
        totalCustomsTaxesPen: 1133.24,
        status: 'REGISTRADO',
        duaPdfStorageUrl: 'https://storage.bucket/dam.pdf',
        items: [item],
        createdAt: date,
        updatedAt: date,
      });

      expect(decl.id).toBe('decl-123');
      expect(decl.companyId).toBe('comp-1');
      expect(decl.shipmentId).toBe('ship-1');
      expect(decl.duaNumber).toBe('118-2026-10-123456');
      expect(decl.customsAgencyCode).toBe('118');
      expect(decl.regimeCode).toBe('10');
      expect(decl.dispatchMode).toBe('ANTICIPADO');
      expect(decl.channel).toBe('VERDE');
      expect(decl.transportDocNumber).toBe('BL-999');
      expect(decl.manifestNumber).toBe('MAN-2026-44');
      expect(decl.numerationDate).toBe(date);
      expect(decl.fobValueUsd).toBe(1000);
      expect(decl.freightValueUsd).toBe(100);
      expect(decl.insuranceValueUsd).toBe(20);
      expect(decl.cifValueUsd).toBe(1120);
      expect(decl.exchangeRate).toBe(3.75);
      expect(decl.cifValuePen).toBe(4200);
      expect(decl.adValoremRate).toBe(0.04);
      expect(decl.adValoremAmountPen).toBe(168);
      expect(decl.igvRate).toBe(0.16);
      expect(decl.ipmRate).toBe(0.02);
      expect(decl.igvIpmAmountPen).toBe(786.24);
      expect(decl.perceptionRate).toBe(0.035);
      expect(decl.perceptionAmountPen).toBe(179.0);
      expect(decl.totalCustomsTaxesPen).toBe(1133.24);
      expect(decl.status).toBe('REGISTRADO');
      expect(decl.duaPdfStorageUrl).toBe('https://storage.bucket/dam.pdf');
      expect(decl.createdAt).toBe(date);
      expect(decl.updatedAt).toBe(date);
      expect(decl.items.length).toBe(1);

      const newItem = new CustomsItemEntity({
        itemOrder: 2,
        hsCode: '8471300000',
        commercialDescription: 'Item 2',
        quantity: 5,
        unitCode: 'NIU',
        fobUnitUsd: 50,
        fobTotalUsd: 250,
        allocatedCifPen: 950,
        allocatedDutiesPen: 38,
        landedCostUnitPen: 98.8,
      });

      decl.addItem(newItem);
      expect(decl.items.length).toBe(2);

      const primitives = decl.toPrimitives();
      expect(primitives.duaNumber).toBe('118-2026-10-123456');
      expect(primitives.items?.length).toBe(2);
    });
  });
});
