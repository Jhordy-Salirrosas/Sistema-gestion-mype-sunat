import { CustomsSirePurchasesController } from '../../../src/modules/customs/infrastructure/controllers/customsSirePurchasesController';
import { UnauthorizedException } from '@nestjs/common';

describe('CustomsSirePurchasesController (cobertura restante)', () => {
  describe('CustomsSirePurchasesController', () => {
    let controller: CustomsSirePurchasesController;
    let customsRepoMock: any;
    let prismaMock: any;

    beforeEach(() => {
      customsRepoMock = {
        findDeclarationsByCompany: jest.fn().mockResolvedValue([
          {
            id: 'decl-1',
            duaNumber: '118-2026-10-048291',
            cifValuePen: 200000,
            adValoremAmountPen: 8000,
            igvIpmAmountPen: 37440,
            perceptionAmountPen: 8590,
            totalCustomsTaxesPen: 54030,
            numerationDate: new Date('2026-10-15'),
            channel: 'VERDE',
            items: [],
          },
        ]),
      };

      prismaMock = {
        company: {
          findUnique: jest.fn().mockResolvedValue({ ruc: '20601012341' }),
        },
      };

      controller = new CustomsSirePurchasesController(customsRepoMock, prismaMock);
    });

    it('debe rechazar getSirePurchasesRecords si no hay companyId', async () => {
      await expect(controller.getSirePurchasesRecords(undefined, '202610')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe ejecutar getSirePurchasesRecords con parseo de enteros', async () => {
      const res = await controller.getSirePurchasesRecords('comp-1', '202610');
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBe(1);
      expect(res[0].period).toBe('202610');
      expect(res[0].customs_code).toBe('118');
    });

    it('debe rechazar exportSirePurchases si no hay companyId', async () => {
      await expect(
        controller.exportSirePurchases(undefined, '2026', '10'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe exportar archivo TXT de SIRE 8.4 correctamente', async () => {
      const result = await controller.exportSirePurchases('comp-1', '2026', '10');
      expect(result.period).toBe('202610');
      expect(result.recordsCount).toBe(1);
      expect(result.ruc).toBe('20601012341');
      expect(result.fileName).toContain('LE20601012341');
    });
  });
});
