import { ForeignSupplierController } from '../../../src/modules/customs/infrastructure/controllers/foreignSupplierController';

describe('ForeignSupplierController', () => {
  const service = {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 's1' }),
    update: jest.fn().mockResolvedValue({ id: 's1' }),
    remove: jest.fn().mockResolvedValue({ deleted: true }),
  };
  const controller = new ForeignSupplierController(service as never);

  it('lista por empresa', async () => {
    await expect(controller.list('company-1', 'x')).resolves.toEqual([]);
    expect(service.list).toHaveBeenCalledWith('company-1', 'x');
  });

  it('crea, actualiza y elimina', async () => {
    await controller.create('company-1', { businessName: 'X', countryCode: 'CN' });
    await controller.update('company-1', 's1', { businessName: 'Y' });
    await expect(controller.remove('company-1', 's1')).resolves.toEqual({ deleted: true });
    expect(service.create).toHaveBeenCalled();
    expect(service.update).toHaveBeenCalled();
    expect(service.remove).toHaveBeenCalled();
  });

  it('rechaza peticiones sin empresa', () => {
    expect(() => controller.list(undefined)).toThrow(/empresa/);
  });
});
