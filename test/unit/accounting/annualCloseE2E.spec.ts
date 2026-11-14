import { GenerateAccountingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateAccountingEntryUseCase';
import { GenerateClosingEntryUseCase } from '../../../src/modules/accounting/application/use-cases/generateClosingEntryUseCase';
import { CloseAnnualUseCase } from '../../../src/modules/accounting/application/use-cases/closeAnnualUseCase';
import { OpenFiscalYearUseCase } from '../../../src/modules/accounting/application/use-cases/openFiscalYearUseCase';
import { CloseAccountingPeriodUseCase } from '../../../src/modules/accounting/application/use-cases/closeAccountingPeriodUseCase';
import { GetTrialBalanceUseCase } from '../../../src/modules/accounting/application/use-cases/getTrialBalanceUseCase';
import { PrismaAccountingRepository } from '../../../src/modules/accounting/infrastructure/prismaAccountingRepository';

/**
 * Cierre anual de extremo a extremo sobre una base en memoria.
 *
 * Recorre el flujo completo con los casos de uso reales y el repositorio real:
 * abrir el año, registrar venta, costo, compra y gasto, cerrar el período,
 * generar el asiento de cierre, cerrar el año y comprobar que no queda ningún
 * descuadre. No sustituye una prueba contra PostgreSQL, pero sí cubre la lógica
 * de cierre, la protección del período cerrado y la idempotencia del cierre,
 * que es donde se rompen las cosas.
 */

interface Fila {
  [clave: string]: any;
}

const CATALOGO = [
  { code: '10', name: 'Efectivo', element: 'Activo', nature: 'Deudora', parent_code: null, level: 2, is_active: true },
  { code: '1011', name: 'Caja principal', element: 'Activo', nature: 'Deudora', parent_code: '101', level: 4, is_active: true },
  { code: '12', name: 'Cuentas por cobrar', element: 'Activo', nature: 'Deudora', parent_code: null, level: 2, is_active: true },
  { code: '12121', name: 'Facturas por cobrar', element: 'Activo', nature: 'Deudora', parent_code: '1212', level: 5, is_active: true },
  { code: '20', name: 'Mercaderías', element: 'Activo', nature: 'Deudora', parent_code: null, level: 2, is_active: true },
  { code: '20111', name: 'Mercaderías manufacturadas', element: 'Activo', nature: 'Deudora', parent_code: '2011', level: 5, is_active: true },
  { code: '40', name: 'Tributos por pagar', element: 'Pasivo', nature: 'Acreedora', parent_code: null, level: 2, is_active: true },
  { code: '40111', name: 'IGV cuenta propia', element: 'Pasivo', nature: 'Acreedora', parent_code: '4011', level: 5, is_active: true },
  { code: '42', name: 'Cuentas por pagar', element: 'Pasivo', nature: 'Acreedora', parent_code: null, level: 2, is_active: true },
  { code: '42121', name: 'Facturas por pagar', element: 'Pasivo', nature: 'Acreedora', parent_code: '4212', level: 5, is_active: true },
  { code: '59', name: 'Resultados acumulados', element: 'Patrimonio', nature: 'Acreedora', parent_code: null, level: 2, is_active: true },
  { code: '60', name: 'Compras', element: 'Gastos', nature: 'Deudora', parent_code: null, level: 2, is_active: true },
  { code: '60111', name: 'Compras de mercaderías', element: 'Gastos', nature: 'Deudora', parent_code: '6011', level: 5, is_active: true },
  { code: '63', name: 'Servicios', element: 'Gastos', nature: 'Deudora', parent_code: null, level: 2, is_active: true },
  { code: '63111', name: 'Servicios prestados por terceros', element: 'Gastos', nature: 'Deudora', parent_code: '6311', level: 5, is_active: true },
  { code: '69', name: 'Costo de ventas', element: 'Gastos', nature: 'Deudora', parent_code: null, level: 2, is_active: true },
  { code: '69111', name: 'Costo de ventas de mercaderías', element: 'Gastos', nature: 'Deudora', parent_code: '6911', level: 5, is_active: true },
  { code: '70', name: 'Ventas', element: 'Ingresos', nature: 'Acreedora', parent_code: null, level: 2, is_active: true },
  { code: '70121', name: 'Ventas gravadas', element: 'Ingresos', nature: 'Acreedora', parent_code: '7012', level: 5, is_active: true },
];

/** Compara una fila contra un `where` de Prisma para los filtros que usa el repositorio. */
const coincide = (fila: Fila, where: Record<string, any> | undefined): boolean => {
  if (!where) return true;
  return Object.entries(where).every(([campo, esperado]) => {
    const valor = fila[campo];
    if (esperado && typeof esperado === 'object' && !Array.isArray(esperado)) {
      if ('startsWith' in esperado) return String(valor ?? '').startsWith(esperado.startsWith);
      if ('lt' in esperado) return String(valor ?? '') < esperado.lt;
      if ('in' in esperado) return esperado.in.includes(valor);
      return true;
    }
    if (Array.isArray(esperado)) return esperado.includes(valor);
    return valor === esperado;
  });
};

class PrismaEnMemoria {
  private secuencia = 0;
  cuentas: Fila[] = CATALOGO.map((c, i) => ({ id: `acc-${i}`, ...c }));
  asientos: Fila[] = [];
  periodos: Fila[] = [];
  anios: Fila[] = [];

  accountingAccount = {
    findMany: async ({ where }: any = {}) =>
      this.cuentas.filter((c) => (where?.is_active === undefined ? true : c.is_active === where.is_active)),
    create: async ({ data }: any) => {
      const fila = { id: `acc-${++this.secuencia}`, ...data };
      this.cuentas.push(fila);
      return fila;
    },
  };

  accountingEntry = {
    findFirst: async ({ where, orderBy }: any = {}) => {
      const filas = this.asientos.filter((a) => coincide(a, where));
      if (orderBy?.entry_number === 'desc') filas.sort((a, b) => b.entry_number - a.entry_number);
      return filas[0] ?? null;
    },
    findMany: async ({ where }: any = {}) => this.asientos.filter((a) => coincide(a, where)),
    create: async ({ data }: any) => {
      const { lines, ...cabecera } = data;
      const id = `entry-${++this.secuencia}`;
      const fila = {
        id,
        ...cabecera,
        lines: (lines?.create ?? []).map((l: Fila) => ({ id: `line-${++this.secuencia}`, entry_id: id, ...l })),
      };
      this.asientos.push(fila);
      return fila;
    },
    groupBy: async ({ by, where }: any) => {
      const periodos = new Map<string, { period: string }>();
      for (const asiento of this.asientos.filter((a) => coincide(a, where))) {
        const clave = String(asiento[by[0]]);
        periodos.set(clave, { [by[0]]: clave } as never);
      }
      return [...periodos.values()];
    },
    count: async ({ where }: any = {}) => this.asientos.filter((a) => coincide(a, where)).length,
  };

  accountingPeriod = {
    findUnique: async ({ where }: any) => {
      const clave = where.company_id_period;
      return this.periodos.find((p) => p.company_id === clave.company_id && p.period === clave.period) ?? null;
    },
    findMany: async ({ where }: any = {}) =>
      this.periodos
        .filter((p) => coincide(p, where))
        .sort((a, b) => (b.year - a.year) || (b.month - a.month)),
    upsert: async ({ where, update, create }: any) => {
      const clave = where.company_id_period;
      const existente = this.periodos.find((p) => p.company_id === clave.company_id && p.period === clave.period);
      if (existente) {
        Object.assign(existente, update);
        return existente;
      }
      const fila = { id: `per-${++this.secuencia}`, opened_at: new Date(), closed_at: null, ...create };
      this.periodos.push(fila);
      return fila;
    },
    updateMany: async ({ where, data }: any) => {
      const afectados = this.periodos.filter((p) => coincide(p, where));
      afectados.forEach((p) => Object.assign(p, data));
      return { count: afectados.length };
    },
  };

  accountingFiscalYear = {
    upsert: async ({ where, update, create }: any) => {
      const clave = where.company_id_year;
      const existente = this.anios.find((a) => a.company_id === clave.company_id && a.year === clave.year);
      if (existente) {
        Object.assign(existente, update);
        return existente;
      }
      const fila = { id: `year-${++this.secuencia}`, ...create };
      this.anios.push(fila);
      return fila;
    },
    updateMany: async ({ where, data }: any) => {
      const afectados = this.anios.filter((a) => coincide(a, where));
      afectados.forEach((a) => Object.assign(a, data));
      return { count: afectados.length };
    },
  };
}

const debeHaber = (asiento: Fila) => ({
  debe: Math.round(asiento.lines.reduce((s: number, l: Fila) => s + Number(l.debit_amount), 0) * 100) / 100,
  haber: Math.round(asiento.lines.reduce((s: number, l: Fila) => s + Number(l.credit_amount), 0) * 100) / 100,
});

describe('Cierre anual de extremo a extremo', () => {
  const COMPANY = 'c1';

  const montar = () => {
    const prisma = new PrismaEnMemoria();
    const repositorio = new PrismaAccountingRepository(prisma as never);
    const generar = new GenerateAccountingEntryUseCase(repositorio);
    const cierre = new GenerateClosingEntryUseCase(prisma as never, generar);
    return {
      prisma,
      repositorio,
      generar,
      abrirAnio: new OpenFiscalYearUseCase(repositorio),
      cerrarPeriodo: new CloseAccountingPeriodUseCase(repositorio),
      cerrarAnio: new CloseAnnualUseCase(repositorio, cierre),
      balance: new GetTrialBalanceUseCase(repositorio),
    };
  };

  const registrarOperaciones = async (generar: GenerateAccountingEntryUseCase) => {
    // Venta gravada.
    await generar.execute({
      companyId: COMPANY, period: '2026-11', entryDate: '2026-11-05T00:00:00.000Z',
      glosa: 'Venta F001-00000001', sourceModule: 'INVOICES', sourceReferenceId: 'inv-1',
      idempotencyKey: 'm1:invoice:inv-1',
      lines: [
        { lineOrder: 1, accountCode: '12121', accountName: 'CxC', debitAmount: 118, creditAmount: 0 },
        { lineOrder: 2, accountCode: '70121', accountName: 'Ventas', debitAmount: 0, creditAmount: 100 },
        { lineOrder: 3, accountCode: '40111', accountName: 'IGV', debitAmount: 0, creditAmount: 18 },
      ],
    });
    // Costo de la venta.
    await generar.execute({
      companyId: COMPANY, period: '2026-11', entryDate: '2026-11-05T00:00:00.000Z',
      glosa: 'Costo F001-00000001', sourceModule: 'M1_INVOICES', sourceReferenceId: 'inv-1:COSTO',
      idempotencyKey: 'm1:invoice-cost:inv-1',
      lines: [
        { lineOrder: 1, accountCode: '69111', accountName: 'Costo de ventas', debitAmount: 60, creditAmount: 0 },
        { lineOrder: 2, accountCode: '20111', accountName: 'Mercaderías', debitAmount: 0, creditAmount: 60 },
      ],
    });
    // Compra.
    await generar.execute({
      companyId: COMPANY, period: '2026-11', entryDate: '2026-11-08T00:00:00.000Z',
      glosa: 'Compra F001-00000077', sourceModule: 'PURCHASES', sourceReferenceId: 'C001-77',
      lines: [
        { lineOrder: 1, accountCode: '60111', accountName: 'Compras', debitAmount: 200, creditAmount: 0 },
        { lineOrder: 2, accountCode: '40111', accountName: 'IGV', debitAmount: 36, creditAmount: 0 },
        { lineOrder: 3, accountCode: '42121', accountName: 'CxP', debitAmount: 0, creditAmount: 236 },
      ],
    });
    // Gasto.
    await generar.execute({
      companyId: COMPANY, period: '2026-11', entryDate: '2026-11-10T00:00:00.000Z',
      glosa: 'Gasto de luz', sourceModule: 'EXPENSES', sourceReferenceId: 'exp-1',
      lines: [
        { lineOrder: 1, accountCode: '63111', accountName: 'Servicios', debitAmount: 50, creditAmount: 0 },
        { lineOrder: 2, accountCode: '42121', accountName: 'CxP', debitAmount: 0, creditAmount: 50 },
      ],
    });
  };

  it('abre el año, contabiliza, cierra el período, cierra el año y no deja descuadres', async () => {
    const { prisma, generar, abrirAnio, cerrarPeriodo, cerrarAnio, balance } = montar();

    const periodos = await abrirAnio.execute(COMPANY, 2026);
    expect(periodos).toHaveLength(12);
    expect(periodos.every((p) => p.status === 'ABIERTO')).toBe(true);

    await registrarOperaciones(generar);
    expect(prisma.asientos).toHaveLength(4);

    const trial = await balance.execute(COMPANY, '2026-11');
    expect(trial.totalDebit).toBe(trial.totalCredit);
    // 118 (venta) + 60 (costo) + 236 (compra) + 50 (gasto).
    expect(trial.totalDebit).toBe(464);

    const cerrado = await cerrarPeriodo.execute(COMPANY, '2026-11');
    expect(cerrado.status).toBe('CERRADO');

    // Un período cerrado ya no admite asientos nuevos.
    await expect(
      generar.execute({
        companyId: COMPANY, period: '2026-11', entryDate: '2026-11-30T00:00:00.000Z',
        glosa: 'Asiento tardío', sourceModule: 'MANUAL',
        lines: [
          { lineOrder: 1, accountCode: '63111', accountName: 'Servicios', debitAmount: 10, creditAmount: 0 },
          { lineOrder: 2, accountCode: '42121', accountName: 'CxP', debitAmount: 0, creditAmount: 10 },
        ],
      }),
    ).rejects.toThrow('está cerrado');

    const cierre = await cerrarAnio.execute(COMPANY, 2026);
    expect(cierre.closingEntryCreated).toBe(true);
    expect(cierre.periods.every((p) => p.status === 'CERRADO')).toBe(true);
    expect(prisma.anios[0].status).toBe('CERRADO');

    const asientoCierre = prisma.asientos.find((a) => a.source_module === 'CLOSING');
    expect(asientoCierre).toBeDefined();
    const { debe, haber } = debeHaber(asientoCierre!);
    expect(debe).toBe(haber);

    // El cierre lleva ingresos, gastos y resultado a la cuenta 59.
    const cuentasCierre = new Set(asientoCierre!.lines.map((l: Fila) => l.account_code));
    expect(cuentasCierre).toContain('70121');
    expect(cuentasCierre).toContain('69111');
    expect(cuentasCierre).toContain('63111');
    expect(cuentasCierre).toContain('59');

    // Ningún asiento del ejercicio queda descuadrado.
    for (const asiento of prisma.asientos) {
      const totales = debeHaber(asiento);
      expect(totales.debe).toBe(totales.haber);
    }
  });

  it('no duplica el asiento de cierre si se cierra dos veces', async () => {
    const { prisma, generar, abrirAnio, cerrarAnio } = montar();
    await abrirAnio.execute(COMPANY, 2026);
    await registrarOperaciones(generar);

    const primero = await cerrarAnio.execute(COMPANY, 2026);
    const segundo = await cerrarAnio.execute(COMPANY, 2026);

    expect(primero.closingEntryCreated).toBe(true);
    expect(segundo.closingEntryCreated).toBe(false);
    expect(prisma.asientos.filter((a) => a.source_module === 'CLOSING')).toHaveLength(1);
  });

  it('no permite cerrar un año sin asientos', async () => {
    const { abrirAnio, cerrarAnio } = montar();
    await abrirAnio.execute(COMPANY, 2026);
    await expect(cerrarAnio.execute(COMPANY, 2026)).rejects.toThrow('No hay asientos');
  });

  it('permite abrir el año siguiente después del cierre', async () => {
    const { generar, abrirAnio, cerrarAnio } = montar();
    await abrirAnio.execute(COMPANY, 2026);
    await registrarOperaciones(generar);
    await cerrarAnio.execute(COMPANY, 2026);

    const siguiente = await abrirAnio.execute(COMPANY, 2027);
    expect(siguiente.filter((p) => p.year === 2027)).toHaveLength(12);
    expect(siguiente.filter((p) => p.year === 2027).every((p) => p.status === 'ABIERTO')).toBe(true);
  });

  it('el resultado del cierre coincide con ingresos menos gastos', async () => {
    const { prisma, generar, abrirAnio, cerrarAnio } = montar();
    await abrirAnio.execute(COMPANY, 2026);
    await registrarOperaciones(generar);
    await cerrarAnio.execute(COMPANY, 2026);

    const cierre = prisma.asientos.find((a) => a.source_module === 'CLOSING')!;
    const saldo59 = cierre.lines
      .filter((l: Fila) => l.account_code === '59')
      .reduce((s: number, l: Fila) => s + Number(l.credit_amount) - Number(l.debit_amount), 0);
    // Ingresos 100 · gastos 60 (costo) + 200 (compras sin recepción) + 50 (servicios)
    // → resultado -210. La compra sin recepción queda como gasto del ejercicio.
    expect(Math.round(saldo59 * 100) / 100).toBe(-210);
  });
});
