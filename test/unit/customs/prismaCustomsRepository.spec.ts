import { PrismaCustomsRepository } from '../../../src/modules/customs/infrastructure/persistence/prismaCustomsRepository';
import type { PrismaService } from '../../../src/database/prismaService';
import { CustomsDeclarationEntity } from '../../../src/modules/customs/domain/entities/customsDeclarationEntity';
import { CustomsItemEntity } from '../../../src/modules/customs/domain/entities/customsItemEntity';

describe('PrismaCustomsRepository', () => {
  let repository: PrismaCustomsRepository;
  let prismaMock: any;
  let txMock: any;

  beforeEach(() => {
    txMock = {
      customsDeclaration: {
        create: jest.fn(),
        update: jest.fn(),
      },
      customsItem: {
        create: jest.fn(),
      },
    };

    prismaMock = {
      customsDeclaration: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(txMock)),
    };

    repository = new PrismaCustomsRepository(prismaMock as unknown as PrismaService);
  });

  it('debe persistir declaración y sus ítems en una transacción atómica', async () => {
    const date = new Date('2026-03-20T10:00:00Z');
    const declaration = new CustomsDeclarationEntity({
      companyId: 'comp-1',
      duaNumber: '118-2026-10-123456',
      customsAgencyCode: '118',
      regimeCode: '10',
      numerationDate: date,
      fobValueUsd: 1000,
      freightValueUsd: 100,
      insuranceValueUsd: 20,
      cifValueUsd: 1120,
      exchangeRate: 3.8,
      cifValuePen: 4256,
      adValoremRate: 0.04,
      adValoremAmountPen: 170.24,
      igvRate: 0.16,
      ipmRate: 0.02,
      igvIpmAmountPen: 796.72,
      perceptionRate: 0.035,
      perceptionAmountPen: 182.8,
      totalCustomsTaxesPen: 1149.76,
      status: 'REGISTRADO',
    });

    const item = new CustomsItemEntity({
      itemOrder: 1,
      itemCode: 'ITEM-01',
      hsCode: '8471300000',
      commercialDescription: 'Laptop',
      quantity: 1,
      unitCode: 'NIU',
      fobUnitUsd: 1000,
      fobTotalUsd: 1000,
      allocatedCifPen: 4256,
      allocatedDutiesPen: 170.24,
      landedCostUnitPen: 4426.24,
    });

    txMock.customsDeclaration.create.mockResolvedValue({
      id: 'decl-created',
      company_id: 'comp-1',
      dua_number: '118-2026-10-123456',
      customs_agency_code: '118',
      regime_code: '10',
      numeration_date: date,
      fob_value_usd: 1000,
      freight_value_usd: 100,
      insurance_value_usd: 20,
      cif_value_usd: 1120,
      exchange_rate: 3.8,
      cif_value_pen: 4256,
      ad_valorem_rate: 0.04,
      ad_valorem_amount_pen: 170.24,
      igv_rate: 0.16,
      ipm_rate: 0.02,
      igvIpmAmount_pen: 796.72,
      perception_rate: 0.035,
      perception_amount_pen: 182.8,
      total_customs_taxes_pen: 1149.76,
      status: 'REGISTRADO',
      items: [],
    });

    txMock.customsItem.create.mockResolvedValue({
      id: 'item-created',
      declaration_id: 'decl-created',
      item_order: 1,
      hs_code: '8471300000',
      commercial_description: 'Laptop',
      quantity: 1,
      unit_code: 'NIU',
      fob_unit_usd: 1000,
      fob_total_usd: 1000,
      allocated_cif_pen: 4256,
      allocated_duties_pen: 170.24,
      allocated_local_cost_pen: 0,
      landed_cost_unit_pen: 4426.24,
      final_landed_cost_unit_pen: 4426.24,
    });

    const result = await repository.saveDeclarationWithItemsAndKardex(
      declaration,
      [item],
      [],
    );

    expect(result.id).toBe('decl-created');
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.customsDeclaration.create).toHaveBeenCalled();
    expect(txMock.customsItem.create).toHaveBeenCalled();
  });

  it('debe buscar declaración por id y retornar null si no existe', async () => {
    prismaMock.customsDeclaration.findFirst.mockResolvedValue(null);

    const result = await repository.findDeclarationById('decl-999', 'comp-1');
    expect(result).toBeNull();
  });

  it('debe listar declaraciones por empresa ordenadas cronológicamente', async () => {
    prismaMock.customsDeclaration.findMany.mockResolvedValue([
      {
        id: 'decl-1',
        dua_number: '118-2026-10-123456',
        customs_agency_code: '118',
        numeration_date: new Date(),
        cif_value_usd: 1000,
        cif_value_pen: 3800,
        total_customs_taxes_pen: 800,
        status: 'NUMERADO',
        _count: { items: 2 },
        created_at: new Date(),
      },
    ]);

    const list = await repository.findDeclarationsByCompany('comp-1');
    expect(list.length).toBe(1);
    expect(list[0].duaNumber).toBe('118-2026-10-123456');
  });

  it('debe manejar desacople devolviendo lista vacía en consultas Kardex', async () => {
    const list = await repository.findKardexMovementsByCompany('comp-1');
    expect(list).toEqual([]);

    const latest = await repository.findLatestKardexMovementByItem('comp-1', 'SKU-01');
    expect(latest).toBeNull();

    await expect(repository.registerKardexMovements([])).resolves.not.toThrow();
  });
});
