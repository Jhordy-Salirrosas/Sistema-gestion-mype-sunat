import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';

/**
 * Elimina un período contable.
 *
 * Solo se permite si el mes no tiene asientos: borrar un período con
 * movimientos dejaría líneas contables huérfanas e inconsistentes. Para esos
 * casos el camino correcto es cerrarlo, no eliminarlo.
 */
@Injectable()
export class DeleteAccountingPeriodUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  async execute(companyId: string, period: string): Promise<{ period: string; deleted: true }> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('El período debe tener formato YYYY-MM');
    }
    const existente = await this.repository.findPeriod(companyId, period);
    if (!existente) {
      throw new NotFoundException(`El período ${period} no existe`);
    }
    const asientos = await this.repository.countEntriesByPeriod(companyId, period);
    if (asientos > 0) {
      throw new BadRequestException(
        `El período ${period} tiene ${asientos} asiento(s); ciérralo en lugar de eliminarlo.`,
      );
    }
    await this.repository.deletePeriod(companyId, period);
    return { period, deleted: true };
  }
}
