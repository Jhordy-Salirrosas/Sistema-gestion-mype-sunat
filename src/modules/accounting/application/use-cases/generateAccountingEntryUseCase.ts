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
    if (dto.idempotencyKey) {
      const existente = await this.accountingRepository.findByIdempotencyKey(
        companyId,
        dto.idempotencyKey,
      );
      if (existente) return existente;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('El período debe tener formato YYYY-MM');
    }

    // Valida período y cuentas; abre el período si es nuevo.
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

    if (dto.sourceModule === 'MANUAL' && this.accountingRepository.findAccounts) {
      const catalogo = await this.accountingRepository.findAccounts();
      const padres = new Set(catalogo.map((c) => c.parentCode).filter((p): p is string => Boolean(p)));
      const inactivas = new Set(catalogo.filter((c) => c.isActive === false).map((c) => c.code));
      dto.lines.forEach((linea, index) => {
        if (padres.has(linea.accountCode)) {
          throw new BadRequestException(`Línea ${index + 1}: la cuenta ${linea.accountCode} es de mayor y tiene subcuentas; use una subcuenta.`);
        }
        if (inactivas.has(linea.accountCode)) {
          throw new BadRequestException(`Línea ${index + 1}: la cuenta ${linea.accountCode} está inactiva.`);
        }
      });
    }

    dto.lines.forEach((linea, index) => {
      const debe = Number(linea.debitAmount) || 0;
      const haber = Number(linea.creditAmount) || 0;
      if (debe < 0 || haber < 0) {
        throw new BadRequestException(`Línea ${index + 1}: los importes no pueden ser negativos.`);
      }
      if (debe > 0 && haber > 0) {
        throw new BadRequestException(`Línea ${index + 1}: registre debe o haber, no ambos.`);
      }
      if (debe === 0 && haber === 0) {
        throw new BadRequestException(`Línea ${index + 1}: el importe debe ser mayor que cero.`);
      }
    });

    const nextEntryNumber = await this.accountingRepository.getNextEntryNumber(companyId, period);

    const entry = new AccountingEntryEntity({
      companyId,
      period,
      entryNumber: nextEntryNumber,
      entryDate: new Date(dto.entryDate),
      glosa: dto.glosa,
      sourceModule: dto.sourceModule,
      journalCode: dto.journalCode,
      sourceReferenceId: dto.sourceReferenceId,
      idempotencyKey: dto.idempotencyKey,
      lines: dto.lines.map((l, index) => ({
        lineOrder: l.lineOrder ?? index + 1,
        accountCode: l.accountCode,
        accountName: l.accountName,
        debitAmount: l.debitAmount,
        creditAmount: l.creditAmount,
      })),
    });

    DoubleEntryRule.validate(entry);

    return await this.accountingRepository.saveEntry(entry);
  }
}