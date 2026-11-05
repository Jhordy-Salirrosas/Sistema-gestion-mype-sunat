import { ConflictException, NotFoundException } from '@nestjs/common';
import { MasterDataService } from '../../../src/modules/customs/application/services/masterDataService';

describe('MasterDataService', () => {
  let service: MasterDataService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      currency: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      exchangeRate: {
        findMany: jest.fn(),
        upsert: jest.fn(),
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
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      partnerContact: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      partnerBankAccount: {
        create: jest.fn(),
        deleteMany: jest.fn(),
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
      mockPrisma.businessPartner.findMany.mockResolvedValue([{ id: 'bp-1', legal_name: 'Tech Corp' }]);

      const res = await service.listPartners(companyId, 'supplier', 'tech');
      expect(res.length).toBe(1);
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
});

