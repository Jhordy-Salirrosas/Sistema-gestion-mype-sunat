import { UnauthorizedException } from '@nestjs/common';
import { ImportQuotationController } from '../../../src/modules/customs/infrastructure/controllers/importQuotationController';
import { ImportQuotationService } from '../../../src/modules/customs/application/services/importQuotationService';

describe('ImportQuotationController', () => {
  let controller: ImportQuotationController;
  let service: Partial<jest.Mocked<ImportQuotationService>>;

  beforeEach(() => {
    service = {
      createQuotation: jest.fn().mockResolvedValue({ id: 'q1' } as any),
      listQuotations: jest.fn().mockResolvedValue({ total: 1, items: [] } as any),
      getQuotationById: jest.fn().mockResolvedValue({ id: 'q1' } as any),
      updateQuotation: jest.fn().mockResolvedValue({ id: 'q1' } as any),
      addProforma: jest.fn().mockResolvedValue({ id: 'p1' } as any),
      updateProforma: jest.fn().mockResolvedValue({ id: 'p1' } as any),
      deleteProforma: jest.fn().mockResolvedValue({ success: true } as any),
      awardProforma: jest.fn().mockResolvedValue({ quotationId: 'q1', awardedProformaId: 'p1' } as any),
    };
    controller = new ImportQuotationController(service as ImportQuotationService);
  });

  describe('createQuotation', () => {
    it('crea cotización cuando se provee companyId', async () => {
      const dto = { title: 'Lote Test', targetIncoterm: 'FOB', targetCurrency: 'USD' };
      const res = await controller.createQuotation('company-1', dto as any);
      expect(service.createQuotation).toHaveBeenCalledWith('company-1', dto);
      expect(res).toEqual({ id: 'q1' });
    });

    it('falla con UnauthorizedException si no hay companyId', async () => {
      await expect(controller.createQuotation(undefined, {} as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('listQuotations', () => {
    it('delega al servicio listQuotations', async () => {
      const res = await controller.listQuotations('company-1', 'EN_NEGOCIACION', 'filtro');
      expect(service.listQuotations).toHaveBeenCalledWith('company-1', {
        status: 'EN_NEGOCIACION',
        search: 'filtro',
      });
      expect(res.total).toBe(1);
    });
  });

  describe('getQuotationById', () => {
    it('obtiene cotización por id', async () => {
      const res = await controller.getQuotationById('q1', 'company-1');
      expect(service.getQuotationById).toHaveBeenCalledWith('company-1', 'q1');
      expect(res).toEqual({ id: 'q1' });
    });
  });

  describe('updateQuotation', () => {
    it('actualiza cotización', async () => {
      const dto = { title: 'Nuevo' };
      const res = await controller.updateQuotation('q1', 'company-1', dto as any);
      expect(service.updateQuotation).toHaveBeenCalledWith('company-1', 'q1', dto);
      expect(res).toEqual({ id: 'q1' });
    });
  });

  describe('proforma management', () => {
    it('añade proforma', async () => {
      const dto = { supplierName: 'S1', proformaNumber: 'P1', totalFob: 1000 };
      const res = await controller.addProforma('q1', 'company-1', dto as any);
      expect(service.addProforma).toHaveBeenCalledWith('company-1', 'q1', dto);
      expect(res).toEqual({ id: 'p1' });
    });

    it('actualiza proforma', async () => {
      const dto = { totalFob: 1200 };
      const res = await controller.updateProforma('q1', 'p1', 'company-1', dto as any);
      expect(service.updateProforma).toHaveBeenCalledWith('company-1', 'q1', 'p1', dto);
      expect(res).toEqual({ id: 'p1' });
    });

    it('elimina proforma', async () => {
      const res = await controller.deleteProforma('q1', 'p1', 'company-1');
      expect(service.deleteProforma).toHaveBeenCalledWith('company-1', 'q1', 'p1');
      expect(res.success).toBe(true);
    });

    it('adjudica proforma', async () => {
      const res = await controller.awardProforma('q1', 'p1', 'company-1');
      expect(service.awardProforma).toHaveBeenCalledWith('company-1', 'q1', 'p1');
      expect(res.awardedProformaId).toBe('p1');
    });
  });
});
