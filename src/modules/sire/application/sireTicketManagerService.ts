import { Inject, Injectable } from '@nestjs/common';
import { toDomainBookType } from './sireBookType';
import {
  SIRE_REPOSITORY_PORT,
  type ISireRepositoryPort,
} from '../domain/ports/sireRepositoryPort';

/**
 * Lectura local del estado de los períodos y de sus comprobantes.
 *
 * No consulta SUNAT ni modifica estados: los endpoints que sondeaban tickets
 * de operaciones de escritura se eliminaron junto con esas operaciones.
 */
@Injectable()
export class SireTicketManagerService {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT)
    private readonly repository: ISireRepositoryPort,
  ) {}

  async getPeriod(companyId: string, period: string, bookType: 'RVIE_VENTAS' | 'RCE_COMPRAS') {
    return this.repository.getPeriod(companyId, period, toDomainBookType(bookType));
  }

  async getRecords(companyId: string, period: string, bookType: 'RVIE_VENTAS' | 'RCE_COMPRAS') {
    return this.repository.getPeriodProposals(companyId, period, toDomainBookType(bookType));
  }
}
