import { Inject, Injectable } from '@nestjs/common';
import { CreateAccountingEntryDto } from '../dto/createAccountingEntryDto';
import { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';
import { DoubleEntryRule } from '../../domain/rules/doubleEntryRule';
import { ACCOUNTING_REPOSITORY_PORT } from '../../domain/ports/accountingRepositoryPort';
import type { IAccountingRepositoryPort } from '../../domain/ports/accountingRepositoryPort';

@Injectable()
export class GenerateAccountingEntryUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly accountingRepository: IAccountingRepositoryPort,
  ) {}

  async execute(dto: CreateAccountingEntryDto): Promise<AccountingEntryEntity> {
    const companyId = dto.companyId ?? '';
    const period = dto.period;

    // 1. Obtener dinámicamente el siguiente número correlativo
    const nextEntryNumber = await this.accountingRepository.getNextEntryNumber(companyId, period);

    // 2. Instanciar la entidad de dominio con el correlativo incremental
    const entry = new AccountingEntryEntity({
      companyId,
      period,
      entryNumber: nextEntryNumber,
      entryDate: new Date(dto.entryDate),
      glosa: dto.glosa,
      sourceModule: dto.sourceModule,
      sourceReferenceId: dto.sourceReferenceId,
      lines: dto.lines.map((l, index) => ({
        lineOrder: l.lineOrder ?? index + 1,
        accountCode: l.accountCode,
        accountName: l.accountName,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
      })),
    });

    // 3. Validación estricta del Principio de Partida Doble
    DoubleEntryRule.validate(entry);

    // 4. Persistir a través del puerto del repositorio
    return await this.accountingRepository.saveEntry(entry);
  }
}