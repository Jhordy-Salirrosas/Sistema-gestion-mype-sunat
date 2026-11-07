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

  it('exige razón social y país al crear', async () => {
    await expect(service.create('company-1', {})).rejects.toThrow(/obligatorios/);
  });

  it('actualiza todos los campos editables', async () => {
    prisma.foreignSupplier.findFirst.mockResolvedValue({ id: 'sup-1' });
    prisma.foreignSupplier.update.mockResolvedValue({ id: 'sup-1' });
    await service.update('company-1', 'sup-1', {
      taxId: 'US-1', businessName: 'Nuevo', countryCode: 'us', defaultCurrency: 'usd',
      isRelated: true, address: 'Calle 1', email: 'a@b.com', phone: '123', contactName: 'Ana',
      paymentTerms: '30 días', bankName: 'Bank', bankAccount: '123', swiftCode: 'SWIFT',
      vesselName: 'Buque', voyageNumber: 'V1', blNumber: 'BL1', portOrigin: 'Shanghai',
    });
    expect(prisma.foreignSupplier.update).toHaveBeenCalledWith({
      where: { id: 'sup-1' },
      data: expect.objectContaining({
        tax_id: 'US-1', business_name: 'Nuevo', country_code: 'US', default_currency: 'USD',
        is_related: true, address: 'Calle 1', email: 'a@b.com', phone: '123', contact_name: 'Ana',
        payment_terms: '30 días', bank_name: 'Bank', bank_account: '123', swift_code: 'SWIFT',
        vessel_name: 'Buque', voyage_number: 'V1', bl_number: 'BL1', port_origin: 'Shanghai',
      }),
    });
  });

  it('lista con filtro de búsqueda', async () => {
    prisma.foreignSupplier.findMany.mockResolvedValue([]);
    await service.list('company-1', 'shen');
    expect(prisma.foreignSupplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ company_id: 'company-1', OR: expect.any(Array) }) }),
    );
  });
});
