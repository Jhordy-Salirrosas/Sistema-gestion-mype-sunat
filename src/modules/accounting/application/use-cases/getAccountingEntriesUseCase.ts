import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNTING_REPOSITORY_PORT } from '../../domain/ports/accountingRepositoryPort';
import type { IAccountingRepositoryPort } from '../../domain/ports/accountingRepositoryPort';
import { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';

@Injectable()
export class GetAccountingEntriesUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly accountingRepository: IAccountingRepositoryPort,
  ) {}

  async execute(companyId: string, period: string = '2026-10'): Promise<AccountingEntryEntity[]> {
    return this.accountingRepository.findEntriesByPeriod(companyId, period);
  }
}