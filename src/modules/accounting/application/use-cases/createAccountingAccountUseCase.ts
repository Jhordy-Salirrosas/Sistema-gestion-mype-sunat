import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { ACCOUNTING_REPOSITORY_PORT, type IAccountingRepositoryPort } from '../../domain/ports/accountingRepositoryPort';
import type { AccountingAccountEntity } from '../../domain/entities/accountingAccountEntity';
import type { CreateAccountingAccountDto } from '../dto/createAccountingAccountDto';

const ELEMENTOS: Record<string, string> = {
  '1': 'Activo', '2': 'Activo realizable', '3': 'Activo inmovilizado',
  '4': 'Pasivo', '5': 'Patrimonio', '6': 'Gastos', '7': 'Ingresos',
  '8': 'Saldos intermediarios', '9': 'Contabilidad analítica',
};

@Injectable()
export class CreateAccountingAccountUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  async execute(dto: CreateAccountingAccountDto): Promise<AccountingAccountEntity> {
    const code = dto.code.trim();
    const parentCode = dto.parentCode?.trim() || (code.length > 1 ? code.slice(0, -1) : null);
    if (parentCode && parentCode.length >= code.length) {
      throw new BadRequestException('La cuenta padre debe tener menos dígitos que la cuenta.');
    }
    const existentes = await this.repository.findAccounts();
    if (existentes.some((c) => c.code === code)) {
      throw new ConflictException(`La cuenta ${code} ya existe.`);
    }
    if (parentCode && !existentes.some((c) => c.code === parentCode)) {
      throw new BadRequestException(`La cuenta padre ${parentCode} no existe.`);
    }
    return this.repository.createAccount({
      code,
      name: dto.name.trim(),
      element: ELEMENTOS[code[0]] ?? 'Sin elemento',
      nature: ['1', '2', '3', '6', '8', '9'].includes(code[0]) ? 'Deudora' : 'Acreedora',
      parentCode,
      level: code.length,
      isActive: true,
    });
  }
}
