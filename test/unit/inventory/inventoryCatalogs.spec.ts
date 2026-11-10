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
        upsert: jest.fn().mockResolvedValue({}),
      },
      inventoryBrand: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryModel: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryCategory: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryManufacturer: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryTag: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      user: {
        findMany: jest.fn(),
      },
      businessPartner: {
        findMany: jest.fn(),
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

  describe('Semillas automáticas, eliminaciones, conflictos y responsables autorizados', () => {
    it('precarga catálogos cuando las tablas están vacías', async () => {
      mockPrisma.sunatUnitMeasurement.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(SUNAT_OFFICIAL_UNITS);
      expect((await controller.listUnits()).length).toBeGreaterThan(10);
      expect(mockPrisma.sunatUnitMeasurement.upsert).toHaveBeenCalled();

      mockPrisma.inventoryBrand.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ code: 'SOL' }]);
      expect(await controller.listBrands(companyId)).toEqual([{ code: 'SOL' }]);
      expect(mockPrisma.inventoryBrand.create).toHaveBeenCalled();

      mockPrisma.inventoryModel.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ code: 'MOD-GSB13' }]);
      expect(await controller.listModels(companyId)).toEqual([{ code: 'MOD-GSB13' }]);
      expect(mockPrisma.inventoryModel.create).toHaveBeenCalled();

      mockPrisma.inventoryCategory.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ code: 'CEM' }]);
      expect(await controller.listCategories(companyId)).toEqual([{ code: 'CEM' }]);
      expect(mockPrisma.inventoryCategory.create).toHaveBeenCalled();

      mockPrisma.inventoryManufacturer.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ name: 'UNACEM S.A.A.' }]);
      expect(await controller.listManufacturers(companyId)).toEqual([{ name: 'UNACEM S.A.A.' }]);
      expect(mockPrisma.inventoryManufacturer.create).toHaveBeenCalled();

      mockPrisma.inventoryTag.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ name: 'alta-rotacion' }]);
      expect(await controller.listTags(companyId)).toEqual([{ name: 'alta-rotacion' }]);
      expect(mockPrisma.inventoryTag.create).toHaveBeenCalled();
    });

    it('crea modelos, valida conflictos y maneja inactivación/eliminación y NotFound', async () => {
      mockPrisma.inventoryModel.findFirst.mockResolvedValueOnce(null);
      mockPrisma.inventoryModel.create.mockResolvedValueOnce({ id: 'mod-2', code: 'MODX' });
      expect(await controller.createModel({ name: 'Taladro X', code: 'modx' }, companyId)).toEqual({
        id: 'mod-2',
        code: 'MODX',
      });

      mockPrisma.inventoryModel.findFirst.mockResolvedValueOnce({ id: 'mod-2' });
      await expect(controller.createModel({ name: 'Taladro X', code: 'modx' }, companyId)).rejects.toThrow(
        ConflictException,
      );

      mockPrisma.inventoryBrand.findFirst.mockResolvedValueOnce({ id: 'b-1' });
      mockPrisma.inventoryBrand.update.mockResolvedValueOnce({ id: 'b-1', is_active: false });
      expect((await controller.deleteBrand('b-1', companyId)).is_active).toBe(false);
      mockPrisma.inventoryBrand.findFirst.mockResolvedValueOnce(null);
      await expect(controller.deleteBrand('missing', companyId)).rejects.toThrow(NotFoundException);

      mockPrisma.inventoryModel.findFirst.mockResolvedValueOnce({ id: 'm-1' });
      mockPrisma.inventoryModel.update.mockResolvedValueOnce({ id: 'm-1', is_active: false });
      expect((await controller.deleteModel('m-1', companyId)).is_active).toBe(false);
      mockPrisma.inventoryModel.findFirst.mockResolvedValueOnce(null);
      await expect(controller.deleteModel('missing', companyId)).rejects.toThrow(NotFoundException);

      mockPrisma.inventoryCategory.findFirst.mockResolvedValueOnce({ id: 'c-1' });
      mockPrisma.inventoryCategory.update.mockResolvedValueOnce({ id: 'c-1', is_active: false });
      expect((await controller.deleteCategory('c-1', companyId)).is_active).toBe(false);
      mockPrisma.inventoryCategory.findFirst.mockResolvedValueOnce(null);
      await expect(controller.deleteCategory('missing', companyId)).rejects.toThrow(NotFoundException);

      mockPrisma.inventoryManufacturer.findFirst.mockResolvedValueOnce({ id: 'mf-1' });
      mockPrisma.inventoryManufacturer.update.mockResolvedValueOnce({ id: 'mf-1', is_active: false });
      expect((await controller.deleteManufacturer('mf-1', companyId)).is_active).toBe(false);
      mockPrisma.inventoryManufacturer.findFirst.mockResolvedValueOnce(null);
      await expect(controller.deleteManufacturer('missing', companyId)).rejects.toThrow(NotFoundException);

      mockPrisma.inventoryTag.findFirst.mockResolvedValueOnce({ id: 'tg-1' });
      mockPrisma.inventoryTag.delete.mockResolvedValueOnce({ id: 'tg-1' });
      expect(await controller.deleteTag('tg-1', companyId)).toEqual({ id: 'tg-1' });
      mockPrisma.inventoryTag.findFirst.mockResolvedValueOnce(null);
      await expect(controller.deleteTag('missing', companyId)).rejects.toThrow(NotFoundException);

      // Conflictos y NotFound en updates de catálogos + lectura directa cuando hay datos
      mockPrisma.inventoryBrand.findMany.mockResolvedValueOnce([{ id: 'b-1' }]);
      expect(await controller.listBrands(companyId)).toEqual([{ id: 'b-1' }]);

      mockPrisma.inventoryBrand.findFirst.mockResolvedValueOnce({ id: 'b-1' }).mockResolvedValueOnce({ id: 'b-2' });
      await expect(controller.updateBrand('b-1', { name: 'Dup' }, companyId)).rejects.toThrow(ConflictException);

      mockPrisma.inventoryModel.findFirst.mockResolvedValueOnce(null);
      await expect(controller.updateModel('missing', { name: 'X' }, companyId)).rejects.toThrow(NotFoundException);
      mockPrisma.inventoryModel.findFirst.mockResolvedValueOnce({ id: 'm-1' }).mockResolvedValueOnce({ id: 'm-2' });
      await expect(controller.updateModel('m-1', { code: 'DUP' }, companyId)).rejects.toThrow(ConflictException);

      mockPrisma.inventoryCategory.findFirst.mockResolvedValueOnce({ id: 'c-1' }).mockResolvedValueOnce({ id: 'c-2' });
      await expect(controller.updateCategory('c-1', { code: 'DUP' }, companyId)).rejects.toThrow(ConflictException);

      mockPrisma.inventoryManufacturer.findFirst.mockResolvedValueOnce({ id: 'mf-1' }).mockResolvedValueOnce({ id: 'mf-2' });
      await expect(controller.updateManufacturer('mf-1', { name: 'DUP' }, companyId)).rejects.toThrow(ConflictException);

      mockPrisma.inventoryTag.findFirst.mockResolvedValueOnce({ id: 'tg-1' }).mockResolvedValueOnce({ id: 'tg-2' });
      await expect(controller.updateTag('tg-1', { name: 'dup' }, companyId)).rejects.toThrow(ConflictException);

      // Ramas de listados no vacíos, creación duplicada/conflictos y limpieza de campos opcionales
      mockPrisma.inventoryModel.findMany.mockResolvedValueOnce([{ id: 'm-1' }]);
      expect(await controller.listModels(companyId)).toEqual([{ id: 'm-1' }]);
      mockPrisma.inventoryCategory.findMany.mockResolvedValueOnce([{ id: 'c-1' }]);
      expect(await controller.listCategories(companyId)).toEqual([{ id: 'c-1' }]);
      mockPrisma.inventoryManufacturer.findMany.mockResolvedValueOnce([{ id: 'mf-1' }]);
      expect(await controller.listManufacturers(companyId)).toEqual([{ id: 'mf-1' }]);
      mockPrisma.inventoryTag.findMany.mockResolvedValueOnce([{ id: 'tg-1' }]);
      expect(await controller.listTags(companyId)).toEqual([{ id: 'tg-1' }]);

      mockPrisma.inventoryBrand.findFirst.mockResolvedValueOnce(null);
      await expect(controller.updateBrand('b-1', {}, companyId)).rejects.toThrow(NotFoundException);
      mockPrisma.inventoryBrand.findFirst.mockResolvedValueOnce({ id: 'b-1' });
      await controller.updateBrand('b-1', { description: '', is_active: false }, companyId);

      mockPrisma.inventoryCategory.findFirst.mockResolvedValueOnce({ id: 'c-1' });
      await expect(controller.createCategory({ name: 'Cementos', code: 'CEM' }, companyId)).rejects.toThrow(ConflictException);
      mockPrisma.inventoryManufacturer.findFirst.mockResolvedValueOnce({ id: 'mf-1' });
      await expect(controller.createManufacturer({ name: 'UNACEM' }, companyId)).rejects.toThrow(ConflictException);

      mockPrisma.inventoryTag.findFirst.mockResolvedValueOnce({ id: 'tg-existing', name: 'promo' });
      expect((await controller.createTag({ name: ' PROMO ' }, companyId)).id).toBe('tg-existing');
      mockPrisma.inventoryTag.findFirst.mockResolvedValueOnce(null);
      await expect(controller.updateTag('missing', { color: 'blue' }, companyId)).rejects.toThrow(NotFoundException);
    });

    it('lista responsables autorizados (usuarios y transportistas) y valida companyId en endpoints', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u-1', full_name: 'Ana Ruiz', role: 'ALMACEN', email: 'ana@mype.pe' },
      ]);
      mockPrisma.businessPartner.findMany.mockResolvedValue([
        { id: 'bp-1', legal_name: 'Trans Express SAC', doc_number: '20555666777' },
      ]);

      const responsibles = await controller.listResponsibles(companyId);
      expect(responsibles.users[0]).toMatchObject({ id: 'u-1', name: 'Ana Ruiz', type: 'USER' });
      expect(responsibles.transporters[0]).toMatchObject({
        id: 'bp-1',
        name: 'Trans Express SAC (20555666777)',
        type: 'CARRIER',
      });

      await expect(controller.listModels(undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.createModel({ name: 'X' }, undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.updateModel('1', {}, undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.deleteModel('1', undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.listCategories(undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.createCategory({ name: 'X' }, undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.updateCategory('1', {}, undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.deleteCategory('1', undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.listManufacturers(undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.createManufacturer({ name: 'X' }, undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.updateManufacturer('1', {}, undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.deleteManufacturer('1', undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.listTags(undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.createTag({ name: 'X' }, undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.updateTag('1', {}, undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.deleteTag('1', undefined)).rejects.toThrow(UnauthorizedException);
      await expect(controller.listResponsibles(undefined)).rejects.toThrow(UnauthorizedException);
    });
  });
});
