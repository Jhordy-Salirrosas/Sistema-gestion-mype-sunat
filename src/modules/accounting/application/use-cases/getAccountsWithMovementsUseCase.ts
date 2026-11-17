import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';

/**
 * Códigos de cuenta con movimientos en un período.
 *
 * Sirve al selector del libro mayor: con más de 1700 cuentas en el catálogo, en
 * un mes concreto solo una minoría tiene actividad.
 */
@Injectable()
export class GetAccountsWithMovementsUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  execute(companyId: string, period: string): Promise<string[]> {
    return this.repository.findAccountCodesWithMovements(companyId, period);
  }
}
