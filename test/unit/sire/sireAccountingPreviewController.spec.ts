import { UnauthorizedException } from '@nestjs/common';
import { SireAccountingPreviewController } from '../../../src/modules/sire/infrastructure/controllers/sireAccountingPreviewController';
import type { GetSireAccountingPreviewUseCase } from '../../../src/modules/sire/application/use-cases/getSireAccountingPreviewUseCase';

describe('SireAccountingPreviewController', () => {
  const user = {
    sub: 'user-id',
    email: 'demo@example.test',
    companyId: 'company-id',
    role: 'ADMIN',
  };
  const preview = { execute: jest.fn() };
  const controller = new SireAccountingPreviewController(
    preview as unknown as GetSireAccountingPreviewUseCase,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delega la previsualización con la empresa de la sesión', async () => {
    preview.execute.mockResolvedValue({ periodo: '202602', asientos: [] });

    await expect(
      controller.preview(
        { periodo: '202602', libro: 'RVIE_VENTAS' },
        user,
      ),
    ).resolves.toEqual({ periodo: '202602', asientos: [] });
    expect(preview.execute).toHaveBeenCalledWith(
      'company-id',
      '202602',
      'RVIE_VENTAS',
    );
  });

  it('rechaza la petición sin empresa en la sesión', async () => {
    await expect(
      controller.preview({ periodo: '202602' }, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.preview({ periodo: '202602' }, { ...user, companyId: '' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(preview.execute).not.toHaveBeenCalled();
  });
});
