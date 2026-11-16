import { UnauthorizedException } from '@nestjs/common';
import { CompanyConfigurationController } from '../../../src/modules/sire/infrastructure/controllers/companyConfigurationController';
import type { GetCompanyConfigurationUseCase } from '../../../src/modules/sire/application/use-cases/getCompanyConfigurationUseCase';
import type { UpdateCompanyConfigurationUseCase } from '../../../src/modules/sire/application/use-cases/updateCompanyConfigurationUseCase';

describe('CompanyConfigurationController', () => {
  const user = {
    sub: 'user-id',
    email: 'demo@example.test',
    companyId: 'company-id',
    role: 'ADMIN',
  };

  const getUseCase = {
    execute: jest.fn(),
  } as unknown as GetCompanyConfigurationUseCase;
  const updateUseCase = {
    execute: jest.fn(),
  } as unknown as UpdateCompanyConfigurationUseCase;

  const controller = new CompanyConfigurationController(
    getUseCase,
    updateUseCase,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the configuration of the authenticated company', async () => {
    (getUseCase.execute as jest.Mock).mockResolvedValue({
      ruc: '20123456789',
      businessName: 'Demo SAC',
      series: ['F001'],
    });

    await expect(controller.obtener(user)).resolves.toEqual({
      ruc: '20123456789',
      businessName: 'Demo SAC',
      series: ['F001'],
    });
    expect(getUseCase.execute).toHaveBeenCalledWith('company-id');
  });

  it('updates the configuration of the authenticated company', async () => {
    const dto = { businessName: 'Demo SAC', series: ['F001', 'B001'] };
    (updateUseCase.execute as jest.Mock).mockResolvedValue({
      ruc: '20123456789',
      businessName: 'Demo SAC',
      series: ['F001', 'B001'],
    });

    await expect(controller.actualizar(dto, user)).resolves.toEqual({
      ruc: '20123456789',
      businessName: 'Demo SAC',
      series: ['F001', 'B001'],
    });
    expect(updateUseCase.execute).toHaveBeenCalledWith('company-id', dto);
  });

  it('rejects reads without company in the session', async () => {
    await expect(controller.obtener(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.obtener({ ...user, companyId: '' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects updates without company in the session', async () => {
    await expect(
      controller.actualizar({ businessName: 'Demo SAC' }, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      controller.actualizar(
        { businessName: 'Demo SAC' },
        { ...user, companyId: undefined as unknown as string },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(updateUseCase.execute).not.toHaveBeenCalled();
  });
});
