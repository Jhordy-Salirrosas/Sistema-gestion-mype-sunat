import { ConflictException, NotFoundException } from '@nestjs/common';
import { ForeignSupplierService } from '../../../src/modules/customs/application/services/foreignSupplierService';

describe('ForeignSupplierService multiempresa', () => {
  const prisma = {
    foreignSupplier: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new ForeignSupplierService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('lista solo proveedores de la empresa', async () => {
    prisma.foreignSupplier.findMany.mockResolvedValue([]);
    await service.list('company-1');
    expect(prisma.foreignSupplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ company_id: 'company-1' }) }),
    );
  });

  it('crea un proveedor con datos completos', async () => {
    prisma.foreignSupplier.create.mockResolvedValue({ id: 'sup-1' });
    await service.create('company-1', {
      businessName: 'Proveedor Exterior',
      countryCode: 'cn',
      bankName: 'Banco',
      bankAccount: '123',
      vesselName: 'Buque',
    });
    expect(prisma.foreignSupplier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        company_id: 'company-1',
        country_code: 'CN',
        bank_name: 'Banco',
        vessel_name: 'Buque',
      }),
    });
  });

  it('no permite leer un proveedor de otra empresa', async () => {
    prisma.foreignSupplier.findFirst.mockResolvedValue(null);
    await expect(service.update('company-1', 'sup-ajeno', {})).rejects.toThrow(NotFoundException);
  });

  it('traduce el duplicado de tax ID a conflicto', async () => {
    prisma.foreignSupplier.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.create('company-1', { businessName: 'X', countryCode: 'CN' }))
      .rejects.toThrow(ConflictException);
  });

  it('elimina solo si pertenece a la empresa', async () => {
    prisma.foreignSupplier.findFirst.mockResolvedValue({ id: 'sup-1' });
    prisma.foreignSupplier.delete.mockResolvedValue({ id: 'sup-1' });
    await expect(service.remove('company-1', 'sup-1')).resolves.toEqual({ deleted: true });
  });
});
