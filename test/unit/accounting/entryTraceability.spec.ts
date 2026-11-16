import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';
import { AccountingEntryEntity } from '../../../src/modules/accounting/domain/entities/accountingEntryEntity';
import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';

/**
 * Los campos informativos del asiento manual (`observation` y `responsible`)
 * tienen que llegar desde el DTO hasta la fila y volver al leerla. Sin esto el
 * detalle mostraría "—" y el dato se perdería al guardar.
 */
describe('Asiento · observación y responsable', () => {
  const asiento = (extra: Record<string, unknown> = {}) =>
    new AccountingEntryEntity({
      companyId: 'c1',
      period: '2026-11',
      entryNumber: 7,
      entryDate: new Date('2026-11-16T00:00:00Z'),
      glosa: 'Ajuste por diferencia de caja',
      observation: 'Revisado con el contador',
      responsible: 'María Quispe',
      sourceModule: 'MANUAL',
      journalCode: 'OPV',
      lines: [
        { lineOrder: 1, accountCode: '1011', accountName: 'Caja', debitAmount: 10, creditAmount: 0 },
        { lineOrder: 2, accountCode: '7599', accountName: 'Otros ingresos', debitAmount: 0, creditAmount: 10 },
      ],
      ...extra,
    });

  const prismaGuardado = () => ({
    id: 'entry-1',
    company_id: 'c1',
    period: '2026-11',
    entry_number: 7,
    entry_date: new Date('2026-11-16T00:00:00Z'),
    glosa: 'Ajuste por diferencia de caja',
    observation: 'Revisado con el contador',
    responsible: 'María Quispe',
    status: 'ASENTADO',
  });

  const crearPrisma = () => ({
    accountingEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(prismaGuardado()),
      findMany: jest.fn().mockResolvedValue([prismaGuardado()]),
    },
    accountingLine: { createMany: jest.fn() },
  });

  it('saveEntry escribe la observación y el responsable', async () => {
    const prisma = crearPrisma();
    const repositorio = new PrismaAccountingRepository(prisma as never);

    const guardado = await repositorio.saveEntry(asiento());

    const datos = prisma.accountingEntry.create.mock.calls[0][0].data;
    expect(datos.observation).toBe('Revisado con el contador');
    expect(datos.responsible).toBe('María Quispe');
    expect(guardado.observation).toBe('Revisado con el contador');
    expect(guardado.responsible).toBe('María Quispe');
  });

  it('saveEntry deja null los campos cuando el asiento no los trae', async () => {
    const prisma = crearPrisma();
    const repositorio = new PrismaAccountingRepository(prisma as never);

    await repositorio.saveEntry(asiento({ observation: undefined, responsible: undefined }));

    const datos = prisma.accountingEntry.create.mock.calls[0][0].data;
    expect(datos.observation).toBeNull();
    expect(datos.responsible).toBeNull();
  });

  it('findEntriesByPeriod los devuelve al leer', async () => {
    const prisma = crearPrisma();
    prisma.accountingEntry.findMany.mockResolvedValue([
      { ...prismaGuardado(), lines: [] },
    ]);
    const repositorio = new PrismaAccountingRepository(prisma as never);

    const [leido] = await repositorio.findEntriesByPeriod('c1', '2026-11');

    expect(leido.observation).toBe('Revisado con el contador');
    expect(leido.responsible).toBe('María Quispe');
  });

  it('el caso de uso los toma del DTO al crear el asiento', async () => {
    const repositorio = {
      getNextEntryNumber: jest.fn().mockResolvedValue(3),
      validateAccountCodes: jest.fn().mockResolvedValue(undefined),
      saveEntry: jest.fn().mockImplementation(async (entry: AccountingEntryEntity) => entry),
    };
    const caso = new GenerateAccountingEntryUseCase(repositorio as never);

    const resultado = await caso.execute({
      companyId: 'c1',
      period: '2026-11',
      entryDate: '2026-11-16',
      glosa: 'Ajuste por diferencia de caja',
      observation: 'Revisado con el contador',
      responsible: 'María Quispe',
      sourceModule: 'MANUAL',
      lines: [
        { lineOrder: 1, accountCode: '1011', accountName: 'Caja', debitAmount: 10, creditAmount: 0 },
        { lineOrder: 2, accountCode: '7599', accountName: 'Otros ingresos', debitAmount: 0, creditAmount: 10 },
      ],
    } as never);

    expect(resultado.observation).toBe('Revisado con el contador');
    expect(resultado.responsible).toBe('María Quispe');
  });
});
