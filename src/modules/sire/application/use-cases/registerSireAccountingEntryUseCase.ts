import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';
import { ListAccountingAccountsUseCase } from '../../../accounting/application/use-cases/listAccountingAccountsUseCase';
import type { AccountingEntryEntity } from '../../../accounting/domain/entities/accountingEntryEntity';
import type { SireLibroMenu } from '../dto/sireMenuQueryDto';
import type { SireRecord } from '../../domain/entities/sireProposalEntity';
import {
  SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT,
  type ISireAccountingMappingRepositoryPort,
} from '../../domain/ports/sireAccountingMappingRepositoryPort';
import {
  buildSireAccountingLines,
  sumSireRecordTotals,
  type SireAccountingBookKind,
} from '../../domain/rules/sireAccountingMappingRule';

const BOOK_KIND: Record<SireLibroMenu, SireAccountingBookKind> = {
  RVIE_VENTAS: 'VENTAS',
  RCE_COMPRAS: 'COMPRAS',
};

function accountingPeriod(period: string): string {
  return `${period.slice(0, 4)}-${period.slice(4, 6)}`;
}

function entryDate(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  return new Date(Date.UTC(year, month, 0)).toISOString();
}

/**
 * Puente entre la conciliación SIRE y la contabilidad.
 *
 * Reutiliza `GenerateAccountingEntryUseCase` (no reimplementa reglas
 * contables) y le entrega un asiento resumen por libro y periodo. La clave de
 * idempotencia evita duplicados si la conciliación se repite.
 */
@Injectable()
export class RegisterSireAccountingEntryUseCase {
  constructor(
    @Inject(SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT)
    private readonly mappingRepository: ISireAccountingMappingRepositoryPort,
    private readonly accountingEntries: GenerateAccountingEntryUseCase,
    private readonly accountingAccounts: ListAccountingAccountsUseCase,
  ) {}

  async execute(
    companyId: string,
    period: string,
    libro: SireLibroMenu,
    records: ReadonlyArray<SireRecord>,
  ): Promise<AccountingEntryEntity | null> {
    if (records.length === 0) return null;

    const totals = sumSireRecordTotals(records);
    if (
      totals.taxableBase <= 0 &&
      totals.igvAmount <= 0 &&
      totals.totalAmount <= 0
    ) {
      return null;
    }

    const [mappings, accounts] = await Promise.all([
      this.mappingRepository.findAll(companyId),
      this.accountingAccounts.execute(true),
    ]);
    if (mappings === null) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    const accountNames = new Map(
      accounts.map((account) => [account.code, account.name]),
    );
    const kind = BOOK_KIND[libro];
    const lines = buildSireAccountingLines(
      kind,
      totals,
      mappings,
      accountNames,
    );
    if (lines.length === 0) return null;

    return this.accountingEntries.execute({
      companyId,
      period: accountingPeriod(period),
      entryDate: entryDate(period),
      glosa: `Asiento de conciliación SIRE ${kind === 'VENTAS' ? 'ventas' : 'compras'} ${period}`,
      sourceModule: 'SIRE',
      journalCode: 'SIRE',
      sourceReferenceId: `${period}-${libro}`,
      idempotencyKey: `sire-${period}-${libro}`,
      lines: lines.map((line, index) => ({
        lineOrder: index + 1,
        accountCode: line.cuenta,
        accountName: line.nombre,
        debitAmount: line.debe,
        creditAmount: line.haber,
      })),
    });
  }
}
