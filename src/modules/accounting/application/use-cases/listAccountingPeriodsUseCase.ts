import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type { AccountingPeriodEntity } from '../../domain/entities/accountingPeriodEntity';

@Injectable()
export class ListAccountingPeriodsUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  execute(companyId: string): Promise<AccountingPeriodEntity[]> {
    return this.repository.findPeriods(companyId);
  }
}
