import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type { AccountingAccountEntity } from '../../domain/entities/accountingAccountEntity';

/**
 * Edita una cuenta del catálogo: nombre y estado.
 *
 * No permite cambiar el código ni el padre: las líneas de asientos ya
 * registrados apuntan a ese código, y renombrarlo dejaría el histórico sin
 * referencia.
 */
@Injectable()
export class UpdateAccountingAccountUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  async execute(
    code: string,
    cambios: { name?: string; isActive?: boolean },
  ): Promise<AccountingAccountEntity> {
    const cuentas = await this.repository.findAccounts({ includeInactive: true });
    const cuenta = cuentas.find((item) => item.code === code);
    if (!cuenta) {
      throw new BadRequestException(`La cuenta PCGE ${code} no existe en el catálogo.`);
    }
    if (cambios.name === undefined && cambios.isActive === undefined) {
      throw new BadRequestException('Indica el nombre o el estado que quieres cambiar.');
    }

    return this.repository.updateAccount(code, cambios);
  }
}
