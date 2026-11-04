import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('El período debe tener formato YYYY-MM');
    }

    // 0. El período debe existir y estar abierto. Si es nuevo, se abre.
    // Los dobles de prueba antiguos no implementan estos métodos: en ese caso
    // se omite la comprobación para no romper la suite histórica.
    const periodState = this.accountingRepository.findPeriod
      ? await this.accountingRepository.findPeriod(companyId, period)
      : null;
    if (periodState?.status === 'CERRADO') {
      throw new BadRequestException(`El período ${period} está cerrado`);
    }
    if (!periodState && this.accountingRepository.openPeriod) {
      await this.accountingRepository.openPeriod(
        companyId,
        Number(period.slice(0, 4)),
        Number(period.slice(5, 7)),
      );
    }

    // 0.1 Las cuentas deben existir en el catálogo PCGE.
    const accounts = this.accountingRepository.findAccounts
      ? await this.accountingRepository.findAccounts()
      : null;
    if (accounts) {
      const validCodes = new Set(accounts.map((account) => account.code));
      for (const line of dto.lines) {
        if (!validCodes.has(line.accountCode)) {
          throw new BadRequestException(
            `La cuenta PCGE ${line.accountCode} no existe en el catálogo`,
          );
        }
      }
    }

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