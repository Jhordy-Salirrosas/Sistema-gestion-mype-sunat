import { UnauthorizedException } from '@nestjs/common';
import { CollectionsController } from '../../../src/modules/collections/infrastructure/controllers/collectionsController';

describe('CollectionsController', () => {
  const service = {
    list: jest.fn().mockResolvedValue([{ id: 'c1' }]),
    create: jest.fn().mockResolvedValue({ id: 'c1' }),
    listReceivables: jest.fn().mockResolvedValue([{ id: 'i1' }]),
    annul: jest.fn().mockResolvedValue({ id: 'c1', status: 'ANULADO' }),
    customerStatement: jest.fn().mockResolvedValue({ totals: {} }),
  };
  const controller = new CollectionsController(service as never);

  it('delega cartera, listado y alta', async () => {
    await expect(controller.receivables('co1')).resolves.toEqual([{ id: 'i1' }]);
    await expect(controller.list('co1')).resolves.toEqual([{ id: 'c1' }]);
    await expect(controller.create({} as never, 'co1')).resolves.toEqual({ id: 'c1' });
    await expect(controller.annul('c1', 'co1')).resolves.toEqual({ id: 'c1', status: 'ANULADO' });
    await expect(controller.statement('20100070970', 'co1')).resolves.toEqual({ totals: {} });
  });

  it('exige empresa en todas las rutas', () => {
    expect(() => controller.receivables(undefined)).toThrow(UnauthorizedException);
    expect(() => controller.list(undefined)).toThrow(UnauthorizedException);
    expect(() => controller.create({} as never, undefined)).toThrow(UnauthorizedException);
    expect(() => controller.annul('c1', undefined)).toThrow(UnauthorizedException);
  });
});
