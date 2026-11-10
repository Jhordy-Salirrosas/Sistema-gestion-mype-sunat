import { UnauthorizedException } from '@nestjs/common';
import { ExpensesController } from '../../../src/modules/expenses/infrastructure/controllers/expensesController';

describe('ExpensesController', () => {
  const service = {
    list: jest.fn().mockResolvedValue([{ id: 'g1' }]),
    create: jest.fn().mockResolvedValue({ id: 'g1' }),
    pay: jest.fn().mockResolvedValue({ status: 'PAGADO' }),
    listPayments: jest.fn().mockResolvedValue([]),
  };
  const controller = new ExpensesController(service as never);

  it('delega listar, crear, pagar e historial', async () => {
    await expect(controller.list('c1')).resolves.toEqual([{ id: 'g1' }]);
    await expect(controller.create({} as never, 'c1')).resolves.toEqual({ id: 'g1' });
    await expect(controller.pay('g1', {}, 'c1')).resolves.toEqual({ status: 'PAGADO' });
    await expect(controller.listPayments('g1', 'c1')).resolves.toEqual([]);
  });

  it('exige empresa en todas las rutas', () => {
    expect(() => controller.list(undefined)).toThrow(UnauthorizedException);
    expect(() => controller.create({} as never, undefined)).toThrow(UnauthorizedException);
    expect(() => controller.pay('g1', {}, undefined)).toThrow(UnauthorizedException);
    expect(() => controller.listPayments('g1', undefined)).toThrow(UnauthorizedException);
  });
});
