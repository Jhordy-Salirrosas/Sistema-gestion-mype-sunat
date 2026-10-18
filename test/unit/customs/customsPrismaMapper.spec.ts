import { CustomsDeclarationEntity } from '../../../src/modules/customs/domain/entities/customsDeclarationEntity';
import { CustomsItemEntity } from '../../../src/modules/customs/domain/entities/customsItemEntity';
import type { KardexMovementRecord } from '../../../src/modules/customs/domain/ports/customsRepositoryPort';
import { CustomsPrismaMapper } from '../../../src/modules/customs/infrastructure/persistence/customsPrismaMapper';

describe('CustomsPrismaMapper', () => {
  const dummyDate = new Date('2026-10-15T12:00:00Z');

  describe('toDomainDeclaration', () => {
    it('debe mapear correctamente una fila de base de datos a CustomsDeclarationEntity', () => {
      const row = {
        id: 'decl-123',
        company_id: 'comp-1',
        dua_number: '118-2026-10-001234',
        customs_agency_code: '118',
        regime_code: '10',
        numeration_date: dummyDate,
        fob_value_usd: '10000.00',
        freight_value_usd: '500.00',
        insurance_value_usd: '150.00',
        cif_value_usd: '10650.00',
        exchange_rate: '3.7500',
        cif_value_pen: '39937.50',
        ad_valorem_rate: '6.00',
        ad_valorem_amount_pen: '2396.25',
        igv_rate: '16.00',
        ipm_rate: '2.00',
        igv_ipm_amount_pen: '7620.08',
        perception_rate: '3.50',
        perception_amount_pen: '1748.38',
        total_customs_taxes_pen: '11764.71',
        status: 'LIQUIDADO',
        dua_pdf_storage_url: null,
        created_at: dummyDate,
        updated_at: dummyDate,
      };

      const entity = CustomsPrismaMapper.toDomainDeclaration(row);

      expect(entity).toBeInstanceOf(CustomsDeclarationEntity);
      expect(entity.id).toBe('decl-123');
      expect(entity.fobValueUsd).toBe(10000);
      expect(entity.exchangeRate).toBe(3.75);
      expect(entity.status).toBe('LIQUIDADO');
    });
  });

  describe('toDomainItem', () => {
    it('debe mapear correctamente una fila de ítem a CustomsItemEntity', () => {
      const row = {
        id: 'item-1',
        declaration_id: 'decl-123',
        item_order: 1,
        hs_code: '8471300000',
        commercial_description: 'Laptop Gamer',
        quantity: '5.0000',
        unit_code: 'NIU',
        fob_unit_usd: '2000.0000',
        fob_total_usd: '10000.00',
        allocated_cif_pen: '39937.50',
        allocated_duties_pen: '2396.25',
        landed_cost_unit_pen: '8466.7500',
      };

      const entity = CustomsPrismaMapper.toDomainItem(row, 'LAP-001');

      expect(entity).toBeInstanceOf(CustomsItemEntity);
      expect(entity.itemCode).toBe('LAP-001');
      expect(entity.quantity).toBe(5);
      expect(entity.landedCostUnitPen).toBe(8466.75);
    });
  });

  describe('toDomainSummary', () => {
    it('debe mapear un resumen de declaración para el Dashboard', () => {
      const summaryRow = {
        id: 'decl-123',
        dua_number: '118-2026-10-001234',
        customs_agency_code: '118',
        numeration_date: dummyDate,
        cif_value_usd: '10650.00',
        cif_value_pen: '39937.50',
        total_customs_taxes_pen: '11764.71',
        status: 'LIQUIDADO',
        _count: { items: 2 },
        created_at: dummyDate,
      };

      const summary = CustomsPrismaMapper.toDomainSummary(summaryRow);

      expect(summary.duaNumber).toBe('118-2026-10-001234');
      expect(summary.itemsCount).toBe(2);
      expect(summary.totalCustomsTaxesPen).toBe(11764.71);
    });
  });

  describe('toDomainKardex', () => {
    it('debe mapear una fila de Kardex a KardexMovementRecord', () => {
      const kardexRow = {
        id: 'kardex-1',
        company_id: 'comp-1',
        movement_date: dummyDate,
        movement_type: 'INGRESO_IMPORTACION',
        item_code: 'LAP-001',
        description: 'Laptop Gamer',
        source_reference_id: 'decl-123',
        quantity_in: '5.0000',
        unit_cost_in: '8466.7500',
        total_cost_in: '42333.75',
        quantity_out: '0.0000',
        unit_cost_out: '0.0000',
        total_cost_out: '0.00',
        final_stock_quantity: '15.0000',
        final_average_unit_cost: '8300.0000',
        final_total_inventory_value: '124500.00',
        created_at: dummyDate,
      };

      const record = CustomsPrismaMapper.toDomainKardex(kardexRow);

      expect(record.itemCode).toBe('LAP-001');
      expect(record.quantityIn).toBe(5);
      expect(record.finalStockQuantity).toBe(15);
      expect(record.movementType).toBe('INGRESO_IMPORTACION');
    });
  });

  describe('toPrismaDeclarationCreate', () => {
    it('debe convertir una entidad de dominio en el objeto de inserción para Prisma', () => {
      const entity = new CustomsDeclarationEntity({
        companyId: 'comp-1',
        duaNumber: '118-2026-10-001234',
        customsAgencyCode: '118',
        regimeCode: '10',
        numerationDate: dummyDate,
        fobValueUsd: 10000,
        freightValueUsd: 500,
        insuranceValueUsd: 150,
        cifValueUsd: 10650,
        exchangeRate: 3.75,
        cifValuePen: 39937.5,
        adValoremRate: 6,
        adValoremAmountPen: 2396.25,
        igvRate: 16,
        ipmRate: 2,
        igvIpmAmountPen: 7620.08,
        perceptionRate: 3.5,
        perceptionAmountPen: 1748.38,
        totalCustomsTaxesPen: 11764.71,
        status: 'LIQUIDADO',
      });

      const prismaData = CustomsPrismaMapper.toPrismaDeclarationCreate(entity);

      expect(prismaData.company_id).toBe('comp-1');
      expect(prismaData.dua_number).toBe('118-2026-10-001234');
      expect(prismaData.regime_code).toBe('10');
      expect(prismaData.cif_value_pen).toBe(39937.5);
      expect(prismaData.status).toBe('LIQUIDADO');
    });
  });

  describe('toPrismaItemCreate', () => {
    it('debe convertir una entidad de ítem en el objeto de inserción para Prisma', () => {
      const item = new CustomsItemEntity({
        declarationId: 'decl-123',
        itemOrder: 1,
        itemCode: 'LAP-001',
        hsCode: '8471300000',
        commercialDescription: 'Laptop Gamer',
        quantity: 5,
        unitCode: 'NIU',
        fobUnitUsd: 2000,
        fobTotalUsd: 10000,
        allocatedCifPen: 39937.5,
        allocatedDutiesPen: 2396.25,
        landedCostUnitPen: 8466.75,
      });

      const prismaItem = CustomsPrismaMapper.toPrismaItemCreate(item, 'decl-123');

      expect(prismaItem.declaration_id).toBe('decl-123');
      expect(prismaItem.item_order).toBe(1);
      expect(prismaItem.fob_total_usd).toBe(10000);
      expect(prismaItem.landed_cost_unit_pen).toBe(8466.75);
    });
  });

  describe('toPrismaKardexCreate', () => {
    it('debe convertir un registro de Kardex en el objeto de inserción para Prisma', () => {
      const movement: KardexMovementRecord = {
        companyId: 'comp-1',
        movementDate: dummyDate,
        movementType: 'INGRESO_IMPORTACION',
        itemCode: 'LAP-001',
        description: 'Laptop Gamer',
        quantityIn: 5,
        unitCostIn: 8466.75,
        totalCostIn: 42333.75,
        quantityOut: 0,
        unitCostOut: 0,
        totalCostOut: 0,
        finalStockQuantity: 15,
        finalAverageUnitCost: 8300,
        finalTotalInventoryValue: 124500,
      };

      const prismaData = CustomsPrismaMapper.toPrismaKardexCreate(movement, 'decl-123');

      expect(prismaData.company_id).toBe('comp-1');
      expect(prismaData.source_reference_id).toBe('decl-123');
      expect(prismaData.final_stock_quantity).toBe(15);
      expect(prismaData.movement_type).toBe('INGRESO_IMPORTACION');
    });
  });
});
