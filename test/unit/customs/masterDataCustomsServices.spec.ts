import { NotFoundException } from '@nestjs/common';
import { MasterDataService } from '../../../src/modules/customs/application/services/masterDataService';

describe('MasterDataService - Servicios Aduaneros', () => {
  let service: MasterDataService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      inventoryProduct: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new MasterDataService(prismaMock as any);
  });

  describe('listCustomsServices', () => {
    it('debe sembrar los servicios aduaneros normativos faltantes y listar el catálogo', async () => {
      // 1 de los 5 existe, los otros 4 no
      prismaMock.inventoryProduct.findUnique
        .mockResolvedValueOnce({ id: 'p-1', sku: 'SRV-AGENCIA-ADU' })
        .mockResolvedValue(null);

      prismaMock.inventoryProduct.create.mockResolvedValue({ id: 'created' });
      prismaMock.inventoryProduct.findMany.mockResolvedValue([
        { id: 'p-1', sku: 'SRV-AGENCIA-ADU', description: 'Agencia' },
        { id: 'p-2', sku: 'SRV-FLETE-LOCAL', description: 'Flete' },
      ]);

      const result = await service.listCustomsServices('company-1');

      expect(prismaMock.inventoryProduct.findUnique).toHaveBeenCalledTimes(5);
      expect(prismaMock.inventoryProduct.create).toHaveBeenCalledTimes(4);
      expect(prismaMock.inventoryProduct.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('upsertCustomsService', () => {
    it('debe actualizar servicio aduanero existente', async () => {
      prismaMock.inventoryProduct.findUnique.mockResolvedValue({
        id: 'p-1',
        category: 'SERVICIOS_ADUANEROS',
        sunat_unit_code: 'ZZ',
        tax_affectation: '10',
        cost_price: 300,
        sale_price: 400,
        is_active: true,
      });

      prismaMock.inventoryProduct.update.mockResolvedValue({
        id: 'p-1',
        sku: 'SRV-AGENCIA-ADU',
        description: 'Servicio Editado',
      });

      const res = await service.upsertCustomsService('company-1', {
        sku: 'srv-agencia-adu',
        description: 'Servicio Editado',
        costPrice: 350,
      });

      expect(prismaMock.inventoryProduct.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p-1' },
          data: expect.objectContaining({
            description: 'Servicio Editado',
            cost_price: 350,
            is_service: true,
          }),
        }),
      );
      expect(res.description).toBe('Servicio Editado');
    });

    it('debe crear un nuevo servicio aduanero si no existe', async () => {
      prismaMock.inventoryProduct.findUnique.mockResolvedValue(null);
      prismaMock.inventoryProduct.create.mockResolvedValue({
        id: 'new-p',
        sku: 'SRV-EXTRA',
        description: 'Servicio Nuevo',
      });

      const res = await service.upsertCustomsService('company-1', {
        sku: 'srv-extra',
        description: 'Servicio Nuevo',
        category: 'AGENCIA_ADUANA',
        sunatUnitCode: 'ZZ',
        taxAffectation: '10',
        costPrice: 200,
      });

      expect(prismaMock.inventoryProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            company_id: 'company-1',
            sku: 'SRV-EXTRA',
            description: 'Servicio Nuevo',
            is_service: true,
            is_inventory: false,
          }),
        }),
      );
      expect(res.id).toBe('new-p');
    });
  });

  describe('deleteCustomsService', () => {
    it('debe lanzar NotFoundException si el servicio no existe', async () => {
      prismaMock.inventoryProduct.findUnique.mockResolvedValue(null);

      await expect(service.deleteCustomsService('company-1', 'SRV-NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe desactivar lógicamente el servicio si existe', async () => {
      prismaMock.inventoryProduct.findUnique.mockResolvedValue({ id: 'p-1', sku: 'SRV-ESTIBA' });
      prismaMock.inventoryProduct.update.mockResolvedValue({ id: 'p-1', is_active: false });

      const res = await service.deleteCustomsService('company-1', 'srv-estiba');

      expect(prismaMock.inventoryProduct.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { is_active: false },
      });
      expect(res.is_active).toBe(false);
    });
  });
});
