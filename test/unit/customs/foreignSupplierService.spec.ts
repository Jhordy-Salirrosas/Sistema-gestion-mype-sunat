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
    businessPartner: {
      upsert: jest.fn().mockResolvedValue({ id: 'bp-default' }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'bp-default' }),
    },
    partnerBankAccount: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'ba-default' }),
      update: jest.fn().mockResolvedValue({ id: 'ba-default' }),
    },
    partnerAddress: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'ad-default' }),
      update: jest.fn().mockResolvedValue({ id: 'ad-default' }),
    },
    partnerContact: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'co-default' }),
      update: jest.fn().mockResolvedValue({ id: 'co-default' }),
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

  it('sincroniza creación y actualización completa hacia BusinessPartner y subentidades', async () => {
    prisma.foreignSupplier.create.mockResolvedValue({ id: 'sup-sync-1' });
    prisma.businessPartner.upsert.mockResolvedValue({ id: 'bp-sync-1' });
    prisma.partnerBankAccount.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'ba-old', bank_name: 'Old', account_number: '1', swift: null });
    prisma.partnerAddress.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'ad-old', address: 'Old', city: 'Old', postal_code: '0' });
    prisma.partnerContact.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'co-old', email: 'a@b.com', phone: '1' });

    await service.create('company-1', {
      taxId: 'CN-TAX-1',
      businessName: 'Yiwu Trading Ltd',
      countryCode: 'cn',
      defaultCurrency: 'usd',
      city: 'Yiwu',
      postalCode: '322000',
      address: 'Futian Market 10',
      contactName: 'Zhang San',
      email: 'zhang@yiwu.cn',
      phone: '+86-579',
      paymentTerms: '60 DIAS',
      bankName: 'Bank of China',
      bankAccount: 'BOC-5566',
      swiftCode: 'BKCHCNBJ',
    });

    // Segunda creación actualizando subentidades ya existentes del BusinessPartner
    await service.create('company-1', {
      taxId: 'CN-TAX-1',
      businessName: 'Yiwu Trading Ltd 2',
      countryCode: 'cn',
      city: 'Yiwu',
      contactName: 'Zhang San 2',
      bankName: 'Bank of China',
      bankAccount: 'BOC-5566',
    });

    expect(prisma.businessPartner.upsert).toHaveBeenCalled();
    expect(prisma.partnerBankAccount.create).toHaveBeenCalled();
    expect(prisma.partnerBankAccount.update).toHaveBeenCalled();
    expect(prisma.partnerAddress.create).toHaveBeenCalled();
    expect(prisma.partnerAddress.update).toHaveBeenCalled();
    expect(prisma.partnerContact.create).toHaveBeenCalled();
    expect(prisma.partnerContact.update).toHaveBeenCalled();

    // Update sincronizando registros existentes en BusinessPartner y subentidades
    prisma.foreignSupplier.findFirst.mockResolvedValue({ id: 'sup-sync-1', tax_id: 'CN-TAX-1' });
    prisma.foreignSupplier.update.mockResolvedValue({ id: 'sup-sync-1' });
    prisma.businessPartner.findFirst.mockResolvedValue({
      id: 'bp-sync-1',
      roles: ['CLIENTE'],
      country_code: 'CN',
      currency_code: 'USD',
    });
    prisma.partnerBankAccount.findFirst.mockResolvedValueOnce({ id: 'ba-1', bank_name: 'Old' }).mockResolvedValueOnce(null);
    prisma.partnerAddress.findFirst.mockResolvedValueOnce({ id: 'ad-1', address: 'Old' }).mockResolvedValueOnce(null);
    prisma.partnerContact.findFirst.mockResolvedValueOnce({ id: 'co-1' }).mockResolvedValueOnce(null);

    await service.update('company-1', 'sup-sync-1', {
      businessName: 'Yiwu Updated',
      city: 'Ningbo',
      postalCode: '315000',
      address: 'Port Ave 20',
      contactName: 'Li Ming',
      bankName: 'HSBC',
      bankAccount: 'HSBC-999',
      swiftCode: 'HSBCCNSH',
    });

    // Segunda actualización creando subentidades faltantes
    await service.update('company-1', 'sup-sync-1', {
      city: 'Shanghai',
      contactName: 'Chen',
      bankName: 'ICBC',
      bankAccount: 'ICBC-88',
    });

    expect(prisma.businessPartner.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roles: expect.arrayContaining(['CLIENTE', 'PROVEEDOR', 'PROVEEDOR_EXTERIOR', 'IMPORTADOR']),
        }),
      }),
    );
    expect(prisma.partnerBankAccount.update).toHaveBeenCalled();
    expect(prisma.partnerAddress.update).toHaveBeenCalled();
    expect(prisma.partnerContact.update).toHaveBeenCalled();
  });

  it('continúa sin fallar cuando la sincronización opcional de BusinessPartner lanza error', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    prisma.foreignSupplier.create.mockResolvedValue({ id: 'sup-warn-1' });
    prisma.businessPartner.upsert.mockRejectedValueOnce(new Error('partner upsert fail'));

    await expect(
      service.create('company-1', { businessName: 'Warn Corp', countryCode: 'DE' }),
    ).resolves.toEqual({ id: 'sup-warn-1' });

    prisma.foreignSupplier.findFirst.mockResolvedValue({ id: 'sup-warn-1', tax_id: null });
    prisma.foreignSupplier.update.mockResolvedValue({ id: 'sup-warn-1' });
    prisma.businessPartner.findFirst.mockRejectedValueOnce(new Error('partner update fail'));

    await expect(
      service.update('company-1', 'sup-warn-1', { businessName: 'Warn Updated' }),
    ).resolves.toEqual({ id: 'sup-warn-1' });

    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });
});
