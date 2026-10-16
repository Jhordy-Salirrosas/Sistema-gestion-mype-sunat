import { BadRequestException } from '@nestjs/common';
import { RegisterDuaUseCase } from '../../../src/modules/customs/application/use-cases/registerDuaUseCase';
import type { RegisterDuaDto } from '../../../src/modules/customs/application/dto/registerDuaDto';
import type { ICustomsRepositoryPort, KardexMovementRecord } from '../../../src/modules/customs/domain/ports/customsRepositoryPort';
import { CustomsDeclarationEntity } from '../../../src/modules/customs/domain/entities/customsDeclarationEntity';

describe('RegisterDuaUseCase', () => {
  let useCase: RegisterDuaUseCase;
  let mockRepository: jest.Mocked<ICustomsRepositoryPort>;

  const companyId = 'test-company-uuid';

  const validDto: RegisterDuaDto = {
    dua_number: '118-2026-10-001234',
    customs_agency_code: '118',
    regime_code: '10',
    numeration_date: '2026-10-15T12:00:00Z',
    fob_value_usd: 10000,
    freight_value_usd: 500,
    insurance_value_usd: 150,
    exchange_rate: 3.75,
    ad_valorem_rate: 6,
    perception_rate: 3.5,
    items: [
      {
        item_order: 1,
        item_code: 'LAP-001',
        hs_code: '8471300000',
        commercial_description: 'Laptop Gamer',
        quantity: 5,
        unit_code: 'NIU',
        fob_unit_usd: 2000,
      },
    ],
  };

  beforeEach(() => {
    mockRepository = {
      saveDeclarationWithItemsAndKardex: jest.fn(),
      findDeclarationById: jest.fn(),
      findDeclarationsByCompany: jest.fn(),
      findKardexMovementsByCompany: jest.fn(),
      findLatestKardexMovementByItem: jest.fn(),
    };

    useCase = new RegisterDuaUseCase(mockRepository);
  });

  describe('Cálculo de Landed Cost (NIC 2) y Registro de DAM', () => {
    it('debe liquidar la DAM, prorratear el Landed Cost unitario y persistir atómicamente', async () => {
      // CIF USD = 10,000 + 500 + 150 = 10,650
      // CIF PEN = 10,650 * 3.75 = 39,937.50
      // Ad-Valorem PEN (6%) = 39,937.50 * 0.06 = 2,396.25
      // Landed Total = 39,937.50 + 2,396.25 = 42,333.75
      // Landed Cost Unitario = 42,333.75 / 5 = 8,466.75

      mockRepository.findLatestKardexMovementByItem.mockResolvedValue(null);

      mockRepository.saveDeclarationWithItemsAndKardex.mockImplementation(
        async (declaration, items) => {
          return new CustomsDeclarationEntity({
            id: 'saved-dam-id',
            companyId: declaration.companyId,
            duaNumber: declaration.duaNumber,
            customsAgencyCode: declaration.customsAgencyCode,
            regimeCode: declaration.regimeCode,
            numerationDate: declaration.numerationDate,
            fobValueUsd: declaration.fobValueUsd,
            freightValueUsd: declaration.freightValueUsd,
            insuranceValueUsd: declaration.insuranceValueUsd,
            cifValueUsd: declaration.cifValueUsd,
            exchangeRate: declaration.exchangeRate,
            cifValuePen: declaration.cifValuePen,
            adValoremRate: declaration.adValoremRate,
            adValoremAmountPen: declaration.adValoremAmountPen,
            igvRate: declaration.igvRate,
            ipmRate: declaration.ipmRate,
            igvIpmAmountPen: declaration.igvIpmAmountPen,
            perceptionRate: declaration.perceptionRate,
            perceptionAmountPen: declaration.perceptionAmountPen,
            totalCustomsTaxesPen: declaration.totalCustomsTaxesPen,
            status: 'LIQUIDADO',
            items,
          });
        },
      );

      const result = await useCase.execute(validDto, companyId);

      expect(result).toBeDefined();
      expect(result.status).toBe('LIQUIDADO');
      expect(result.cif_value_usd).toBe(10650);
      expect(result.cif_value_pen).toBe(39937.5);
      expect(result.items).toHaveLength(1);

      const item = result.items[0];
      expect(item.allocated_cif_pen).toBe(39937.5);
      expect(item.allocated_duties_pen).toBe(2396.25);
      expect(item.landed_cost_unit_pen).toBe(8466.75);

      expect(mockRepository.saveDeclarationWithItemsAndKardex).toHaveBeenCalledTimes(1);
    });
  });

  describe('Validaciones de Integridad y Cuadre de FOB', () => {
    it('debe arrojar BadRequestException cuando la suma de FOB de los ítems no coincide con el total de cabecera', async () => {
      const invalidFobDto: RegisterDuaDto = {
        ...validDto,
        fob_value_usd: 10000,
        items: [
          {
            item_order: 1,
            item_code: 'LAP-001',
            hs_code: '8471300000',
            commercial_description: 'Laptop',
            quantity: 4,
            unit_code: 'NIU',
            fob_unit_usd: 2000, // 4 * 2000 = 8000 != 10000
          },
        ],
      };

      await expect(useCase.execute(invalidFobDto, companyId)).rejects.toThrow(BadRequestException);
      await expect(useCase.execute(invalidFobDto, companyId)).rejects.toThrow(/FOB sum mismatch/);
      expect(mockRepository.saveDeclarationWithItemsAndKardex).not.toHaveBeenCalled();
    });

    it('debe arrojar BadRequestException cuando el formato del número de DUA es inválido', async () => {
      const invalidDuaDto: RegisterDuaDto = {
        ...validDto,
        dua_number: '118-INVALIDO',
      };

      await expect(useCase.execute(invalidDuaDto, companyId)).rejects.toThrow(BadRequestException);
      expect(mockRepository.saveDeclarationWithItemsAndKardex).not.toHaveBeenCalled();
    });
  });

  describe('Actualización de Kardex Permanente (Promedio Ponderado Móvil)', () => {
    it('debe calcular el nuevo costo promedio ponderado si ya existía saldo anterior en inventario', async () => {
      // Saldo previo: 10 unidades a S/ 8,000.00 c/u = S/ 80,000.00
      const previousKardex: KardexMovementRecord = {
        id: 'kardex-prev-1',
        companyId,
        movementDate: new Date('2026-10-01'),
        movementType: 'INGRESO_IMPORTACION',
        itemCode: 'LAP-001',
        description: 'Laptop Gamer',
        quantityIn: 10,
        unitCostIn: 8000,
        totalCostIn: 80000,
        quantityOut: 0,
        unitCostOut: 0,
        totalCostOut: 0,
        finalStockQuantity: 10,
        finalAverageUnitCost: 8000,
        finalTotalInventoryValue: 80000,
      };

      mockRepository.findLatestKardexMovementByItem.mockResolvedValue(previousKardex);

      mockRepository.saveDeclarationWithItemsAndKardex.mockImplementation(
        async (declaration, items) => {
          return new CustomsDeclarationEntity({
            id: 'saved-dam-id',
            companyId: declaration.companyId,
            duaNumber: declaration.duaNumber,
            customsAgencyCode: declaration.customsAgencyCode,
            regimeCode: declaration.regimeCode,
            numerationDate: declaration.numerationDate,
            fobValueUsd: declaration.fobValueUsd,
            freightValueUsd: declaration.freightValueUsd,
            insuranceValueUsd: declaration.insuranceValueUsd,
            cifValueUsd: declaration.cifValueUsd,
            exchangeRate: declaration.exchangeRate,
            cifValuePen: declaration.cifValuePen,
            adValoremRate: declaration.adValoremRate,
            adValoremAmountPen: declaration.adValoremAmountPen,
            igvRate: declaration.igvRate,
            ipmRate: declaration.ipmRate,
            igvIpmAmountPen: declaration.igvIpmAmountPen,
            perceptionRate: declaration.perceptionRate,
            perceptionAmountPen: declaration.perceptionAmountPen,
            totalCustomsTaxesPen: declaration.totalCustomsTaxesPen,
            status: 'LIQUIDADO',
            items,
          });
        },
      );

      // Ingresan 5 unidades a Landed Cost = S/ 8,466.75 c/u = S/ 42,333.75
      // Nuevo stock = 10 + 5 = 15
      // Costo Promedio = (80,000 + 42,333.75) / 15 = 122,333.75 / 15 = 8,155.5833
      await useCase.execute(validDto, companyId);

      expect(mockRepository.saveDeclarationWithItemsAndKardex).toHaveBeenCalledWith(
        expect.any(CustomsDeclarationEntity),
        expect.any(Array),
        expect.arrayContaining([
          expect.objectContaining({
            finalStockQuantity: 15,
            finalAverageUnitCost: 8155.5833,
            finalTotalInventoryValue: 122333.75,
          }),
        ]),
      );
    });
  });
});
