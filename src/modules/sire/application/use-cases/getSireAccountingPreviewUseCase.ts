import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ListAccountingAccountsUseCase } from '../../../accounting/application/use-cases/listAccountingAccountsUseCase';
import { AccountingMappingService } from '../../../accounting/application/services/accountingMappingService';
import type { SireLibroMenu } from '../dto/sireMenuQueryDto';
import type {
  SireAccountingPreviewEntry,
  SireAccountingPreviewResponse,
} from '../dto/sireAccountingPreviewResponseDto';
import {
  SIRE_ACCOUNTING_PREVIEW_REPOSITORY_PORT,
  type ISireAccountingPreviewRepositoryPort,
  type SireAccountingBookTotals,
} from '../../domain/ports/sireAccountingPreviewRepositoryPort';
import {
  SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT,
  type ISireAccountingMappingRepositoryPort,
} from '../../domain/ports/sireAccountingMappingRepositoryPort';
import {
  buildSireAccountingLines,
  type SireAccountingBookKind,
} from '../../domain/rules/sireAccountingMappingRule';

const BOOK_KIND: Record<SireLibroMenu, SireAccountingBookKind> = {
  RVIE_VENTAS: 'VENTAS',
  RCE_COMPRAS: 'COMPRAS',
};

function lastDayOfPeriod(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/**
 * Previsualización de los asientos que generaría el cierre SIRE.
 *
 * Lee los importes reales importados del periodo y el mapeo contable de la
 * empresa. No escribe en la base de datos: solo devuelve las líneas para que
 * el frontend las muestre antes de contabilizar.
 */
@Injectable()
export class GetSireAccountingPreviewUseCase {
  constructor(
    @Inject(SIRE_ACCOUNTING_PREVIEW_REPOSITORY_PORT)
    private readonly totalsRepository: ISireAccountingPreviewRepositoryPort,
    @Inject(SIRE_ACCOUNTING_MAPPING_REPOSITORY_PORT)
    private readonly mappingRepository: ISireAccountingMappingRepositoryPort,
    private readonly accountingAccounts: ListAccountingAccountsUseCase,
    @Optional()
    private readonly accountingMappings?: AccountingMappingService,
  ) {}

  async execute(
    companyId: string,
    period: string,
    libro?: SireLibroMenu,
  ): Promise<SireAccountingPreviewResponse> {
    const [totals, mappings, accounts] = await Promise.all([
      this.totalsRepository.findPeriodTotals(companyId, period),
      this.mappingRepository.findAll(companyId),
      this.accountingAccounts.execute(true),
    ]);

    if (mappings === null) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    const accountNames = new Map(
      accounts.map((account) => [account.code, account.name]),
    );
    const selected = libro
      ? totals.filter((book) => book.bookType === libro)
      : totals;
    const inherited = new Map<string, Array<{ tipoOperacion: string; cuentaContable: string }>>();
    for (const book of selected) {
      const kind = BOOK_KIND[book.bookType];
      inherited.set(book.bookType, await this.inheritedMappings(companyId, kind, accountNames));
    }

    const asientos = selected
      .map((book) => this.toEntry(book, period, [...(inherited.get(book.bookType) ?? []), ...mappings], accountNames))
      .filter((entry): entry is SireAccountingPreviewEntry => entry !== null);

    if (asientos.length === 0) {
      throw new NotFoundException(
        'No hay importes SIRE importados para el periodo.',
      );
    }

    return { periodo: period, asientos };
  }

  private async inheritedMappings(
    companyId: string,
    kind: SireAccountingBookKind,
    accountNames: Map<string, string>,
  ): Promise<Array<{ tipoOperacion: string; cuentaContable: string }>> {
    if (!this.accountingMappings) return [];
    const { accounts } = await this.accountingMappings.getAccountsForOperation(
      kind === 'VENTAS' ? 'SIRE_VENTAS' : 'SIRE_COMPRAS',
      companyId,
    );
    for (const item of Object.values(accounts)) {
      accountNames.set(item.code, item.name);
    }
    if (kind === 'VENTAS') {
      return [
        accounts.CXC && { tipoOperacion: 'VENTAS', cuentaContable: accounts.CXC.code },
        accounts.IGV && { tipoOperacion: 'IGV', cuentaContable: accounts.IGV.code },
        accounts.INGRESO && { tipoOperacion: 'BASE', cuentaContable: accounts.INGRESO.code },
      ].filter((item): item is { tipoOperacion: string; cuentaContable: string } => Boolean(item));
    }
    return [
      accounts.CXP && { tipoOperacion: 'COMPRAS', cuentaContable: accounts.CXP.code },
      accounts.IGV && { tipoOperacion: 'IGV', cuentaContable: accounts.IGV.code },
      accounts.COMPRA && { tipoOperacion: 'BASE', cuentaContable: accounts.COMPRA.code },
    ].filter((item): item is { tipoOperacion: string; cuentaContable: string } => Boolean(item));
  }

  private toEntry(
    book: SireAccountingBookTotals,
    period: string,
    mappings: ReadonlyArray<{
      tipoOperacion: string;
      cuentaContable: string;
    }>,
    accountNames: ReadonlyMap<string, string>,
  ): SireAccountingPreviewEntry | null {
    const kind = BOOK_KIND[book.bookType];
    const lineas = buildSireAccountingLines(kind, book, mappings, accountNames);
    if (lineas.length === 0) return null;

    return {
      libro: book.bookType,
      glosa: `Asiento SIRE ${kind === 'VENTAS' ? 'ventas' : 'compras'} ${period}`,
      fecha: lastDayOfPeriod(period),
      lineas,
      totales: {
        base: book.taxableBase,
        igv: book.igvAmount,
        total: book.totalAmount,
        comprobantes: book.comprobantes,
      },
    };
  }
}
