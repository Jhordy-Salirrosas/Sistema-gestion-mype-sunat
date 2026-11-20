import { UnauthorizedException } from '@nestjs/common';
import { CompanyConfigurationController } from '../../../src/modules/sire/infrastructure/controllers/companyConfigurationController';
import type { GetCompanyConfigurationUseCase } from '../../../src/modules/sire/application/use-cases/getCompanyConfigurationUseCase';
import type { UpdateCompanyConfigurationUseCase } from '../../../src/modules/sire/application/use-cases/updateCompanyConfigurationUseCase';
import type { ListCompaniesUseCase } from '../../../src/modules/sire/application/use-cases/listCompaniesUseCase';

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
  const listUseCase = {
    execute: jest.fn(),
  } as unknown as ListCompaniesUseCase;

  const controller = new CompanyConfigurationController(
    getUseCase,
    updateUseCase,
    listUseCase,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the configuration of the authenticated company', async () => {
    (getUseCase.execute as jest.Mock).mockResolvedValue({
      ruc: '20123456789',
      businessName: 'Demo SAC',
      tradeName: 'Demo Comercial',
      direccion: 'AV. SIEMPRE VIVA 123',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      ubigeo: '150101',
      esAgenteRetencion: false,
      series: ['F001'],
    });

    await expect(controller.obtener(user)).resolves.toEqual({
      ruc: '20123456789',
      businessName: 'Demo SAC',
      tradeName: 'Demo Comercial',
      direccion: 'AV. SIEMPRE VIVA 123',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      ubigeo: '150101',
      esAgenteRetencion: false,
      series: ['F001'],
    });
    expect(getUseCase.execute).toHaveBeenCalledWith('company-id');
  });

  it('updates the configuration of the authenticated company', async () => {
    const dto = {
      businessName: 'Demo SAC',
      tradeName: 'Demo Comercial',
      direccion: 'AV. SIEMPRE VIVA 123',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      ubigeo: '150101',
      esAgenteRetencion: false,
      series: ['F001', 'B001'],
    };
    (updateUseCase.execute as jest.Mock).mockResolvedValue({
      ruc: '20123456789',
      ...dto,
    });

    await expect(controller.actualizar(dto, user)).resolves.toEqual({
      ruc: '20123456789',
      ...dto,
    });
    expect(updateUseCase.execute).toHaveBeenCalledWith('company-id', dto);
  });

  it('lists companies for the Multi-RUC selector', async () => {
    (listUseCase.execute as jest.Mock).mockResolvedValue([
      {
        id: 'company-1',
        ruc: '20123456789',
        razonSocial: 'Demo SAC',
        nombreComercial: 'Demo',
        activa: true,
      },
    ]);

    await expect(controller.listar()).resolves.toEqual([
      {
        id: 'company-1',
        ruc: '20123456789',
        razonSocial: 'Demo SAC',
        nombreComercial: 'Demo',
        activa: true,
      },
    ]);
    expect(listUseCase.execute).toHaveBeenCalledWith();
  });

  it('allows ADMIN to read/write another company with companyId', async () => {
    (getUseCase.execute as jest.Mock).mockResolvedValue({ ruc: '20999999999' });
    (updateUseCase.execute as jest.Mock).mockResolvedValue({ ruc: '20999999999' });

    await controller.obtener(user, 'company-2');
    expect(getUseCase.execute).toHaveBeenCalledWith('company-2');

    await controller.actualizar(
      { companyId: 'company-2', businessName: 'Otra empresa' },
      user,
    );
    expect(updateUseCase.execute).toHaveBeenCalledWith(
      'company-2',
      expect.objectContaining({ companyId: 'company-2' }),
    );
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
