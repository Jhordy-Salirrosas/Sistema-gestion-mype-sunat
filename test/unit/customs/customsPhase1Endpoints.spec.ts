import { UnauthorizedException } from '@nestjs/common';
import { MasterDataController } from '../../../src/modules/customs/infrastructure/controllers/masterDataController';
import { CustomsController } from '../../../src/modules/customs/infrastructure/controllers/customsController';
import { LandedCostController } from '../../../src/modules/customs/infrastructure/controllers/landedCostController';

describe('Fase 1: Customs Endpoints & Masters', () => {
  describe('MasterDataController (Countries, Ports & Exchange Rates)', () => {
    let controller: MasterDataController;
    let mockService: any;

    beforeEach(() => {
      mockService = {
        listCountries: jest.fn().mockResolvedValue([{ code: 'PE', name: 'Perú' }]),
        upsertCountry: jest.fn().mockResolvedValue({ code: 'CN', name: 'China' }),
        deleteCountry: jest.fn().mockResolvedValue({ code: 'CN' }),
        listPorts: jest.fn().mockResolvedValue([{ code: 'PECLL', name: 'Callao' }]),
        upsertPort: jest.fn().mockResolvedValue({ code: 'PECLL', name: 'Callao' }),
        deletePort: jest.fn().mockResolvedValue({ code: 'PECLL' }),
        updateExchangeRate: jest.fn().mockResolvedValue({ id: 'er-1', rate: 3.78 }),
        syncTodayExchangeRate: jest.fn().mockResolvedValue({ id: 'er-today', rate: 3.755, source: 'SUNAT' }),
      };
      controller = new MasterDataController(mockService);
    });

    it('gestiona países correctamente', async () => {
      const list = await controller.listCountries();
      expect(list).toHaveLength(1);
      expect(mockService.listCountries).toHaveBeenCalled();

      await controller.upsertCountry({ code: 'CN', name: 'China' });
      expect(mockService.upsertCountry).toHaveBeenCalledWith({ code: 'CN', name: 'China' });

      await controller.deleteCountry('CN');
      expect(mockService.deleteCountry).toHaveBeenCalledWith('CN');
    });

    it('gestiona puertos con filtro de tipo', async () => {
      const list = await controller.listPorts('DESTINO');
      expect(list).toHaveLength(1);
      expect(mockService.listPorts).toHaveBeenCalledWith('DESTINO');

      await controller.upsertPort({ code: 'PECLL', name: 'Callao', type: 'DESTINO' });
      expect(mockService.upsertPort).toHaveBeenCalled();

      await controller.deletePort('PECLL');
      expect(mockService.deletePort).toHaveBeenCalledWith('PECLL');
    });

    it('permite actualizar y sincronizar tipo de cambio del día', async () => {
      const updated = await controller.updateExchangeRate('er-1', { rate: 3.78 });
      expect(updated.rate).toBe(3.78);
      expect(mockService.updateExchangeRate).toHaveBeenCalledWith('er-1', { rate: 3.78 });

      const synced = await controller.syncTodayExchangeRate();
      expect(synced.source).toBe('SUNAT');
      expect(mockService.syncTodayExchangeRate).toHaveBeenCalled();
    });
  });

  describe('CustomsController (Documents & Catalogs)', () => {
    let controller: CustomsController;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        customsDeclarationDocument: {
          create: jest.fn().mockResolvedValue({ id: 'doc-1', format_type: 'FORMATO_A' }),
          findMany: jest.fn().mockResolvedValue([{ id: 'doc-1', format_type: 'FORMATO_A' }]),
        },
        customsBroker: {
          findMany: jest.fn().mockResolvedValue([{ id: 'b1', broker_code: '118' }]),
        },
        foreignSupplier: {
          findMany: jest.fn().mockResolvedValue([{ id: 's1', business_name: 'Shenzhen Tech' }]),
        },
      };

      controller = new CustomsController(
        { execute: jest.fn() } as any,
        { execute: jest.fn() } as any,
        { execute: jest.fn() } as any,
        { execute: jest.fn() } as any,
        undefined,
        undefined,
        mockPrisma,
      );
    });

    it('exige autenticación en subida y consulta de documentos DAM', async () => {
      await expect(
        controller.uploadDeclarationDocument('dec-1', undefined, {
          format_type: 'FORMATO_A',
          file_name: 'dam_a.pdf',
          storage_url: 'https://storage/dam_a.pdf',
        }),
      ).rejects.toThrow(UnauthorizedException);

      await expect(controller.getDeclarationDocuments('dec-1', undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('permite subir y listar documentos de formato A, B y C', async () => {
      const doc = await controller.uploadDeclarationDocument('dec-1', 'comp-1', {
        format_type: 'FORMATO_A',
        file_name: 'dam_a.pdf',
        storage_url: 'https://storage/dam_a.pdf',
      });
      expect(doc.format_type).toBe('FORMATO_A');
      expect(mockPrisma.customsDeclarationDocument.create).toHaveBeenCalled();

      const list = await controller.getDeclarationDocuments('dec-1', 'comp-1');
      expect(list).toHaveLength(1);
      expect(mockPrisma.customsDeclarationDocument.findMany).toHaveBeenCalledWith({
        where: { declaration_id: 'dec-1' },
        orderBy: { created_at: 'desc' },
      });
    });

    it('sirve catálogos de agentes y proveedores', async () => {
      const brokers = await controller.getCatalogsBrokers('Callao');
      expect(brokers).toHaveLength(1);
      expect(mockPrisma.customsBroker.findMany).toHaveBeenCalled();

      const suppliers = await controller.getCatalogsSuppliers('comp-1', 'Shenzhen');
      expect(suppliers).toHaveLength(1);
      expect(mockPrisma.foreignSupplier.findMany).toHaveBeenCalled();
    });
  });

  describe('LandedCostController (Eligible Invoices & Shipments)', () => {
    let controller: LandedCostController;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        nationalPurchase: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'pur-1', document_serial: 'F001', document_number: '123' },
          ]),
        },
        customsShipment: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'ship-1', shipment_number: 'EXP-2026-0001' },
          ]),
        },
      };

      controller = new LandedCostController(
        { execute: jest.fn() } as any,
        { execute: jest.fn() } as any,
        {} as any,
        undefined,
        undefined,
        mockPrisma,
      );
    });

    it('obtiene facturas locales y embarques elegibles para costeo', async () => {
      const invoices = await controller.getEligibleInvoices('comp-1');
      expect(invoices).toHaveLength(1);
      expect(mockPrisma.nationalPurchase.findMany).toHaveBeenCalled();

      const shipments = await controller.getEligibleShipments('comp-1');
      expect(shipments).toHaveLength(1);
      expect(mockPrisma.customsShipment.findMany).toHaveBeenCalled();
    });
  });
});

