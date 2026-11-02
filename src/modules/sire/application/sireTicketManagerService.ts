import { Inject, Injectable } from '@nestjs/common';
import { toDomainBookType } from './sireBookType';
import {
  SIRE_REPOSITORY_PORT,
  type ISireRepositoryPort,
} from '../domain/ports/sireRepositoryPort';
import {
  SIRE_SUNAT_GATEWAY,
  type SireSunatGatewayPort,
} from '../domain/ports/sireSunatGatewayPort';

@Injectable()
export class SireTicketManagerService {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT) private readonly repository: ISireRepositoryPort,
    @Inject(SIRE_SUNAT_GATEWAY) private readonly sunat: SireSunatGatewayPort,
  ) {}

  async getPeriod(companyId: string, period: string, bookType: 'RVIE_VENTAS' | 'RCE_COMPRAS') {
    return this.repository.getPeriod(companyId, period, toDomainBookType(bookType));
  }

  async getRecords(companyId: string, period: string, bookType: 'RVIE_VENTAS' | 'RCE_COMPRAS') {
    return this.repository.getPeriodProposals(companyId, period, toDomainBookType(bookType));
  }

  async poll(companyId: string, period: string, apiBookType: 'RVIE_VENTAS' | 'RCE_COMPRAS') {
    const bookType = toDomainBookType(apiBookType);
    const record = await this.repository.getPeriod(companyId, period, bookType);
    if (!record?.ticket || !record.ticketOperation) return { status: 'SIN_TICKET' };

    const ticket = await this.sunat.getTicketStatus(companyId, record.ticket);
    if (ticket.status === 'PENDIENTE') return ticket;
    if (ticket.status === 'ERROR') {
      await this.repository.setPeriodState(companyId, period, bookType, 'ERROR', ticket.error ?? 'SUNAT reportó un error.');
      return ticket;
    }

    const nextState =
      record.ticketOperation === 'GENERACION'
        ? 'GENERADO'
        : record.ticketOperation === 'REGISTRO_PRELIMINAR'
          ? 'CON_PRELIMINAR'
          : 'PROPUESTA';
    await this.repository.setPeriodState(companyId, period, bookType, nextState);
    return { ...ticket, state: nextState };
  }
}
