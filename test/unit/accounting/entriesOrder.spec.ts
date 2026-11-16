import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';

/**
 * El diario se lee en orden cronológico: fecha contable y, dentro del día, el
 * correlativo. Es el mismo orden del PLE 5.1, así la pantalla y el archivo que
 * se declara no se contradicen.
 */
describe('PrismaAccountingRepository · orden del libro diario', () => {
  const crearPrisma = () => ({
    accountingEntry: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  });

  it('pide los asientos por fecha y luego por número', async () => {
    const prisma = crearPrisma();
    const repositorio = new PrismaAccountingRepository(prisma as never);

    await repositorio.findEntriesByPeriod('empresa-1', '2026-11');

    expect(prisma.accountingEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { company_id: 'empresa-1', period: '2026-11' },
        orderBy: [{ entry_date: 'asc' }, { entry_number: 'asc' }],
      }),
    );
  });

  it('no ordena descendente (el diario se lee desde el primer asiento)', async () => {
    const prisma = crearPrisma();
    const repositorio = new PrismaAccountingRepository(prisma as never);

    await repositorio.findEntriesByPeriod('empresa-1', '2026-11');

    const orden = prisma.accountingEntry.findMany.mock.calls[0][0].orderBy;
    const direcciones = Array.isArray(orden) ? orden.map((o) => Object.values(o)[0]) : [Object.values(orden)[0]];
    expect(direcciones).not.toContain('desc');
  });
});
