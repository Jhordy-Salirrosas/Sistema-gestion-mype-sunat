import { CustomsSettlementEntity } from '../../../src/modules/customs/domain/entities/customsSettlementEntity';
import { CustomsShipmentEntity } from '../../../src/modules/customs/domain/entities/customsShipmentEntity';
import { CustomsSeriesEntity } from '../../../src/modules/customs/domain/entities/customsSeriesEntity';
import { CustomsSirePurchasesController } from '../../../src/modules/customs/infrastructure/controllers/customsSirePurchasesController';
import { UnauthorizedException } from '@nestjs/common';

describe('Remaining Customs Entities & Controllers Coverage', () => {
  describe('CustomsSettlementEntity', () => {
    const dueDate = new Date('2026-11-01T00:00:00.000Z');

    it('debe exponer todos los getters y valores por defecto', () => {
      const settlement = new CustomsSettlementEntity({
        id: 'settle-1',
        declarationId: 'decl-1',
        settlementType: 'TIPO_0010_DECLARACION',
        settlementNumber: '0010-2026-0001',
        taxCode: 'TAX-01',
        amountUsd: 1500,
        amountPen: 5700,
        cdaNumber: '01182600012345',
        dueDate,
        status: 'GENERADA',
      });

      expect(settlement.id).toBe('settle-1');
      expect(settlement.declarationId).toBe('decl-1');
      expect(settlement.settlementType).toBe('TIPO_0010_DECLARACION');
      expect(settlement.settlementNumber).toBe('0010-2026-0001');
      expect(settlement.taxCode).toBe('TAX-01');
      expect(settlement.amountUsd).toBe(1500);
      expect(settlement.amountPen).toBe(5700);
      expect(settlement.cdaNumber).toBe('01182600012345');
      expect(settlement.dueDate).toBe(dueDate);
      expect(settlement.status).toBe('GENERADA');
      expect(settlement.paidAt).toBeUndefined();
      expect(settlement.bankCode).toBeUndefined();
      expect(settlement.bankOperationNumber).toBeUndefined();
      expect(settlement.voucherStorageUrl).toBeUndefined();
      expect(settlement.isPaid()).toBe(false);
      expect(settlement.isGuaranteed()).toBe(false);

      const pastDate = new Date('2026-12-01T00:00:00.000Z');
      expect(settlement.isOverdue(pastDate)).toBe(true);

      const primitives = settlement.toPrimitives();
      expect(primitives.settlementNumber).toBe('0010-2026-0001');
    });

    it('debe procesar el pago correctamente y rechazar doble pago', () => {
      const settlement = new CustomsSettlementEntity({
        declarationId: 'decl-1',
        settlementType: 'TIPO_0010_DECLARACION',
        settlementNumber: '0010-2026-0002',
        taxCode: 'TAX-01',
        amountPen: 1000,
        dueDate,
        status: 'GENERADA',
      });

      settlement.pay({
        bankCode: '002',
        bankOperationNumber: 'OP-9988',
        voucherStorageUrl: 'https://voucher.pdf',
      });

      expect(settlement.isPaid()).toBe(true);
      expect(settlement.bankCode).toBe('002');
      expect(settlement.bankOperationNumber).toBe('OP-9988');
      expect(settlement.voucherStorageUrl).toBe('https://voucher.pdf');

      expect(() =>
        settlement.pay({
          bankCode: '002',
          bankOperationNumber: 'OP-9988',
        }),
      ).toThrow('La liquidación aduanera ya se encuentra cancelada.');
    });

    it('debe aplicar garantía y rechazar si ya está pagada', () => {
      const settlement = new CustomsSettlementEntity({
        declarationId: 'decl-1',
        settlementType: 'TIPO_0010_DECLARACION',
        settlementNumber: '0010-2026-0003',
        taxCode: 'TAX-01',
        amountPen: 2000,
        dueDate,
        status: 'GENERADA',
      });

      settlement.applyGuarantee();
      expect(settlement.isGuaranteed()).toBe(true);

      const paidSettlement = new CustomsSettlementEntity({
        declarationId: 'decl-1',
        settlementType: 'TIPO_0010_DECLARACION',
        settlementNumber: '0010-2026-0004',
        taxCode: 'TAX-01',
        amountPen: 2000,
        dueDate,
        status: 'PAGADA',
      });

      expect(() => paidSettlement.applyGuarantee()).toThrow(
        'No se puede garantizar una liquidación que ya fue pagada.',
      );
    });
  });

  describe('CustomsShipmentEntity', () => {
    it('debe arrojar error si ETA es menor que ETD', () => {
      expect(
        () =>
          new CustomsShipmentEntity({
            companyId: 'comp-1',
            shipmentNumber: 'EXP-001',
            incoterm: 'FOB',
            currencyCode: 'USD',
            transportMode: 'MARITIMO',
            originCountryCode: 'CN',
            destinationCustoms: '118',
            status: 'BORRADOR',
            etdDate: new Date('2026-06-10'),
            etaDate: new Date('2026-06-05'),
          }),
      ).toThrow('La fecha estimada de arribo (ETA) no puede ser anterior al zarpe (ETD).');
    });

    it('debe exponer propiedades y actualizar estado', () => {
      const shipment = new CustomsShipmentEntity({
        id: 'ship-10',
        companyId: 'comp-1',
        shipmentNumber: 'EXP-2026-0010',
        incoterm: 'CIF',
        currencyCode: 'USD',
        transportMode: 'AEREO',
        originCountryCode: 'US',
        destinationCustoms: '235',
        status: 'EN_TRANSITO',
        isObserved: false,
      });

      expect(shipment.id).toBe('ship-10');
      expect(shipment.companyId).toBe('comp-1');
      expect(shipment.shipmentNumber).toBe('EXP-2026-0010');
      expect(shipment.incoterm).toBe('CIF');
      expect(shipment.currencyCode).toBe('USD');
      expect(shipment.transportMode).toBe('AEREO');
      expect(shipment.originCountryCode).toBe('US');
      expect(shipment.destinationCustoms).toBe('235');
      expect(shipment.status).toBe('EN_TRANSITO');
      expect(shipment.isObserved).toBe(false);

      shipment.updateStatus('CON_LEVANTE');
      expect(shipment.status).toBe('CON_LEVANTE');

      shipment.markObserved(true);
      expect(shipment.isObserved).toBe(true);

      const primitives = shipment.toPrimitives();
      expect(primitives.shipmentNumber).toBe('EXP-2026-0010');

      shipment.updateStatus('CERRADO');
      expect(() => shipment.updateStatus('EN_DESPACHO')).toThrow(
        'No se puede modificar un expediente en estado CERRADO.',
      );
    });
  });

  describe('CustomsSeriesEntity', () => {
    it('debe determinar correctamente si es mercadería o activo fijo', () => {
      const seriesMercaderia = new CustomsSeriesEntity({
        seriesNumber: 1,
        itemOrder: 1,
        hsCode: '8471300000',
        commercialDescription: 'Laptop Gamer',
        quantity: 10,
        unitCode: 'NIU',
        fobUnitUsd: 1000,
        fobTotalUsd: 10000,
        allocatedCifPen: 38000,
        allocatedDutiesPen: 1520,
        landedCostUnitPen: 3952,
        destinationType: 'MERCADERIA',
      });

      expect(seriesMercaderia.seriesNumber).toBe(1);
      expect(seriesMercaderia.isMercaderia).toBe(true);
      expect(seriesMercaderia.isActivoFijo).toBe(false);

      const seriesActivo = new CustomsSeriesEntity({
        itemOrder: 2,
        hsCode: '8471410000',
        commercialDescription: 'Servidor Rack',
        quantity: 1,
        unitCode: 'NIU',
        fobUnitUsd: 5000,
        fobTotalUsd: 5000,
        allocatedCifPen: 19000,
        allocatedDutiesPen: 760,
        landedCostUnitPen: 19760,
        destinationType: 'ACTIVO_FIJO',
      });

      expect(seriesActivo.seriesNumber).toBe(2);
      expect(seriesActivo.isMercaderia).toBe(false);
      expect(seriesActivo.isActivoFijo).toBe(true);
    });
  });

  describe('CustomsSirePurchasesController', () => {
    let controller: CustomsSirePurchasesController;
    let customsRepoMock: any;
    let prismaMock: any;

    beforeEach(() => {
      customsRepoMock = {
        findDeclarationsByCompany: jest.fn().mockResolvedValue([
          {
            id: 'decl-1',
            duaNumber: '118-2026-10-048291',
            cifValuePen: 200000,
            adValoremAmountPen: 8000,
            igvIpmAmountPen: 37440,
            perceptionAmountPen: 8590,
            totalCustomsTaxesPen: 54030,
            numerationDate: new Date('2026-10-15'),
            channel: 'VERDE',
            items: [],
          },
        ]),
      };

      prismaMock = {
        company: {
          findUnique: jest.fn().mockResolvedValue({ ruc: '20601012341' }),
        },
      };

      controller = new CustomsSirePurchasesController(customsRepoMock, prismaMock);
    });

    it('debe rechazar getSirePurchasesRecords si no hay companyId', async () => {
      await expect(controller.getSirePurchasesRecords(undefined, '202610')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe ejecutar getSirePurchasesRecords con parseo de enteros', async () => {
      const res = await controller.getSirePurchasesRecords('comp-1', '202610');
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBe(1);
      expect(res[0].period).toBe('202610');
      expect(res[0].customs_code).toBe('118');
    });

    it('debe rechazar exportSirePurchases si no hay companyId', async () => {
      await expect(
        controller.exportSirePurchases(undefined, '2026', '10'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe exportar archivo TXT de SIRE 8.4 correctamente', async () => {
      const result = await controller.exportSirePurchases('comp-1', '2026', '10');
      expect(result.period).toBe('202610');
      expect(result.recordsCount).toBe(1);
      expect(result.ruc).toBe('20601012341');
      expect(result.fileName).toContain('LE20601012341');
    });
  });
});
