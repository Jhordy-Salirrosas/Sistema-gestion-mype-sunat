import { Inject, Injectable } from '@nestjs/common';
import { ACCOUNTING_REPOSITORY_PORT, type IAccountingRepositoryPort } from '../../domain/ports/accountingRepositoryPort';
import { GenerateClosingEntryUseCase } from './generateClosingEntryUseCase';

@Injectable()
export class CloseAnnualUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
    private readonly closingEntry: GenerateClosingEntryUseCase,
  ) {}

  async execute(companyId: string, year: number) {
    let cierre = null;
    let yaExistia = true;
    try {
      cierre = await this.closingEntry.execute(companyId, year);
      yaExistia = false;
    } catch (error) {
      const mensaje = (error as Error).message ?? '';
      if (!/ya existe/i.test(mensaje)) throw error;
    }
    const periods = await this.repository.closeFiscalYear(companyId, year);
    return { year, closingEntryCreated: !yaExistia, closingEntry: cierre, periods };
  }
}
