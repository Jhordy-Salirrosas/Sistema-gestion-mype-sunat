import { UnauthorizedException } from '@nestjs/common';
import { CustomsSettlementController } from '../../../src/modules/customs/infrastructure/controllers/customsSettlementController';
import { PaySettlementUseCase } from '../../../src/modules/customs/application/use-cases/paySettlementUseCase';
import type { ICustomsSettlementRepositoryPort } from '../../../src/modules/customs/domain/ports/customsSettlementRepositoryPort';
import { PaySettlementDto } from '../../../src/modules/customs/application/dto/paySettlementDto';

describe('CustomsSettlementController', () => {
  let controller: CustomsSettlementController;
  let mockPaySettlementUseCase: jest.Mocked<PaySettlementUseCase>;
  let mockSettlementRepo: jest.Mocked<ICustomsSettlementRepositoryPort>;

  beforeEach(() => {
    mockPaySettlementUseCase = { execute: jest.fn() } as any;
    mockSettlementRepo = {
      createSettlements: jest.fn(),
      findSettlementById: jest.fn(),
      findSettlementsByDeclarationId: jest.fn(),
      findPendingSettlementsByCompany: jest.fn(),
      registerSettlementPayment: jest.fn(),
    };

    controller = new CustomsSettlementController(
      mockPaySettlementUseCase,
      mockSettlementRepo,
    );
  });

  it('debe obtener liquidaciones pendientes por empresa', async () => {
    mockSettlementRepo.findPendingSettlementsByCompany.mockResolvedValue([
      { id: 'sett-1', cda_number: '11826001058921' },
    ]);

    const result = await controller.getPendingSettlements('comp-1');

    expect(result).toHaveLength(1);
    expect(mockSettlementRepo.findPendingSettlementsByCompany).toHaveBeenCalledWith('comp-1');
  });

  it('debe obtener liquidaciones por id de declaración con companyId', async () => {
    mockSettlementRepo.findSettlementsByDeclarationId.mockResolvedValue([
      { id: 'sett-1', cda_number: '11826001058921' },
    ]);

    const result = await controller.getSettlementsByDeclaration('decl-1', 'comp-1');

    expect(result).toHaveLength(1);
    expect(mockSettlementRepo.findSettlementsByDeclarationId).toHaveBeenCalledWith('decl-1', 'comp-1');
  });

  it('debe registrar el pago de una liquidación CDA', async () => {
    const dto: PaySettlementDto = {
      bank_code: '002',
      bank_operation_number: 'OP-123456',
    };
    mockPaySettlementUseCase.execute.mockResolvedValue({ id: 'sett-1', status: 'PAGADA' });

    const result = await controller.paySettlement('sett-1', 'comp-1', dto);

    expect(result).toEqual({ id: 'sett-1', status: 'PAGADA' });
    expect(mockPaySettlementUseCase.execute).toHaveBeenCalledWith('sett-1', dto, 'comp-1');
  });

  it('debe arrojar UnauthorizedException si no se provee companyId', async () => {
    await expect(controller.getPendingSettlements(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
