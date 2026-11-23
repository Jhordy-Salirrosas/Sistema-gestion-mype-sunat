import { ListCompaniesUseCase } from '../../../src/modules/sire/application/use-cases/listCompaniesUseCase';
import type { PrismaService } from '../../../src/database/prismaService';

describe('ListCompaniesUseCase', () => {
  it('lista empresas activas ordenadas para el selector Multi-RUC', async () => {
    const prisma = {
      company: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'company-2',
            ruc: '20123456789',
            legal_name: 'Demo SAC',
            trade_name: 'Demo',
            is_active: true,
          },
          {
            id: 'company-1',
            ruc: '20999999999',
            legal_name: 'Otra SAC',
            trade_name: null,
            is_active: true,
          },
        ]),
      },
    } as unknown as PrismaService;

    const useCase = new ListCompaniesUseCase(prisma);

    await expect(useCase.execute()).resolves.toEqual([
      {
        id: 'company-2',
        ruc: '20123456789',
        legalName: 'Demo SAC',
        razonSocial: 'Demo SAC',
        nombreComercial: 'Demo',
        activa: true,
      },
      {
        id: 'company-1',
        ruc: '20999999999',
        legalName: 'Otra SAC',
        razonSocial: 'Otra SAC',
        nombreComercial: null,
        activa: true,
      },
    ]);

    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { is_active: true } }),
    );
  });
});
