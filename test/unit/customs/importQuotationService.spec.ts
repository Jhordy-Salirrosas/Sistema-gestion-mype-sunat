import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ImportQuotationService } from '../../../src/modules/customs/application/services/importQuotationService';

describe('ImportQuotationService', () => {
  let service: ImportQuotationService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      importQuotation: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      importProforma: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      importOrder: {
        count: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };
    service = new ImportQuotationService(prisma);
  });

  describe('listQuotations', () => {
    it('lista cotizaciones con y sin filtros', async () => {
      const mockList = [
        {
          id: 'q1',
          company_id: 'c1',
          quotation_number: 'COT-2026-0001',
          title: 'Importación 500 Cajas',
          target_incoterm: 'FOB',
          target_currency: 'USD',
          status: 'EN_NEGOCIACION',
          awarded_proforma_id: null,
          notes: 'Nota prueba',
          items: [{ sku: 'SKU-1', quantity: 100 }],
          created_at: new Date(),
          updated_at: new Date(),
          proformas: [],
          order: null,
        },
      ];
      prisma.importQuotation.findMany.mockResolvedValue(mockList);

      const result = await service.listQuotations('c1', { status: 'EN_NEGOCIACION', search: 'Cajas' });

      expect(prisma.importQuotation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            company_id: 'c1',
            status: 'EN_NEGOCIACION',
            OR: [
              { quotation_number: { contains: 'Cajas', mode: 'insensitive' } },
              { title: { contains: 'Cajas', mode: 'insensitive' } },
            ],
          }),
        }),
      );
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('q1');
      expect(result.items[0].quotationNumber).toBe('COT-2026-0001');
    });
  });

  describe('getQuotationById', () => {
    it('retorna la cotización si existe incluyendo mapeo de proformas y items', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue({
        id: 'q1',
        company_id: 'c1',
        quotation_number: 'COT-2026-0001',
        title: 'Lote Test',
        target_incoterm: 'FOB',
        target_currency: 'USD',
        status: 'EN_NEGOCIACION',
        proformas: [
          {
            id: 'p1',
            supplier_id: 'sup1',
            supplier_name: 'Foshan',
            supplier_country: 'CN',
            supplier: { contact_name: 'Chen', email: 'chen@foshan.cn', phone: '+86' },
            proforma_number: 'PI-01',
            incoterm: 'FOB',
            origin_port: 'SHA',
            currency_code: 'USD',
            total_fob: 7000,
            estimated_freight: 1000,
            estimated_insurance: 200,
            total_cif: 8200,
            lead_time_days: 20,
            payment_terms: 'TT',
            validity_date: new Date(),
            status: 'EN_EVALUACION',
            rejection_reason: null,
            notes: 'Nota',
            created_at: new Date(),
            items: [
              {
                id: 'it1',
                product_id: 'prod1',
                sku: 'SKU1',
                description: 'Desc',
                quantity: 100,
                unit_price: 70,
                total_fob: 7000,
                unit_code: 'NIU',
                hs_code: '6907',
              },
            ],
          },
        ],
        order: { id: 'ord1', order_number: 'OC-01', status: 'APROBADA' },
      });

      const res = await service.getQuotationById('c1', 'q1');
      expect(res.id).toBe('q1');
      expect(res.proformasCount).toBe(1);
      expect(res.proformas[0].items[0].sku).toBe('SKU1');
      expect(res.order?.orderNumber).toBe('OC-01');
    });

    it('lanza NotFoundException si no existe', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue(null);
      await expect(service.getQuotationById('c1', 'inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createQuotation', () => {
    it('crea una nueva cotización con número correlativo', async () => {
      prisma.importQuotation.count.mockResolvedValue(2);
      prisma.importQuotation.create.mockImplementation(({ data }: any) => ({
        id: 'q-new',
        ...data,
        proformas: [],
        created_at: new Date(),
        updated_at: new Date(),
      }));

      const res = await service.createQuotation('c1', {
        title: 'Mesa de cotización laptops',
        targetIncoterm: 'cif',
        targetCurrency: 'usd',
        notes: 'Notas de calidad',
        items: [{ sku: 'LAP-01', description: 'Laptop Gamer', quantity: 20, targetFobPrice: 500 }],
      });

      expect(prisma.importQuotation.count).toHaveBeenCalledWith({ where: { company_id: 'c1' } });
      expect(res.quotationNumber).toContain('-0003');
      expect(res.targetIncoterm).toBe('CIF');
      expect(res.title).toBe('Mesa de cotización laptops');
    });
  });

  describe('updateQuotation', () => {
    it('actualiza los datos de la cotización', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue({ id: 'q1', company_id: 'c1' });
      prisma.importQuotation.update.mockResolvedValue({
        id: 'q1',
        company_id: 'c1',
        quotation_number: 'COT-2026-0001',
        title: 'Nuevo Titulo',
        target_incoterm: 'FOB',
        target_currency: 'USD',
        status: 'EN_EVALUACION',
        notes: 'Nueva nota',
        items: [],
        proformas: [],
        order: null,
      });

      const res = await service.updateQuotation('c1', 'q1', {
        title: 'Nuevo Titulo',
        targetIncoterm: 'FOB',
        targetCurrency: 'USD',
        notes: 'Nueva nota',
        status: 'EN_EVALUACION',
      });

      expect(res.title).toBe('Nuevo Titulo');
    });

    it('lanza NotFoundException al actualizar cotización inexistente', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue(null);
      await expect(service.updateQuotation('c1', 'q-none', { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addProforma', () => {
    it('añade proforma calculando total FOB y CIF de sus items', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue({
        id: 'q1',
        company_id: 'c1',
        status: 'EN_NEGOCIACION',
      });
      prisma.importProforma.create.mockImplementation(({ data }: any) => ({
        id: 'prof-1',
        ...data,
      }));

      const res = await service.addProforma('c1', 'q1', {
        supplierName: 'Foshan Ceramics Co.',
        supplierCountry: 'CN',
        proformaNumber: 'PI-2026-88',
        incoterm: 'fob',
        totalFob: 0,
        estimatedFreight: 1200,
        estimatedInsurance: 300,
        items: [
          { description: 'Porcelanato', quantity: 100, unitPrice: 10 },
          { description: 'Pegamento', quantity: 50, unitPrice: 4 },
        ],
      });

      expect(prisma.importProforma.create).toHaveBeenCalled();
      expect(res.total_fob).toBe(1200); // 100*10 + 50*4 = 1200
      expect(res.total_cif).toBe(2700); // 1200 + 1200 + 300 = 2700
    });

    it('falla al agregar proforma a cotización inexistente o adjudicada', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue(null);
      await expect(
        service.addProforma('c1', 'q1', {
          supplierName: 'S',
          proformaNumber: '1',
          totalFob: 100,
        } as any),
      ).rejects.toThrow(NotFoundException);

      prisma.importQuotation.findFirst.mockResolvedValue({ id: 'q1', status: 'ADJUDICADA' });
      await expect(
        service.addProforma('c1', 'q1', {
          supplierName: 'S',
          proformaNumber: '1',
          totalFob: 100,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProforma', () => {
    it('actualiza proforma si existe', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue({ id: 'q1', company_id: 'c1' });
      prisma.importProforma.findFirst.mockResolvedValue({ id: 'p1', quotation_id: 'q1' });
      prisma.importProforma.update.mockResolvedValue({ id: 'p1', total_fob: 1500 });

      const res = await service.updateProforma('c1', 'q1', 'p1', { totalFob: 1500, leadTimeDays: 25 });
      expect(res.total_fob).toBe(1500);
    });

    it('lanza NotFoundException si la proforma o cotización no existe', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue(null);
      await expect(service.updateProforma('c1', 'q1', 'p1', {})).rejects.toThrow(NotFoundException);

      prisma.importQuotation.findFirst.mockResolvedValue({ id: 'q1', company_id: 'c1' });
      prisma.importProforma.findFirst.mockResolvedValue(null);
      await expect(service.updateProforma('c1', 'q1', 'p1', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProforma', () => {
    it('elimina proforma correctamente', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue({
        id: 'q1',
        company_id: 'c1',
        status: 'EN_NEGOCIACION',
      });
      prisma.importProforma.delete.mockResolvedValue({ id: 'p1' });

      const res = await service.deleteProforma('c1', 'q1', 'p1');
      expect(res.success).toBe(true);
      expect(prisma.importProforma.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });

    it('rechaza eliminación si la cotización ya fue adjudicada', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue({
        id: 'q1',
        company_id: 'c1',
        status: 'ADJUDICADA',
      });
      await expect(service.deleteProforma('c1', 'q1', 'p1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('awardProforma', () => {
    it('adjudica la proforma ganadora y genera automáticamente la Orden de Compra Internacional', async () => {
      const mockQuotation = {
        id: 'q1',
        company_id: 'c1',
        quotation_number: 'COT-2026-0001',
        status: 'EN_NEGOCIACION',
        proformas: [
          {
            id: 'p-winner',
            supplier_id: 'sup-1',
            supplier_name: 'Foshan Ceramics',
            supplier_country: 'CN',
            incoterm: 'FOB',
            currency_code: 'USD',
            origin_port: 'NINGBO',
            proforma_number: 'PI-WIN-01',
            total_fob: 7000,
            estimated_freight: 1500,
            estimated_insurance: 400,
            total_cif: 8900,
            items: [
              {
                product_id: 'prod-1',
                sku: 'PORC-6060',
                description: 'Porcelanato Carrara 60x60',
                quantity: 500,
                unit_price: 14,
                total_fob: 7000,
                unit_code: 'NIU',
                hs_code: '6907.21.00.00',
              },
            ],
          },
          {
            id: 'p-loser',
            supplier_name: 'Guangdong Tiles',
            rejection_reason: null,
            items: [],
          },
        ],
      };

      prisma.importQuotation.findFirst.mockResolvedValue(mockQuotation);
      prisma.importProforma.update.mockResolvedValue({});
      prisma.importQuotation.update.mockResolvedValue({});
      prisma.importOrder.count.mockResolvedValue(5);
      prisma.importOrder.create.mockResolvedValue({
        id: 'order-10',
        order_number: 'OC-2026-0006',
        total_fob: 7000,
        supplier_name: 'Foshan Ceramics',
      });

      const res = await service.awardProforma('c1', 'q1', 'p-winner');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.importProforma.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p-winner' },
          data: { status: 'GANADORA' },
        }),
      );
      expect(prisma.importProforma.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p-loser' },
          data: expect.objectContaining({ status: 'DESCARTADA_EN_CARTERA' }),
        }),
      );
      expect(prisma.importQuotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'q1' },
          data: { status: 'ADJUDICADA', awarded_proforma_id: 'p-winner' },
        }),
      );
      expect(prisma.importOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            company_id: 'c1',
            order_number: 'OC-2026-0006',
            total_fob: 7000,
            status: 'APROBADA',
            quotation_id: 'q1',
          }),
        }),
      );
      expect(res.awardedProformaId).toBe('p-winner');
      expect(res.generatedOrder.orderNumber).toBe('OC-2026-0006');
    });

    it('rechaza si ya fue adjudicada previamente', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue({
        id: 'q1',
        company_id: 'c1',
        status: 'ADJUDICADA',
        proformas: [],
      });
      await expect(service.awardProforma('c1', 'q1', 'p1')).rejects.toThrow(ConflictException);
    });

    it('rechaza si la proforma indicada no pertenece a la cotización', async () => {
      prisma.importQuotation.findFirst.mockResolvedValue({
        id: 'q1',
        company_id: 'c1',
        status: 'EN_NEGOCIACION',
        proformas: [{ id: 'otra-proforma' }],
      });
      await expect(service.awardProforma('c1', 'q1', 'p-no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
