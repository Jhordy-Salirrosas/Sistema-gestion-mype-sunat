import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IAccountingRepositoryPort } from '../domain/ports/accountingRepositoryPort';
import { AccountingEntryEntity } from '../domain/entities/accountingEntryEntity';
import { PrismaService } from '../../../database/prismaService';

/** Reintentos de numeración ante una colisión con otra emisión concurrente. */
const MAX_INTENTOS_NUMERO = 3;

/** `meta.target` de un P2002 de Prisma, normalizado a texto. */
const objetivoDelConflicto = (error: unknown): string =>
  String((error as { meta?: { target?: unknown } })?.meta?.target ?? '');

@Injectable()
export class PrismaAccountingRepository implements IAccountingRepositoryPort {
  private readonly logger = new Logger(PrismaAccountingRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async getNextEntryNumber(companyId: string, period: string): Promise<number> {
    const ultimo = await this.prisma.accountingEntry.findFirst({
      where: {
        company_id: companyId,
        period: period,
      },
      orderBy: { entry_number: 'desc' },
      select: { entry_number: true },
    });
    return (ultimo?.entry_number ?? 0) + 1;
  }

  async existsBySourceReference(
    companyId: string,
    sourceModule: string,
    sourceReferenceId: string,
  ): Promise<boolean> {
    const count = await this.prisma.accountingEntry.count({
      where: {
        company_id: companyId,
        source_module: sourceModule,
        source_reference_id: sourceReferenceId,
      },
    });
    return count > 0;
  }

  async saveEntry(entry: AccountingEntryEntity): Promise<AccountingEntryEntity> {
    const totalDebit = entry.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredit = entry.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001;

    const datos = {
      company_id: entry.companyId,
      period: entry.period,
      entry_date: entry.entryDate,
      glosa: entry.glosa,
      source_module: entry.sourceModule,
      journal_code: entry.journalCode,
      source_reference_id: entry.sourceReferenceId,
      idempotency_key: entry.idempotencyKey ?? null,
      total_debit: totalDebit,
      total_credit: totalCredit,
      is_balanced: isBalanced,
      lines: {
        create: entry.lines.map((l) => ({
          line_order: l.lineOrder,
          account_code: l.accountCode,
          account_name: l.accountName,
          debit_amount: l.debitAmount,
          credit_amount: l.creditAmount,
        })),
      },
    };

    // El número de asiento se calcula con un `findFirst + 1` fuera de
    // transacción: dos emisiones simultáneas del mismo período pueden calcular
    // el mismo número y la segunda choca contra el índice único. En vez de
    // devolver un error de base, se recalcula el número y se reintenta.
    let numero = Number(entry.entryNumber);

    for (let intento = 1; intento <= MAX_INTENTOS_NUMERO; intento += 1) {
      try {
        const persistido = await this.prisma.accountingEntry.create({
          data: { ...datos, entry_number: numero },
        });
        this.logger.debug(`Asiento ${persistido.id} guardado (número ${numero})`);
        return new AccountingEntryEntity({
          id: persistido.id,
          companyId: entry.companyId,
          period: entry.period,
          entryNumber: numero,
          entryDate: entry.entryDate,
          glosa: entry.glosa,
          sourceModule: entry.sourceModule,
          journalCode: entry.journalCode,
          sourceReferenceId: entry.sourceReferenceId,
          idempotencyKey: entry.idempotencyKey,
          status: entry.status,
          lines: [...entry.lines],
        });
      } catch (error) {
        const conflicto = (error as { code?: string }).code === 'P2002';
        const objetivo = objetivoDelConflicto(error);

        // Un reintento del mismo envío no debe fallar ni duplicar: si ya existe
        // un asiento con esa clave de idempotencia, ese es el resultado.
        if (conflicto && objetivo.includes('idempotency_key') && entry.idempotencyKey) {
          const existente = await this.findByIdempotencyKey(entry.companyId, entry.idempotencyKey);
          if (existente) {
            this.logger.warn(
              `Asiento ya existente para la clave ${entry.idempotencyKey}; se devuelve el original`,
            );
            return existente;
          }
        }

        const choqueDeNumero = conflicto && (objetivo === '' || objetivo.includes('entry_number'));
        if (!choqueDeNumero) {
          this.logger.error(`❌ ERROR AL GUARDAR EN SUPABASE: ${(error as Error).message}`);
          throw error;
        }

        if (intento === MAX_INTENTOS_NUMERO) {
          throw new BadRequestException(
            `No se pudo numerar el asiento del período ${entry.period} tras ${MAX_INTENTOS_NUMERO} intentos por emisiones simultáneas; reintente el registro.`,
          );
        }

        const siguiente = await this.getNextEntryNumber(entry.companyId, entry.period);
        this.logger.warn(
          `Colisión en el número ${numero} del período ${entry.period}; reintento con ${siguiente}`,
        );
        numero = siguiente;
      }
    }

    // Inalcanzable: el bucle lanza en el último intento.
    throw new BadRequestException('No se pudo guardar el asiento contable.');
  }

  async findByIdempotencyKey(companyId: string, key: string): Promise<AccountingEntryEntity | null> {
    const e = await this.prisma.accountingEntry.findFirst({
      where: { company_id: companyId, idempotency_key: key },
      include: { lines: true },
    });
    if (!e) return null;
    return new AccountingEntryEntity({
      id: e.id,
      companyId: e.company_id,
      period: e.period,
      entryNumber: e.entry_number,
      entryDate: e.entry_date,
      glosa: e.glosa,
      sourceModule: e.source_module,
      sourceReferenceId: e.source_reference_id ?? undefined,
      idempotencyKey: e.idempotency_key ?? undefined,
      lines: e.lines.map((l: any) => ({
        lineOrder: l.line_order,
        accountCode: l.account_code,
        accountName: l.account_name,
        debitAmount: Number(l.debit_amount),
        creditAmount: Number(l.credit_amount),
      })),
    });
  }

  async findEntriesByPeriod(companyId: string, period: string): Promise<AccountingEntryEntity[]> {
    const entries = await this.prisma.accountingEntry.findMany({
      where: { company_id: companyId, period },
      include: { lines: true },
      orderBy: { entry_number: 'asc' },
    });

    return entries.map(
      (e) =>
        new AccountingEntryEntity({
          id: e.id,
          companyId: e.company_id,
          period: e.period,
          entryNumber: e.entry_number,
          entryDate: e.entry_date,
          glosa: e.glosa,
          sourceModule: e.source_module,
          journalCode: e.journal_code ?? 'OPV',
          sourceReferenceId: e.source_reference_id ?? undefined,
          lines: e.lines.map((l: any) => ({
            lineOrder: l.line_order ?? l.lineOrder,
            accountCode: l.account_code ?? l.accountCode,
            accountName: l.account_name ?? l.accountName,
            debitAmount: Number(l.debit_amount ?? l.debitAmount ?? 0),
            creditAmount: Number(l.credit_amount ?? l.creditAmount ?? 0),
          })),
        }),
    );
  }

  async createAccount(account: { code: string; name: string; element: string; nature: 'Deudora' | 'Acreedora'; parentCode: string | null; level: number; isActive: boolean }) {
    const row = await this.prisma.accountingAccount.create({
      data: {
        code: account.code,
        name: account.name,
        element: account.element,
        nature: account.nature,
        parent_code: account.parentCode,
        level: account.level,
        is_active: account.isActive,
      },
    });
    return { code: row.code, name: row.name, element: row.element, nature: row.nature as 'Deudora' | 'Acreedora', parentCode: row.parent_code, level: row.level, isActive: row.is_active };
  }

  async findAccounts() {
    const rows = await this.prisma.accountingAccount.findMany({
      where: { is_active: true },
      orderBy: { code: 'asc' },
    });
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      element: row.element,
      nature: row.nature as 'Deudora' | 'Acreedora',
      parentCode: row.parent_code,
      level: row.level,
      isActive: row.is_active,
    }));
  }

  async findPeriods(companyId: string) {
    // Los asientos pueden existir antes de abrir el período manualmente.
    // Se materializan para que Períodos y Libro Diario no se contradigan.
    const usados = await this.prisma.accountingEntry.groupBy({
      by: ['period'],
      where: { company_id: companyId },
    });
    for (const { period } of usados) {
      const [year, month] = period.split('-').map(Number);
      await this.prisma.accountingPeriod.upsert({
        where: { company_id_period: { company_id: companyId, period } },
        update: {},
        create: { company_id: companyId, period, year, month, status: 'ABIERTO' },
      });
    }
    const rows = await this.prisma.accountingPeriod.findMany({
      where: { company_id: companyId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return rows.map((row) => this.mapPeriod(row));
  }

  async closeFiscalYear(companyId: string, year: number) {
    await this.prisma.accountingFiscalYear?.updateMany({
      where: { company_id: companyId, year },
      data: { status: 'CERRADO', closed_at: new Date() },
    });
    await this.prisma.accountingPeriod.updateMany({
      where: { company_id: companyId, year, status: 'ABIERTO' },
      data: { status: 'CERRADO', closed_at: new Date() },
    });
    return this.findPeriods(companyId);
  }

  async openFiscalYear(companyId: string, year: number) {
    await this.prisma.accountingFiscalYear?.upsert({
      where: { company_id_year: { company_id: companyId, year } },
      update: { status: 'ABIERTO', closed_at: null },
      create: { company_id: companyId, year, status: 'ABIERTO' },
    });
    for (let month = 1; month <= 12; month += 1) {
      await this.openPeriod(companyId, year, month);
    }
    return this.findPeriods(companyId);
  }

  async findPeriod(companyId: string, period: string) {
    const row = await this.prisma.accountingPeriod.findUnique({
      where: { company_id_period: { company_id: companyId, period } },
    });
    return row ? this.mapPeriod(row) : null;
  }

  async openPeriod(companyId: string, year: number, month: number) {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    // Reabrir un mes de un año cerrado debe reabrir también el ejercicio;
    // de lo contrario el período queda ABIERTO pero el año sigue bloqueado.
    await this.prisma.accountingFiscalYear?.updateMany({
      where: { company_id: companyId, year, status: 'CERRADO' },
      data: { status: 'ABIERTO', closed_at: null },
    });
    const row = await this.prisma.accountingPeriod.upsert({
      where: { company_id_period: { company_id: companyId, period } },
      update: { status: 'ABIERTO', closed_at: null },
      create: { company_id: companyId, period, year, month, status: 'ABIERTO' },
    });
    return this.mapPeriod(row);
  }

  async closePeriod(companyId: string, period: string) {
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(5, 7));
    const row = await this.prisma.accountingPeriod.upsert({
      where: { company_id_period: { company_id: companyId, period } },
      update: { status: 'CERRADO', closed_at: new Date() },
      create: {
        company_id: companyId,
        period,
        year,
        month,
        status: 'CERRADO',
        closed_at: new Date(),
      },
    });
    return this.mapPeriod(row);
  }

  async findLedgerOpeningBalance(companyId: string, period: string, accountCode: string) {
    const entries = await this.prisma.accountingEntry.findMany({
      where: { company_id: companyId, period: { lt: period } },
      include: { lines: { where: { account_code: accountCode } } },
    });
    return entries.reduce((sum, entry) => sum + entry.lines.reduce((s, l) => s + Number(l.debit_amount) - Number(l.credit_amount), 0), 0);
  }

  async findLedgerMovements(companyId: string, period: string, accountCode: string) {
    const entries = await this.prisma.accountingEntry.findMany({
      where: { company_id: companyId, period },
      include: { lines: true },
      orderBy: [{ entry_date: 'asc' }, { entry_number: 'asc' }],
    });
    return entries.flatMap((entry) =>
      entry.lines
        .filter((line) => line.account_code === accountCode)
        .map((line) => ({
          entryId: entry.id,
          entryNumber: entry.entry_number,
          entryDate: entry.entry_date,
          glosa: entry.glosa,
          sourceModule: entry.source_module,
          accountCode: line.account_code,
          accountName: line.account_name,
          debit: Number(line.debit_amount),
          credit: Number(line.credit_amount),
        })),
    );
  }

  async findTrialBalanceRows(companyId: string, period: string) {
    const entries = await this.prisma.accountingEntry.findMany({
      where: { company_id: companyId, period },
      include: { lines: true },
    });
    const rows = new Map<string, { accountCode: string; accountName: string; debit: number; credit: number }>();
    for (const entry of entries) {
      for (const line of entry.lines) {
        const actual = rows.get(line.account_code) ?? {
          accountCode: line.account_code,
          accountName: line.account_name,
          debit: 0,
          credit: 0,
        };
        actual.debit += Number(line.debit_amount);
        actual.credit += Number(line.credit_amount);
        rows.set(line.account_code, actual);
      }
    }
    return [...rows.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }

  private mapPeriod(row: {
    company_id: string;
    period: string;
    year: number;
    month: number;
    status: string;
    opened_at: Date;
    closed_at: Date | null;
  }) {
    return {
      companyId: row.company_id,
      period: row.period,
      year: row.year,
      month: row.month,
      status: row.status as 'ABIERTO' | 'CERRADO',
      openedAt: row.opened_at,
      closedAt: row.closed_at,
    };
  }
}
