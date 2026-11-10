import { InventoryCatalogsService, SUNAT_OFFICIAL_UNITS } from '../../../src/modules/inventory/application/services/inventoryCatalogsService';
import { InventoryCatalogsController } from '../../../src/modules/inventory/infrastructure/controllers/inventoryCatalogsController';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('InventoryCatalogsService & Controller (Fase 2 - Mantenedores)', () => {
  let service: InventoryCatalogsService;
  let controller: InventoryCatalogsController;
  let mockPrisma: any;
  const companyId = 'comp-test-100';

  beforeEach(() => {
    mockPrisma = {
      sunatUnitMeasurement: {
        findMany: jest.fn().mockResolvedValue(SUNAT_OFFICIAL_UNITS),
        upsert: jest.fn(),
      },
      inventoryBrand: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryModel: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryCategory: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryManufacturer: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryTag: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new InventoryCatalogsService(mockPrisma);
    controller = new InventoryCatalogsController(service);
  });

  describe('Unidades y Tipos de Existencia SUNAT', () => {
    it('debe listar unidades oficiales de la Tabla 6 de SUNAT (NIU, KGM, BX, LTR, etc.)', async () => {
      const units = await controller.listUnits();
      expect(units.length).toBeGreaterThan(10);
      expect(units.some((u) => u.code === 'NIU')).toBe(true);
      expect(units.some((u) => u.code === 'KGM')).toBe(true);
      expect(units.some((u) => u.code === 'BX')).toBe(true);
    });

    it('debe listar tipos de existencia de la Tabla 5 de SUNAT (01 Mercaderías, 02 Prod. Terminado, etc.)', async () => {
      const types = await controller.listExistenceTypes();
      expect(types.length).toBe(6);
      expect(types.some((t) => t.code === '01')).toBe(true);
    });
  });

  describe('Mantenedor de Marcas', () => {
    it('requiere companyId autenticado para listar marcas', async () => {
      await expect(controller.listBrands(undefined)).rejects.toThrow(UnauthorizedException);
    });

    it('permite registrar una marca nueva y previene duplicados', async () => {
      mockPrisma.inventoryBrand.findFirst.mockResolvedValueOnce(null);
      mockPrisma.inventoryBrand.create.mockResolvedValueOnce({
        id: 'brand-1',
        name: 'Siderperú',
        code: 'SID',
      });

      const res = await controller.createBrand({ name: 'Siderperú', code: 'SID' }, companyId);
      expect(res.name).toBe('Siderperú');

      mockPrisma.inventoryBrand.findFirst.mockResolvedValueOnce({ id: 'brand-1', name: 'Siderperú' });
      await expect(controller.createBrand({ name: 'Siderperú' }, companyId)).rejects.toThrow(ConflictException);
    });

    it('permite editar una marca existente', async () => {
      mockPrisma.inventoryBrand.findFirst.mockResolvedValueOnce({ id: 'brand-1', company_id: companyId, name: 'Sider' });
      mockPrisma.inventoryBrand.findFirst.mockResolvedValueOnce(null); // No conflicto
      mockPrisma.inventoryBrand.update.mockResolvedValueOnce({
        id: 'brand-1',
        name: 'Siderperú Modificada',
        code: 'SID',
      });

      const updated = await controller.updateBrand('brand-1', { name: 'Siderperú Modificada' }, companyId);
      expect(updated.name).toBe('Siderperú Modificada');
    });
  });

  describe('Mantenedor de Categorías', () => {
    it('lista y crea categorías de inventario con código SUNAT', async () => {
      mockPrisma.inventoryCategory.findFirst.mockResolvedValueOnce(null);
      mockPrisma.inventoryCategory.create.mockResolvedValueOnce({
        id: 'cat-1',
        name: 'Cementos y Aglomerantes',
        code: 'CEM',
        sunat_code: '30111600',
      });

      const created = await controller.createCategory(
        { name: 'Cementos y Aglomerantes', code: 'CEM', sunat_code: '30111600' },
        companyId,
      );
      expect(created.code).toBe('CEM');
    });

    it('permite editar una categoría existente', async () => {
      mockPrisma.inventoryCategory.findFirst.mockResolvedValueOnce({ id: 'cat-1', company_id: companyId });
      mockPrisma.inventoryCategory.findFirst.mockResolvedValueOnce(null); // No conflicto
      mockPrisma.inventoryCategory.update.mockResolvedValueOnce({
        id: 'cat-1',
        name: 'Cementos Especiales',
        code: 'CEM-ESP',
      });

      const updated = await controller.updateCategory('cat-1', { name: 'Cementos Especiales', code: 'CEM-ESP' }, companyId);
      expect(updated.name).toBe('Cementos Especiales');
    });
  });

  describe('Mantenedor de Modelos', () => {
    it('permite editar un modelo existente', async () => {
      mockPrisma.inventoryModel.findFirst.mockResolvedValueOnce({ id: 'mod-1', company_id: companyId });
      mockPrisma.inventoryModel.findFirst.mockResolvedValueOnce(null); // No conflicto
      mockPrisma.inventoryModel.update.mockResolvedValueOnce({
        id: 'mod-1',
        name: 'GSB 13 RE Actualizado',
        code: 'MOD-GSB13',
      });

      const updated = await controller.updateModel('mod-1', { name: 'GSB 13 RE Actualizado' }, companyId);
      expect(updated.name).toBe('GSB 13 RE Actualizado');
    });
  });

  describe('Mantenedor de Fabricantes y Etiquetas', () => {
    it('crea fabricante con país de origen y etiqueta con color', async () => {
      mockPrisma.inventoryManufacturer.findFirst.mockResolvedValueOnce(null);
      mockPrisma.inventoryManufacturer.create.mockResolvedValueOnce({
        id: 'm-1',
        name: 'UNACEM Perú',
        country_code: 'PE',
      });

      const m = await controller.createManufacturer({ name: 'UNACEM Perú', country_code: 'PE' }, companyId);
      expect(m.name).toBe('UNACEM Perú');

      mockPrisma.inventoryTag.findFirst.mockResolvedValueOnce(null);
      mockPrisma.inventoryTag.create.mockResolvedValueOnce({
        id: 'tag-1',
        name: 'rotación-alta',
        color: 'emerald',
      });

      const tag = await controller.createTag({ name: 'rotación-alta', color: 'emerald' }, companyId);
      expect(tag.name).toBe('rotación-alta');
    });

    it('permite editar fabricante y etiqueta', async () => {
      mockPrisma.inventoryManufacturer.findFirst.mockResolvedValueOnce({ id: 'm-1', company_id: companyId });
      mockPrisma.inventoryManufacturer.findFirst.mockResolvedValueOnce(null);
      mockPrisma.inventoryManufacturer.update.mockResolvedValueOnce({ id: 'm-1', name: 'UNACEM S.A.A. Global' });

      const updatedManuf = await controller.updateManufacturer('m-1', { name: 'UNACEM S.A.A. Global' }, companyId);
      expect(updatedManuf.name).toBe('UNACEM S.A.A. Global');

      mockPrisma.inventoryTag.findFirst.mockResolvedValueOnce({ id: 't-1', company_id: companyId });
      mockPrisma.inventoryTag.findFirst.mockResolvedValueOnce(null);
      mockPrisma.inventoryTag.update.mockResolvedValueOnce({ id: 't-1', name: 'alta-rotacion-vip', color: 'purple' });

      const updatedTag = await controller.updateTag('t-1', { name: 'alta-rotacion-vip', color: 'purple' }, companyId);
      expect(updatedTag.color).toBe('purple');
    });
  });
});
