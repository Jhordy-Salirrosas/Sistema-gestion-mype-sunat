import { NotFoundException } from '@nestjs/common';
import { GetCustomsDeclarationByIdUseCase } from '../../../src/modules/customs/application/use-cases/getCustomsDeclarationByIdUseCase';
import type { ICustomsRepositoryPort } from '../../../src/modules/customs/domain/ports/customsRepositoryPort';
import { CustomsDeclarationEntity } from '../../../src/modules/customs/domain/entities/customsDeclarationEntity';
import { CustomsItemEntity } from '../../../src/modules/customs/domain/entities/customsItemEntity';

describe('GetCustomsDeclarationByIdUseCase', () => {
  let useCase: GetCustomsDeclarationByIdUseCase;
  let mockRepository: jest.Mocked<ICustomsRepositoryPort>;

  const companyId = 'company-owner-uuid';
  const otherCompanyId = 'company-attacker-uuid';
  const declarationId = 'declaration-uuid-123';
  const dummyDate = new Date('2026-10-15T12:00:00Z');

  beforeEach(() => {
    mockRepository = {
      saveDeclarationWithItemsAndKardex: jest.fn(),
      findDeclarationById: jest.fn(),
      findDeclarationsByCompany: jest.fn(),
      findKardexMovementsByCompany: jest.fn(),
      findLatestKardexMovementByItem: jest.fn(),
    };

    useCase = new GetCustomsDeclarationByIdUseCase(mockRepository);
  });

  it('debe retornar el detalle completo de la DAM cuando pertenece a la empresa solicitante', async () => {
    const item = new CustomsItemEntity({
      id: 'item-1',
      declarationId,
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

    const declaration = new CustomsDeclarationEntity({
      id: declarationId,
      companyId,
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
      items: [item],
    });

    mockRepository.findDeclarationById.mockResolvedValue(declaration);

    const result = await useCase.execute(declarationId, companyId);

    expect(result).toBeDefined();
    expect(result.id).toBe(declarationId);
    expect(result.dua_number).toBe('118-2026-10-001234');
    expect(result.cif_value_pen).toBe(39937.5);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].landed_cost_unit_pen).toBe(8466.75);
    expect(mockRepository.findDeclarationById).toHaveBeenCalledWith(declarationId, companyId);
  });

  it('debe arrojar NotFoundException cuando la DAM pertenece a otra empresa (Aislamiento Multi-Tenant)', async () => {
    // La empresa propietaria es 'company-owner-uuid', pero quien consulta es 'company-attacker-uuid'
    mockRepository.findDeclarationById.mockResolvedValue(null);

    await expect(useCase.execute(declarationId, otherCompanyId)).rejects.toThrow(
      NotFoundException,
    );
    await expect(useCase.execute(declarationId, otherCompanyId)).rejects.toThrow(
      `Declaración aduanera con ID '${declarationId}' no encontrada`,
    );

    expect(mockRepository.findDeclarationById).toHaveBeenCalledWith(declarationId, otherCompanyId);
  });

  it('debe arrojar NotFoundException cuando el ID no existe en la base de datos', async () => {
    mockRepository.findDeclarationById.mockResolvedValue(null);

    await expect(useCase.execute('non-existent-id', companyId)).rejects.toThrow(
      NotFoundException,
    );
  });
});
