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
      kardexMovement: {
        create: jest.fn(),
      },
    };

    prismaMock = {
      customsDeclaration: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      kardexMovement: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(txMock)),
    };

    repository = new PrismaCustomsRepository(prismaMock as unknown as PrismaService);
  });

  it('debe persistir declaración, ítems y movimientos kardex en una transacción atómica', async () => {
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
      igv_ipm_amount_pen: 796.72,
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

    txMock.kardexMovement.create.mockResolvedValue({ id: 'kardex-1' });

    const result = await repository.saveDeclarationWithItemsAndKardex(
      declaration,
      [item],
      [
        {
          companyId: 'comp-1',
          itemCode: 'ITEM-01',
          movementDate: date,
          movementType: 'INGRESO_IMPORTACION',
          description: 'Laptop Core i7',
          quantityIn: 1,
          unitCostIn: 4426.24,
          totalCostIn: 4426.24,
          quantityOut: 0,
          unitCostOut: 0,
          totalCostOut: 0,
          finalStockQuantity: 1,
          finalAverageUnitCost: 4426.24,
          finalTotalInventoryValue: 4426.24,
        },
      ],
    );

    expect(result.id).toBe('decl-created');
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.customsDeclaration.create).toHaveBeenCalled();
    expect(txMock.customsItem.create).toHaveBeenCalled();
    expect(txMock.kardexMovement.create).toHaveBeenCalled();
  });

  it('debe buscar declaración por id y retornar null si no existe', async () => {
    prismaMock.customsDeclaration.findFirst.mockResolvedValue(null);

    const result = await repository.findDeclarationById('decl-999', 'comp-1');
    expect(result).toBeNull();
  });

  it('debe registrar movimientos diferidos en Kardex y actualizar estado de la DAM a APLICADO_KARDEX', async () => {
    txMock.kardexMovement.create.mockResolvedValue({ id: 'k-1' });
    txMock.customsDeclaration.update.mockResolvedValue({ id: 'decl-1' });

    await repository.registerKardexMovements(
      [
        {
          companyId: 'comp-1',
          itemCode: 'ITEM-01',
          movementDate: new Date(),
          movementType: 'INGRESO_IMPORTACION',
          description: 'Laptop Core i7',
          quantityIn: 10,
          unitCostIn: 4000,
          totalCostIn: 40000,
          quantityOut: 0,
          unitCostOut: 0,
          totalCostOut: 0,
          finalStockQuantity: 10,
          finalAverageUnitCost: 4000,
          finalTotalInventoryValue: 40000,
        },
      ],
      'decl-1',
    );

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.kardexMovement.create).toHaveBeenCalledTimes(1);
    expect(txMock.customsDeclaration.update).toHaveBeenCalledWith({
      where: { id: 'decl-1' },
      data: { status: 'APLICADO_KARDEX' },
    });
  });

  it('debe buscar el último movimiento Kardex de un ítem', async () => {
    const now = new Date();
    prismaMock.kardexMovement.findFirst.mockResolvedValue({
      id: 'k-latest',
      company_id: 'comp-1',
      item_code: 'ITEM-01',
      description: 'Laptop Core i7',
      source_reference_id: 'decl-1',
      movement_type: 'INGRESO_IMPORTACION',
      quantity_in: 100,
      unit_cost_in: 4000,
      total_cost_in: 400000,
      quantity_out: 0,
      unit_cost_out: 0,
      total_cost_out: 0,
      final_stock_quantity: 100,
      final_average_unit_cost: 4000,
      final_total_inventory_value: 400000,
      movement_date: now,
      created_at: now,
    });

    const result = await repository.findLatestKardexMovementByItem('comp-1', 'ITEM-01');
    expect(result?.id).toBe('k-latest');
    expect(result?.itemCode).toBe('ITEM-01');
  });

  it('debe retornar null si no hay movimientos previos en Kardex', async () => {
    prismaMock.kardexMovement.findFirst.mockResolvedValue(null);

    const result = await repository.findLatestKardexMovementByItem('comp-1', 'ITEM-NONE');
    expect(result).toBeNull();
  });
});
