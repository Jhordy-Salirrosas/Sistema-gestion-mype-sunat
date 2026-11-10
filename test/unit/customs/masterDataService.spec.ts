import { ConflictException, NotFoundException } from '@nestjs/common';
import { MasterDataService } from '../../../src/modules/customs/application/services/masterDataService';

describe('MasterDataService', () => {
  let service: MasterDataService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: jest.fn(),
      currency: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      exchangeRate: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      incoterm: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      businessPartner: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      partnerAddress: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      partnerContact: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      partnerBankAccount: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      foreignSupplier: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      country: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      port: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      documentType: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      accountingMapping: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      partnerTaxStatus: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    service = new MasterDataService(mockPrisma);
  });

  describe('Currencies', () => {
    it('lista y hace upsert de monedas', async () => {
      mockPrisma.currency.findMany.mockResolvedValue([{ code: 'USD' }]);
      mockPrisma.currency.upsert.mockResolvedValue({ code: 'USD', name: 'Dólar' });

      expect(await service.listCurrencies()).toEqual([{ code: 'USD' }]);
      const upserted = await service.upsertCurrency({ code: 'usd', name: 'Dólar', symbol: '$' });
      expect(upserted.code).toBe('USD');

      mockPrisma.currency.delete.mockResolvedValue({ code: 'USD' });
      expect(await service.deleteCurrency('usd')).toEqual({ code: 'USD' });
    });
  });

  describe('ExchangeRates', () => {
    it('lista, crea y elimina tipos de cambio', async () => {
      mockPrisma.exchangeRate.findMany.mockResolvedValue([]);
      mockPrisma.exchangeRate.upsert.mockResolvedValue({ id: 'er-1', rate: 3.75 });
      mockPrisma.exchangeRate.delete.mockResolvedValue({ id: 'er-1' });

      expect(await service.listExchangeRates()).toEqual([]);
      const created = await service.createExchangeRate({
        baseCurrency: 'usd',
        quoteCurrency: 'pen',
        rate: 3.75,
        date: '2026-05-01',
      });
      expect(created.rate).toBe(3.75);
      expect(await service.deleteExchangeRate('er-1')).toEqual({ id: 'er-1' });
    });
  });

  describe('Incoterms', () => {
    it('lista, hace upsert y elimina incoterms', async () => {
      mockPrisma.incoterm.findMany.mockResolvedValue([]);
      mockPrisma.incoterm.upsert.mockResolvedValue({ code: 'FOB', name: 'Free on Board' });
      mockPrisma.incoterm.delete.mockResolvedValue({ code: 'FOB' });

      expect(await service.listIncoterms()).toEqual([]);
      const up = await service.upsertIncoterm({ code: 'fob', name: 'Free on Board' });
      expect(up.code).toBe('FOB');
      expect(await service.deleteIncoterm('fob')).toEqual({ code: 'FOB' });
    });
  });

  describe('BusinessPartners', () => {
    const companyId = 'comp-100';

    it('lista terceros con filtros de rol y búsqueda', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'bp-1', legal_name: 'Tech Corp' }]);

      const res = await service.listPartners(companyId, 'supplier', 'tech');
      expect(res.length).toBe(1);
      const query = mockPrisma.$queryRaw.mock.calls[0][0];
      expect(query.values).toEqual(expect.arrayContaining([companyId, 'SUPPLIER', 'tech']));
      expect(query.text).toContain('ANY(roles)');
      expect(query.text).toContain('normalize(lower(');
      expect(query.text).toContain('LIMIT 200');
      expect(query.text).not.toContain('comp-100');
      expect(mockPrisma.businessPartner.findMany).not.toHaveBeenCalled();
    });

    it('sin búsqueda conserva empresa, rol, orden y límite', async () => {
      mockPrisma.businessPartner.findMany.mockResolvedValue([]);
      await service.listPartners(companyId, 'cliente', '  ');
      expect(mockPrisma.businessPartner.findMany).toHaveBeenCalledWith({
        where: { company_id: companyId, roles: { has: 'CLIENTE' } },
        orderBy: { legal_name: 'asc' }, take: 200,
      });
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('parametriza caracteres especiales sin ampliar la búsqueda', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      const term = "%_' OR true --";
      await service.listPartners(companyId, undefined, term);
      const query = mockPrisma.$queryRaw.mock.calls[0][0];
      expect(query.values).toContain(term);
      expect(query.text).not.toContain(term);
      expect(query.text).not.toContain('ANY(roles)');
    });

    it('obtiene tercero por ID o lanza NotFoundException', async () => {
      mockPrisma.businessPartner.findFirst.mockResolvedValue(null);
      await expect(service.getPartner(companyId, 'non-existent')).rejects.toThrow(NotFoundException);

      mockPrisma.businessPartner.findFirst.mockResolvedValue({ id: 'bp-1' });
      expect(await service.getPartner(companyId, 'bp-1')).toEqual({ id: 'bp-1' });
    });

    it('crea un tercero nuevo y valida duplicados', async () => {
      mockPrisma.businessPartner.findFirst.mockResolvedValueOnce({ id: 'existing' });
      await expect(
        service.createPartner(companyId, {
          docType: '6',
          docNumber: '20601234567',
          legalName: 'Empresa Duplicada',
        }),
      ).rejects.toThrow(ConflictException);

      mockPrisma.businessPartner.findFirst.mockResolvedValueOnce(null);
      mockPrisma.businessPartner.create.mockResolvedValue({ id: 'bp-new' });

      const created = await service.createPartner(companyId, {
        docType: '6',
        docNumber: '20601234567',
        legalName: 'Empresa Nueva',
        roles: ['supplier'],
      });
      expect(created.id).toBe('bp-new');
    });

    it('actualiza y elimina un tercero con sus dependencias', async () => {
      mockPrisma.businessPartner.findFirst.mockResolvedValue({ id: 'bp-1' });
      mockPrisma.businessPartner.update.mockResolvedValue({ id: 'bp-1', legal_name: 'Modificado' });

      const updated = await service.updatePartner(companyId, 'bp-1', {
        legalName: 'Modificado',
        roles: ['customer'],
        countryCode: 'pe',
      });
      expect(updated.legal_name).toBe('Modificado');

      mockPrisma.partnerAddress.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.partnerContact.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.partnerBankAccount.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.businessPartner.delete.mockResolvedValue({ id: 'bp-1' });

      const deleted = await service.deletePartner(companyId, 'bp-1');
      expect(deleted.id).toBe('bp-1');
    });

    it('agrega dirección, contacto y cuenta bancaria a un tercero', async () => {
      mockPrisma.businessPartner.findFirst.mockResolvedValue({ id: 'bp-1' });
      mockPrisma.partnerAddress.create.mockResolvedValue({ id: 'addr-1' });
      mockPrisma.partnerContact.create.mockResolvedValue({ id: 'cont-1' });
      mockPrisma.partnerBankAccount.create.mockResolvedValue({ id: 'bank-1' });

      const addr = await service.addAddress(companyId, 'bp-1', { address: 'Av. Test 123' });
      expect(addr.id).toBe('addr-1');

      const cont = await service.addContact(companyId, 'bp-1', { name: 'Juan Perez' });
      expect(cont.id).toBe('cont-1');

      const bank = await service.addBankAccount(companyId, 'bp-1', {
        bankName: 'BCP',
        accountNumber: '191-123456',
      });
      expect(bank.id).toBe('bank-1');
    });
  });

  describe('DocumentTypes and AccountingMappings', () => {
    it('gestiona tipos de documento y mapeos contables', async () => {
      mockPrisma.documentType.findMany.mockResolvedValue([]);
      mockPrisma.documentType.upsert.mockResolvedValue({ code: 'BL' });
      mockPrisma.documentType.delete.mockResolvedValue({ code: 'BL' });

      expect(await service.listDocumentTypes()).toEqual([]);
      expect(await service.upsertDocumentType({ code: 'bl', name: 'Bill of Lading' })).toEqual({ code: 'BL' });
      expect(await service.deleteDocumentType('bl')).toEqual({ code: 'BL' });

      mockPrisma.accountingMapping.findMany.mockResolvedValue([]);
      mockPrisma.accountingMapping.upsert.mockResolvedValue({ id: 'map-1' });

      expect(await service.listAccountingMappings('comp-1')).toEqual([]);
      expect(
        await service.upsertAccountingMapping('comp-1', {
          processCode: 'aduanas',
          roleCode: 'fob',
          accountCode: '6011',
        }),
      ).toEqual({ id: 'map-1' });
    });
  });

  describe('PartnerTaxStatus', () => {
    it('consulta y registra un indicador con vigencia', async () => {
      mockPrisma.businessPartner.findFirst.mockResolvedValue({ id: 'p-1' });
      mockPrisma.partnerTaxStatus.findMany.mockResolvedValue([
        { indicator: 'RETENCION', value: true },
      ]);
      mockPrisma.partnerTaxStatus.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.partnerTaxStatus.create.mockResolvedValue({ id: 'ts-1' });

      const actual = await service.getPartnerTaxStatus('c-1', 'p-1');
      expect(actual[0].indicator).toBe('RETENCION');

      await service.upsertPartnerTaxStatus('c-1', 'p-1', {
        indicator: 'RETENCION',
        value: true,
        validFrom: '2026-11-06',
        source: 'SUNAT',
      });
      expect(mockPrisma.partnerTaxStatus.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          partner_id: 'p-1',
          indicator: 'RETENCION',
          value: true,
          source: 'SUNAT',
        }),
      });
    });
  });

  describe('Extended Partner Sync, Countries & Ports', () => {
    const companyId = 'comp-ext-1';

    it('crea tercero exterior completo con dirección, contacto, banco y sincroniza ForeignSupplier', async () => {
      mockPrisma.businessPartner.findFirst.mockResolvedValueOnce(null);
      mockPrisma.businessPartner.create.mockResolvedValue({ id: 'bp-ext-1' });
      mockPrisma.foreignSupplier.upsert.mockResolvedValue({ id: 'fs-1' });

      const created = await service.createPartner(companyId, {
        docType: '0',
        docNumber: 'CN-888999',
        legalName: 'Shenzhen Industrial Co.',
        countryCode: 'cn',
        currencyCode: 'usd',
        city: 'Shenzhen',
        postalCode: '518000',
        address: 'Nanshan District 99',
        contactName: 'Li Wei',
        email: 'li@shenzhen.cn',
        phone: '+86-755',
        paymentTerms: '30 DIAS',
        bankName: 'Bank of China',
        accountNumber: 'BOC-001122',
        swiftCode: 'BKCHCNBJ',
        roles: ['PROVEEDOR_EXTERIOR', 'IMPORTADOR'],
      });

      expect(created.id).toBe('bp-ext-1');
      expect(mockPrisma.partnerAddress.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          partner_id: 'bp-ext-1',
          city: 'Shenzhen',
          postal_code: '518000',
          country_code: 'CN',
        }),
      });
      expect(mockPrisma.partnerContact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ partner_id: 'bp-ext-1', name: 'Li Wei' }),
      });
      expect(mockPrisma.partnerBankAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          partner_id: 'bp-ext-1',
          bank_name: 'Bank of China',
          swift: 'BKCHCNBJ',
          currency_code: 'USD',
        }),
      });
      expect(mockPrisma.foreignSupplier.upsert).toHaveBeenCalled();
    });

    it('no bloquea creación si falla la sincronización con ForeignSupplier', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockPrisma.businessPartner.findFirst.mockResolvedValueOnce(null);
      mockPrisma.businessPartner.create.mockResolvedValue({ id: 'bp-ext-2' });
      mockPrisma.foreignSupplier.upsert.mockRejectedValue(new Error('sync error'));

      const created = await service.createPartner(companyId, {
        docType: '0',
        docNumber: 'US-123',
        legalName: 'Miami Cargo LLC',
        countryCode: 'US',
      });

      expect(created.id).toBe('bp-ext-2');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('actualiza dirección, contacto, banco (creando y actualizando) y sincroniza ForeignSupplier', async () => {
      mockPrisma.businessPartner.findFirst.mockResolvedValue({
        id: 'bp-ext-1',
        doc_number: 'CN-888999',
        country_code: 'CN',
        currency_code: 'USD',
        address: 'Old Dir',
      });
      mockPrisma.businessPartner.update.mockResolvedValue({ id: 'bp-ext-1', has_credit: false });

      // Primera pasada: ya existen subentidades -> update
      mockPrisma.partnerAddress.findFirst.mockResolvedValueOnce({ id: 'addr-1', address: 'Old Dir' });
      mockPrisma.partnerContact.findFirst.mockResolvedValueOnce({ id: 'cont-1' });
      mockPrisma.partnerBankAccount.findFirst.mockResolvedValueOnce({ id: 'bank-1' });
      mockPrisma.foreignSupplier.findFirst.mockResolvedValueOnce({ id: 'fs-1' });

      await service.updatePartner(companyId, 'bp-ext-1', {
        legalName: 'Shenzhen Updated',
        tradeName: 'Shenzhen',
        website: 'https://sz.cn',
        paymentTerms: 'CONTADO',
        allowsDiscount: true,
        creditLimit: 5000,
        isActive: true,
        city: 'Guangzhou',
        postalCode: '510000',
        address: 'New Blvd',
        contactName: 'Chen',
        email: 'chen@sz.cn',
        phone: '+86-20',
        bankName: 'ICBC',
        accountNumber: 'ICBC-99',
        swiftCode: 'ICBKCNBJ',
        currencyCode: 'usd',
      });

      expect(mockPrisma.partnerAddress.update).toHaveBeenCalled();
      expect(mockPrisma.partnerContact.update).toHaveBeenCalled();
      expect(mockPrisma.partnerBankAccount.update).toHaveBeenCalled();
      expect(mockPrisma.foreignSupplier.update).toHaveBeenCalled();

      // Segunda pasada: no existen subentidades -> create, y falla sync ForeignSupplier sin lanzar excepción
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockPrisma.partnerAddress.findFirst.mockResolvedValueOnce(null);
      mockPrisma.partnerContact.findFirst.mockResolvedValueOnce(null);
      mockPrisma.partnerBankAccount.findFirst.mockResolvedValueOnce(null);
      mockPrisma.foreignSupplier.findFirst.mockRejectedValueOnce(new Error('db fail'));

      await service.updatePartner(companyId, 'bp-ext-1', {
        city: 'Beijing',
        contactName: 'Wang',
        bankName: 'HSBC',
      });

      expect(mockPrisma.partnerAddress.create).toHaveBeenCalled();
      expect(mockPrisma.partnerContact.create).toHaveBeenCalled();
      expect(mockPrisma.partnerBankAccount.create).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('gestiona CRUD de países y puertos (con y sin filtro de tipo)', async () => {
      mockPrisma.country.findMany.mockResolvedValue([{ code: 'PE', name: 'Perú' }]);
      mockPrisma.country.upsert.mockResolvedValue({ code: 'PE', name: 'Perú', status: 'ACTIVO' });
      mockPrisma.country.delete.mockResolvedValue({ code: 'PE' });

      expect(await service.listCountries()).toHaveLength(1);
      expect(await service.upsertCountry({ code: ' pe ', name: ' Perú ' })).toEqual({
        code: 'PE',
        name: 'Perú',
        status: 'ACTIVO',
      });
      expect(await service.deleteCountry(' pe ')).toEqual({ code: 'PE' });

      mockPrisma.port.findMany.mockResolvedValue([{ code: 'PECLL', name: 'Callao', type: 'MARITIMO' }]);
      mockPrisma.port.upsert.mockResolvedValue({ code: 'PECLL', name: 'Callao' });
      mockPrisma.port.delete.mockResolvedValue({ code: 'PECLL' });

      await service.listPorts('MARITIMO');
      expect(mockPrisma.port.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { OR: [{ type: 'MARITIMO' }, { type: 'AMBOS' }] } }),
      );
      await service.listPorts('TODOS');
      expect(mockPrisma.port.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: undefined }),
      );

      await service.upsertPort({ code: ' pecll ', name: ' Callao ', countryCode: 'pe', type: 'maritimo' });
      expect(mockPrisma.port.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'PECLL' },
          create: expect.objectContaining({ code: 'PECLL', country_code: 'PE', type: 'MARITIMO' }),
        }),
      );
      expect(await service.deletePort(' pecll ')).toEqual({ code: 'PECLL' });
    });

    it('actualiza tipo de cambio y sincroniza el tipo de cambio del día (API y fallback)', async () => {
      mockPrisma.exchangeRate.findUnique.mockResolvedValueOnce(null);
      await expect(service.updateExchangeRate('er-missing', { rate: 3.8 })).rejects.toThrow(NotFoundException);

      mockPrisma.exchangeRate.findUnique.mockResolvedValueOnce({ id: 'er-1' });
      mockPrisma.exchangeRate.update.mockResolvedValueOnce({ id: 'er-1', rate: 3.81, source: 'MANUAL' });
      expect((await service.updateExchangeRate('er-1', { rate: 3.81, source: 'MANUAL' })).rate).toBe(3.81);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ venta: 3.79 }),
      }) as any;
      mockPrisma.exchangeRate.upsert.mockResolvedValueOnce({ rate: 3.79, source: 'SUNAT' });
      const syncedOk = await service.syncTodayExchangeRate();
      expect(syncedOk.rate).toBe(3.79);

      globalThis.fetch = jest.fn().mockRejectedValueOnce(new Error('network error')) as any;
      mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce({ rate: 3.74, source: 'CACHE' });
      mockPrisma.exchangeRate.upsert.mockResolvedValueOnce({ rate: 3.74, source: 'CACHE' });
      const syncedFallback = await service.syncTodayExchangeRate();
      expect(syncedFallback.source).toBe('CACHE');
      globalThis.fetch = originalFetch;
    });
  });
});

