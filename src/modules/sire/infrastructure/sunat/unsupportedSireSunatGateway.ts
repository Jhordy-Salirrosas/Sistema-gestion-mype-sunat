import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SireDomainBookType } from '../../application/sireBookType';
import type { SireProposalEntity } from '../../domain/entities/sireProposalEntity';
import type {
  SireSunatGatewayPort,
  SireTicketResult,
  SireTicketState,
} from '../../domain/ports/sireSunatGatewayPort';

@Injectable()
export class UnsupportedSireSunatGateway implements SireSunatGatewayPort {
  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException(
      'El cliente SUNAT SIRE no está configurado para este ambiente.',
    );
  }

  getProposal(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
  ): Promise<SireProposalEntity[]> {
    return Promise.reject(this.unavailable());
  }

  excludeRecord(_companyId: string, _proposalId: string): Promise<void> {
    return Promise.reject(this.unavailable());
  }

  acceptProposal(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
  ): Promise<SireTicketResult> {
    return Promise.reject(this.unavailable());
  }

  restoreRecord(_companyId: string, _proposalId: string): Promise<void> {
    return Promise.reject(this.unavailable());
  }

  replaceProposal(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
    _content: Buffer,
  ): Promise<SireTicketResult> {
    return Promise.reject(this.unavailable());
  }

  registerPreliminary(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
    _proposals: SireProposalEntity[],
  ): Promise<SireTicketResult> {
    return Promise.reject(this.unavailable());
  }

  deletePreliminary(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
  ): Promise<SireTicketResult> {
    return Promise.reject(this.unavailable());
  }

  generateRecord(
    _companyId: string,
    _period: string,
    _bookType: SireDomainBookType,
  ): Promise<SireTicketResult> {
    return Promise.reject(this.unavailable());
  }

  getTicketStatus(
    _companyId: string,
    _ticket: string,
  ): Promise<SireTicketState> {
    return Promise.reject(this.unavailable());
  }
}
