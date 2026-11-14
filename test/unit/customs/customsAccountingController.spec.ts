import { UnauthorizedException } from '@nestjs/common';
import { CustomsAccountingController } from '../../../src/modules/customs/infrastructure/controllers/customsAccountingController';

describe('CustomsAccountingController', () => {
  let controller: CustomsAccountingController;
  let serviceMock: any;

  beforeEach(() => {
    serviceMock = {
      getMappingRules: jest.fn().mockResolvedValue([{ roleCode: 'FOB', accountCode: '6011' }]),
      upsertMappingRules: jest.fn().mockResolvedValue([{ roleCode: 'FOB', accountCode: '6011' }]),
      getAccountingSummary: jest.fn().mockResolvedValue({ shipmentId: 'exp-1', entries: [] }),
      syncToGeneralLedger: jest.fn().mockResolvedValue({ message: 'OK', createdCount: 6 }),
    };

    controller = new CustomsAccountingController(serviceMock);
  });

  describe('getMappingRules', () => {
    it('debe lanzar UnauthorizedException si no se provee companyId', async () => {
      await expect(controller.getMappingRules(undefined)).rejects.toThrow(UnauthorizedException);
    });

    it('debe retornar las reglas mapeadas si companyId es válido', async () => {
      const res = await controller.getMappingRules('company-123');
      expect(res).toEqual([{ roleCode: 'FOB', accountCode: '6011' }]);
      expect(serviceMock.getMappingRules).toHaveBeenCalledWith('company-123');
    });
  });

  describe('updateMappingRules', () => {
    it('debe lanzar UnauthorizedException si no hay companyId', async () => {
      await expect(controller.updateMappingRules({ rules: [] }, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe actualizar reglas correctamente con fallback de arreglo vacío', async () => {
      const res = await controller.updateMappingRules({ rules: [] }, 'company-123');
      expect(res).toBeDefined();
      expect(serviceMock.upsertMappingRules).toHaveBeenCalledWith('company-123', []);
    });

    it('debe manejar body sin propiedad rules', async () => {
      const res = await controller.updateMappingRules({} as any, 'company-123');
      expect(res).toBeDefined();
      expect(serviceMock.upsertMappingRules).toHaveBeenCalledWith('company-123', []);
    });
  });

  describe('getAccountingSummary', () => {
    it('debe lanzar UnauthorizedException si no hay companyId', async () => {
      await expect(controller.getAccountingSummary('exp-1', undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe retornar el resumen contable del expediente', async () => {
      const res = await controller.getAccountingSummary('exp-1', 'company-123');
      expect(res).toEqual({ shipmentId: 'exp-1', entries: [] });
      expect(serviceMock.getAccountingSummary).toHaveBeenCalledWith('company-123', 'exp-1');
    });
  });

  describe('syncToGeneralLedger', () => {
    it('debe lanzar UnauthorizedException si no hay companyId', async () => {
      await expect(controller.syncToGeneralLedger('exp-1', {}, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe sincronizar al libro diario con responsable personalizado o por defecto', async () => {
      const res = await controller.syncToGeneralLedger(
        'exp-1',
        { responsible: 'Carlos' },
        'company-123',
      );
      expect(res.message).toBe('OK');
      expect(serviceMock.syncToGeneralLedger).toHaveBeenCalledWith('company-123', 'exp-1', 'Carlos');
    });
  });
});
