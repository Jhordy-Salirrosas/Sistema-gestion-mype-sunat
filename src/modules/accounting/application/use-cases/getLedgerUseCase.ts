import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';

@Injectable()
export class GetLedgerUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  async execute(
    companyId: string,
    period: string,
    accountCode: string,
    opciones: { soloDirectos?: boolean; desde?: string; hasta?: string } = {},
  ) {
    const normalizado = /^\d{4}-\d{1,2}$/.test(period)
      ? `${period.slice(0, 4)}-${period.slice(5).padStart(2, '0')}`
      : period;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalizado)) {
      throw new BadRequestException('El período debe tener formato YYYY-MM');
    }

    const accounts = await this.repository.findAccounts({ includeInactive: true });
    const hayRango = Boolean(opciones.desde?.trim() && opciones.hasta?.trim());

    if (!hayRango && !accountCode.trim()) {
      throw new BadRequestException('Selecciona una cuenta para el libro mayor');
    }

    // Rango de cuentas (por ejemplo 10 a 19): se consolidan todas las que caen
    // entre los dos códigos. El límite superior incluye sus subcuentas.
    const enRango = hayRango
      ? accounts.filter((item) => item.code >= opciones.desde!.trim() && item.code < `${opciones.hasta!.trim()}~`)
      : [];

    const account = hayRango
      ? null
      : accounts.find((item) => item.code === accountCode) ?? null;
    if (!hayRango && !account) {
      throw new BadRequestException(`La cuenta PCGE ${accountCode} no existe`);
    }

    // El detalle de una cuenta de mayor vive en sus subcuentas. Si se pide el
    // mayor, se muestran todas sus hijas; si se pide una subcuenta, solo esa.
    // `soloDirectos` deja únicamente los movimientos propios de la cuenta.
    const hijas = !account || opciones.soloDirectos
      ? []
      : accounts
          .filter((item) => item.code !== accountCode && item.code.startsWith(accountCode))
          .map((item) => item.code);
    const codigos = hayRango ? enRango.map((item) => item.code) : [accountCode, ...hijas];
    const porVariasCuentas = codigos.length > 1 && this.repository.findLedgerMovementsByAccounts;

    if (codigos.length === 0) {
      throw new BadRequestException('El rango de cuentas no coincide con ninguna cuenta del catálogo');
    }

    const rows = porVariasCuentas
      ? await this.repository.findLedgerMovementsByAccounts!(companyId, normalizado, codigos)
      : await this.repository.findLedgerMovements(companyId, normalizado, codigos[0]);

    // En un rango conviven cuentas deudoras y acreedoras: se respeta el signo de
    // cada una en lugar de aplicar el de la primera.
    const naturalezaPorCodigo = new Map(accounts.map((item) => [item.code, item.nature]));
    const factorDe = (code: string) => (naturalezaPorCodigo.get(code) === 'Acreedora' ? -1 : 1);
    const factor = account ? factorDe(account.code) : 1;
    const saldoInicial = porVariasCuentas && this.repository.findLedgerOpeningBalanceByAccounts
      ? await this.repository.findLedgerOpeningBalanceByAccounts(companyId, normalizado, codigos)
      : (await this.repository.findLedgerOpeningBalance?.(companyId, normalizado, codigos[0])) ?? 0;
    const openingBalance = Math.round(factor * saldoInicial * 100) / 100;
    let saldo = openingBalance;
    const movements = rows.map((row) => {
      // En un rango cada línea pertenece a una cuenta con su propia naturaleza.
      const signo = hayRango ? factorDe(row.accountCode ?? codigos[0]) : factor;
      saldo = Math.round((saldo + signo * (row.debit - row.credit)) * 100) / 100;
      return {
        ...row,
        entryDate: row.entryDate.toISOString().slice(0, 10),
        saldo,
      };
    });
    const totalDebit = Math.round(rows.reduce((sum, row) => sum + row.debit, 0) * 100) / 100;
    const totalCredit = Math.round(rows.reduce((sum, row) => sum + row.credit, 0) * 100) / 100;

    return {
      period: normalizado,
      accountCode: account ? account.code : `${opciones.desde!.trim()}-${opciones.hasta!.trim()}`,
      accountName: account
        ? account.name
        : `Cuentas del ${opciones.desde!.trim()} al ${opciones.hasta!.trim()}`,
      nature: account ? account.nature : 'Deudora',
      openingBalance,
      movements,
      totalDebit,
      totalCredit,
      // El saldo final incluye el de apertura: antes se calculaba solo con el
      // movimiento del período y una cuenta con arrastre cerraba mal.
      closingBalance: movements.length > 0 ? movements[movements.length - 1].saldo : openingBalance,
      /** Subcuentas incluidas en el mayor cuando se pide una cuenta de mayor. */
      subcuentas: codigos,
    };
  }
}
