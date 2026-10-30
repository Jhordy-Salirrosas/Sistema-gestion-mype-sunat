import { BadRequestException } from '@nestjs/common';
import { RegisterDuaUseCase } from '../../../src/modules/customs/application/use-cases/registerDuaUseCase';
import { RegisterDuaDto } from '../../../src/modules/customs/application/dto/registerDuaDto';
import { CustomsDeclarationEntity } from '../../../src/modules/customs/domain/entities/customsDeclarationEntity';
import type { ICustomsRepositoryPort } from '../../../src/modules/customs/domain/ports/customsRepositoryPort';

describe('RegisterDuaUseCase', () => {
  let useCase: RegisterDuaUseCase;
  let mockRepository: jest.Mocked<ICustomsRepositoryPort>;

  const companyId = 'test-company-uuid';

  const validDto: RegisterDuaDto = {
    dua_number: '118-2026-10-001234',
    customs_agency_code: '118',
    regime_code: '10',
    numeration_date: '2026-10-15T12:00:00.000Z',
    fob_value_usd: 10000,
    freight_value_usd: 500,
    insurance_value_usd: 150,
    exchange_rate: 3.75,
    ad_valorem_rate: 6.0,
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
      registerKardexMovements: jest.fn(),
    };

    useCase = new RegisterDuaUseCase(mockRepository);
  });

  describe('Cálculo y Registro de DAM (Desacoplado de Kardex)', () => {
    it('debe liquidar la DAM, prorratear el Landed Cost unitario y persistir sin alterar inventario', async () => {
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
      expect(result.items_count).toBe(1);

      // Verificación de desacople: se persiste la DAM con arreglo vacío de Kardex
      expect(mockRepository.saveDeclarationWithItemsAndKardex).toHaveBeenCalledWith(
        expect.any(CustomsDeclarationEntity),
        expect.any(Array),
        [],
      );
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
      await expect(useCase.execute(invalidFobDto, companyId)).rejects.toThrow(/no coincide con la suma/);
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
});
