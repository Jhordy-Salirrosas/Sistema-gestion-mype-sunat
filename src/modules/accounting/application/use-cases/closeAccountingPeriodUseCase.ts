import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNTING_REPOSITORY_PORT,
  type IAccountingRepositoryPort,
} from '../../domain/ports/accountingRepositoryPort';
import type { AccountingPeriodEntity } from '../../domain/entities/accountingPeriodEntity';

/**
 * Cierra un período.
 *
 * Un mes con asientos descuadrados no se cierra: el descuadre pasaría al
 * ejercicio y el balance de comprobación dejaría de ser fiable. Se rechaza con
 * el número de asiento concreto para que se pueda corregir.
 */
@Injectable()
export class CloseAccountingPeriodUseCase {
  constructor(
    @Inject(ACCOUNTING_REPOSITORY_PORT)
    private readonly repository: IAccountingRepositoryPort,
  ) {}

  async execute(companyId: string, period: string): Promise<AccountingPeriodEntity> {
    const asientos = await this.repository.findEntriesByPeriod(companyId, period);
    const descuadrado = asientos.find((asiento) => {
      const lineas = asiento.lines ?? [];
      const debe = lineas.reduce((suma, linea) => suma + Number(linea.debitAmount ?? 0), 0);
      const haber = lineas.reduce((suma, linea) => suma + Number(linea.creditAmount ?? 0), 0);
      return lineas.length < 2 || Math.abs(debe - haber) > 0.01;
    });

    if (descuadrado) {
      const numero = (descuadrado as { entryNumber?: number }).entryNumber ?? '';
      throw new BadRequestException(
        `No se puede cerrar ${period}: el asiento ${numero} está descuadrado o no tiene líneas. Corrígelo antes de cerrar.`,
      );
    }

    return this.repository.closePeriod(companyId, period);
  }
}
