import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type { AccountingAccountEntity } from '../../domain/entities/accountingAccountEntity';

/**
 * Edita una cuenta del catálogo: nombre, tipo (elemento) y estado.
 *
 * No permite cambiar el código: las líneas de asientos ya registrados apuntan a
 * él y renombrarlo dejaría el histórico sin referencia. La cuenta padre tampoco
 * se toca, porque implicaría mover la cuenta de jerarquía.
 */
@Injectable()
export class UpdateAccountingAccountUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  async execute(
    code: string,
    cambios: { name?: string; element?: string; isActive?: boolean },
  ): Promise<AccountingAccountEntity> {
    const cuentas = await this.repository.findAccounts({ includeInactive: true });
    const cuenta = cuentas.find((item) => item.code === code);
    if (!cuenta) {
      throw new BadRequestException(`La cuenta PCGE ${code} no existe en el catálogo.`);
    }
    if (cambios.name === undefined && cambios.element === undefined && cambios.isActive === undefined) {
      throw new BadRequestException('Indica el nombre, el tipo o el estado que quieres cambiar.');
    }

    return this.repository.updateAccount(code, cambios);
  }
}
