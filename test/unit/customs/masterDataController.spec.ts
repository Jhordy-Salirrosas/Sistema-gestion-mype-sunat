import { UnauthorizedException } from '@nestjs/common';
import { MasterDataController } from '../../../src/modules/customs/infrastructure/controllers/masterDataController';

describe('MasterDataController', () => {
  let controller: MasterDataController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      listCurrencies: jest.fn().mockResolvedValue([]),
      upsertCurrency: jest.fn().mockResolvedValue({ code: 'USD' }),
      deleteCurrency: jest.fn().mockResolvedValue({ code: 'USD' }),
      listExchangeRates: jest.fn().mockResolvedValue([]),
      createExchangeRate: jest.fn().mockResolvedValue({ id: 'er-1' }),
      deleteExchangeRate: jest.fn().mockResolvedValue({ id: 'er-1' }),
      listIncoterms: jest.fn().mockResolvedValue([]),
      upsertIncoterm: jest.fn().mockResolvedValue({ code: 'FOB' }),
      deleteIncoterm: jest.fn().mockResolvedValue({ code: 'FOB' }),
      listPartners: jest.fn().mockResolvedValue([]),
      getPartner: jest.fn().mockResolvedValue({ id: 'bp-1' }),
      createPartner: jest.fn().mockResolvedValue({ id: 'bp-1' }),
      updatePartner: jest.fn().mockResolvedValue({ id: 'bp-1' }),
      deletePartner: jest.fn().mockResolvedValue({ id: 'bp-1' }),
      addAddress: jest.fn().mockResolvedValue({ id: 'addr-1' }),
      addContact: jest.fn().mockResolvedValue({ id: 'cont-1' }),
      addBankAccount: jest.fn().mockResolvedValue({ id: 'bank-1' }),
      listDocumentTypes: jest.fn().mockResolvedValue([]),
      upsertDocumentType: jest.fn().mockResolvedValue({ code: 'BL' }),
      deleteDocumentType: jest.fn().mockResolvedValue({ code: 'BL' }),
      listAccountingMappings: jest.fn().mockResolvedValue([]),
      upsertAccountingMapping: jest.fn().mockResolvedValue({ id: 'map-1' }),
      listCustomsServices: jest.fn().mockResolvedValue([]),
      upsertCustomsService: jest.fn().mockResolvedValue({ id: 'srv-1' }),
      deleteCustomsService: jest.fn().mockResolvedValue({ success: true }),
    };

    controller = new MasterDataController(mockService);
  });

  it('valida companyId requerido en endpoints protegidos', async () => {
    expect(() => controller.listPartners(undefined)).toThrow(UnauthorizedException);
    expect(() => controller.getPartner(undefined, '1')).toThrow(UnauthorizedException);
    expect(() => controller.createPartner(undefined, {} as any)).toThrow(UnauthorizedException);
    expect(() => controller.updatePartner(undefined, '1', {} as any)).toThrow(UnauthorizedException);
    expect(() => controller.deletePartner(undefined, '1')).toThrow(UnauthorizedException);
    expect(() => controller.addAddress(undefined, '1', {} as any)).toThrow(UnauthorizedException);
    expect(() => controller.addContact(undefined, '1', {} as any)).toThrow(UnauthorizedException);
    expect(() => controller.addBankAccount(undefined, '1', {} as any)).toThrow(UnauthorizedException);
    expect(() => controller.listAccountingMappings(undefined)).toThrow(UnauthorizedException);
    expect(() => controller.upsertAccountingMapping(undefined, {} as any)).toThrow(UnauthorizedException);
    expect(() => controller.listCustomsServices(undefined)).toThrow(UnauthorizedException);
    expect(() => controller.upsertCustomsService(undefined, {} as any)).toThrow(UnauthorizedException);
    expect(() => controller.deleteCustomsService(undefined, 'SRV-1')).toThrow(UnauthorizedException);
  });

  it('delega correctamente en MasterDataService cuando se envía companyId', async () => {
    const comp = 'comp-1';

    await controller.listCurrencies();
    await controller.upsertCurrency({ code: 'USD', name: 'Dolar', symbol: '$' });
    await controller.deleteCurrency('USD');

    await controller.listExchangeRates();
    await controller.createExchangeRate({ baseCurrency: 'USD', quoteCurrency: 'PEN', rate: 3.8, date: '2026-01-01' });
    await controller.deleteExchangeRate('er-1');

    await controller.listIncoterms();
    await controller.upsertIncoterm({ code: 'FOB', name: 'Free on board' });
    await controller.deleteIncoterm('FOB');

    await controller.listPartners(comp, 'supplier', 'tech');
    await controller.getPartner(comp, 'bp-1');
    await controller.createPartner(comp, { docType: '6', docNumber: '20601234567', legalName: 'Tech SAC' });
    await controller.updatePartner(comp, 'bp-1', { legalName: 'Tech SAC Mod' });
    await controller.deletePartner(comp, 'bp-1');

    await controller.addAddress(comp, 'bp-1', { address: 'Av. Test 123' });
    await controller.addContact(comp, 'bp-1', { name: 'Carlos' });
    await controller.addBankAccount(comp, 'bp-1', { bankName: 'BCP', accountNumber: '123' });

    await controller.listDocumentTypes();
    await controller.upsertDocumentType({ code: 'BL', name: 'Bill of Lading' });
    await controller.deleteDocumentType('BL');

    await controller.listAccountingMappings(comp);
    await controller.upsertAccountingMapping(comp, { processCode: 'ADUANAS', roleCode: 'FOB', accountCode: '6011' });

    await controller.listCustomsServices(comp);
    await controller.upsertCustomsService(comp, { sku: 'SRV-TEST', name: 'Test', defaultCost: 100 });
    await controller.deleteCustomsService(comp, 'SRV-TEST');

    expect(mockService.listCurrencies).toHaveBeenCalled();
    expect(mockService.listPartners).toHaveBeenCalledWith(comp, 'supplier', 'tech');
    expect(mockService.upsertAccountingMapping).toHaveBeenCalled();
    expect(mockService.listCustomsServices).toHaveBeenCalledWith(comp);
    expect(mockService.upsertCustomsService).toHaveBeenCalledWith(comp, { sku: 'SRV-TEST', name: 'Test', defaultCost: 100 });
    expect(mockService.deleteCustomsService).toHaveBeenCalledWith(comp, 'SRV-TEST');
  });
});

