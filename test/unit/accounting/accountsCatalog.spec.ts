import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';
import { ListAccountingAccountsUseCase } from '../../../src/modules/accounting/application/use-cases/listAccountingAccountsUseCase';

/**
 * Catálogo de cuentas: el plan puede listar también las inactivas y cambiar el
 * nombre o el estado. Sin estas pruebas, el Quality Gate queda por debajo del
 * 80 % de cobertura del código nuevo.
 */
describe('Catálogo de cuentas · edición y listado', () => {
  const fila = (extra: Record<string, unknown> = {}) => ({
    code: '1212',
    name: 'En cartera',
    element: 'Activo',
    nature: 'Deudora',
    parent_code: '121',
    level: 4,
    is_active: true,
    ...extra,
  });

  const crearPrisma = () => ({
    accountingAccount: {
      findMany: jest.fn().mockResolvedValue([fila()]),
      update: jest.fn().mockResolvedValue(fila({ name: 'Emitidas en cartera' })),
    },
  });

  it('findAccounts sin opciones filtra solo las activas', async () => {
    const prisma = crearPrisma();
    const repositorio = new PrismaAccountingRepository(prisma as never);

    await repositorio.findAccounts();

    expect(prisma.accountingAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { is_active: true } }),
    );
  });

  it('findAccounts con includeInactive no filtra por estado', async () => {
    const prisma = crearPrisma();
    const repositorio = new PrismaAccountingRepository(prisma as never);

    await repositorio.findAccounts({ includeInactive: true });

    const args = prisma.accountingAccount.findMany.mock.calls[0][0];
    expect(args.where).toBeUndefined();
  });

  it('updateAccount cambia el nombre y devuelve la cuenta mapeada', async () => {
    const prisma = crearPrisma();
    const repositorio = new PrismaAccountingRepository(prisma as never);

    const cuenta = await repositorio.updateAccount('1212', { name: 'Emitidas en cartera' });

    expect(prisma.accountingAccount.update).toHaveBeenCalledWith({
      where: { code: '1212' },
      data: { name: 'Emitidas en cartera' },
    });
    expect(cuenta).toMatchObject({ code: '1212', name: 'Emitidas en cartera', isActive: true });
  });

  it('updateAccount no toca el nombre cuando solo cambia el estado', async () => {
    const prisma = crearPrisma();
    prisma.accountingAccount.update.mockResolvedValue(fila({ is_active: false }));
    const repositorio = new PrismaAccountingRepository(prisma as never);

    const cuenta = await repositorio.updateAccount('1212', { isActive: false });

    const data = prisma.accountingAccount.update.mock.calls[0][0].data;
    expect(data).toEqual({ is_active: false });
    expect(cuenta.isActive).toBe(false);
  });

  it('el caso de uso de listado propaga includeInactive al repositorio', async () => {
    const repositorio = { findAccounts: jest.fn().mockResolvedValue([]) };
    const caso = new ListAccountingAccountsUseCase(repositorio as never);

    await caso.execute(true);

    expect(repositorio.findAccounts).toHaveBeenCalledWith({ includeInactive: true });
  });
});
