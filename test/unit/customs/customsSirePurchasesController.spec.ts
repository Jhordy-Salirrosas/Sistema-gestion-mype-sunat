import { CustomsSirePurchasesController } from '../../../src/modules/customs/infrastructure/controllers/customsSirePurchasesController';
import { UnauthorizedException } from '@nestjs/common';

describe('CustomsSirePurchasesController (Controller Unit Test)', () => {
  let controller: CustomsSirePurchasesController;
  let mockCustomsRepo: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockCustomsRepo = {
      findDeclarationsByCompany: jest.fn().mockResolvedValue([
        {
          id: 'decl-01',
          duaNumber: '118-2026-10-004200',
          numerationDate: new Date('2026-10-18'),
          cifValuePen: 197016.5,
          totalCustomsTaxesPen: 35462.97,
        },
      ]),
    };
    mockPrisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          ruc: '20601234567',
          legal_name: 'EMPRESA MYPE SAC',
        }),
      },
    };
    controller = new CustomsSirePurchasesController(mockCustomsRepo, mockPrisma);
  });

  it('debe exportar archivo plano Anexo 8.4 para el periodo solicitado', async () => {
    const result = await controller.exportSirePurchases('comp-1', '2026', '10');

    expect(result.fileName).toBe('LE2060123456720261000080400001111.txt');
    expect(result.recordsCount).toBe(1);
    expect(result.content).toContain('|50|118|2026|004200|');
  });

  it('debe arrojar UnauthorizedException si companyId no está presente', async () => {
    await expect(controller.exportSirePurchases(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

