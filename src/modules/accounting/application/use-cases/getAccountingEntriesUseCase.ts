import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ACCOUNTING_REPOSITORY_PORT } from '../../domain/ports/accountingRepositoryPort';
import type { IAccountingRepositoryPort } from '../../domain/ports/accountingRepositoryPort';
import { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';

/** Periodo contable actual en formato `YYYY-MM` (zona local del servidor). */
export const periodoActual = (fecha = new Date()): string => {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}`;
};

/**
 * Lista los asientos de una empresa para un periodo.
 *
 * El periodo es obligatorio en la práctica: si no llega, se usa el mes
 * corriente. Antes estaba fijo en `2026-10`, así que la UI siempre mostraba
 * octubre aunque el usuario estuviera en otro mes.
 */
@Injectable()
export class GetAccountingEntriesUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly accountingRepository: IAccountingRepositoryPort,
  ) {}

  async execute(
    companyId: string,
    period: string = periodoActual(),
  ): Promise<AccountingEntryEntity[]> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException(
        'El periodo contable debe tener el formato YYYY-MM',
      );
    }
    return this.accountingRepository.findEntriesByPeriod(companyId, period);
  }
}
