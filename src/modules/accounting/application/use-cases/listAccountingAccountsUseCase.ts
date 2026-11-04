import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type { AccountingAccountEntity } from '../../domain/entities/accountingAccountEntity';

@Injectable()
export class ListAccountingAccountsUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  execute(): Promise<AccountingAccountEntity[]> {
    return this.repository.findAccounts();
  }
}
