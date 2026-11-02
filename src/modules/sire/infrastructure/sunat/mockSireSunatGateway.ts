import { Injectable } from '@nestjs/common';
import type { SireDomainBookType } from '../../application/sireBookType';
import type { SireProposalEntity } from '../../domain/entities/sireProposalEntity';
import type {
  SireSunatGatewayPort,
  SireTicketResult,
  SireTicketState,
} from '../../domain/ports/sireSunatGatewayPort';

interface MockTicket {
  createdAt: number;
}

@Injectable()
export class MockSireSunatGateway implements SireSunatGatewayPort {
  private readonly tickets = new Map<string, MockTicket>();

  async getProposal(
    companyId: string,
    period: string,
    bookType: SireDomainBookType,
  ): Promise<SireProposalEntity[]> {
    return [
      this.proposal(companyId, period, bookType, 'CAR-MOCK-001', '20123456789', 'SUNAT'),
      this.proposal(companyId, period, bookType, 'CAR-MOCK-002', '20123456789', 'SUNAT'),
      this.proposal(companyId, period, bookType, 'CAR-MOCK-003', '20654321987', 'USUARIO'),
    ];
  }

  async excludeRecord(_companyId: string, _proposalId: string): Promise<void> {
    return Promise.resolve();
  }

  async acceptProposal(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
  ): Promise<SireTicketResult> {
    return this.createTicket('TICKET-MOCK-005');
  }

  async restoreRecord(_companyId: string, _proposalId: string): Promise<void> {
    return Promise.resolve();
  }

  async replaceProposal(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
    _content: Buffer,
  ): Promise<SireTicketResult> {
    return this.createTicket('TICKET-MOCK-001');
  }

  async registerPreliminary(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
    _proposals: SireProposalEntity[],
  ): Promise<SireTicketResult> {
    return this.createTicket('TICKET-MOCK-002');
  }

  async deletePreliminary(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
  ): Promise<SireTicketResult> {
    return this.createTicket('TICKET-MOCK-004');
  }

  async generateRecord(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
  ): Promise<SireTicketResult> {
    return this.createTicket('TICKET-MOCK-003');
  }

  async getTicketStatus(
    _companyId: string,
    ticket: string,
  ): Promise<SireTicketState> {
    const record = this.tickets.get(ticket);
    if (!record) {
      return {
        ticket,
        status: 'ERROR',
        error: 'El ticket mock no existe.',
      };
    }

    return {
      ticket,
      status: Date.now() - record.createdAt >= 3000 ? 'TERMINADO' : 'PENDIENTE',
    };
  }

  private createTicket(ticket: string): SireTicketResult {
    this.tickets.set(ticket, { createdAt: Date.now() });
    return { ticket };
  }

  private proposal(
    companyId: string,
    period: string,
    bookType: SireDomainBookType,
    carSunat: string,
    emitterRuc: string,
    origin: 'SUNAT' | 'USUARIO',
  ): SireProposalEntity {
    return {
      companyId,
      period,
      bookType,
      carSunat,
      emitterRuc,
      documentType: '01',
      series: 'F001',
      correlative: carSunat.slice(-3),
      issueDate: new Date(`${period.slice(0, 4)}-${period.slice(4)}-15T00:00:00.000Z`),
      taxableBase: 100,
      igvAmount: 18,
      totalAmount: 118,
      origin,
    };
  }
}
