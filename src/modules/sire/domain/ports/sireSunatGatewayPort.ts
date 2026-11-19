import type { SireDomainBookType } from '../../application/sireBookType';
import type { SireProposalEntity } from '../entities/sireProposalEntity';

export const SIRE_SUNAT_GATEWAY = Symbol('SIRE_SUNAT_GATEWAY');

export type SireTicketStatus = 'PENDIENTE' | 'TERMINADO' | 'ERROR';

export interface SireTicketResult {
  ticket: string;
}

export interface SireTicketState {
  ticket: string;
  status: SireTicketStatus;
  error?: string;
}

export interface SireSunatGatewayPort {
  getProposal(
    companyId: string,
    period: string,
    bookType: SireDomainBookType,
  ): Promise<SireProposalEntity[]>;
  acceptProposal(
    companyId: string,
    period: string,
    bookType: SireDomainBookType,
  ): Promise<SireTicketResult>;
  restoreRecord(
    companyId: string,
    proposalId: string,
  ): Promise<void>;
  excludeRecord(
    companyId: string,
    proposalId: string,
  ): Promise<void>;
  replaceProposal(
    companyId: string,
    period: string,
    bookType: SireDomainBookType,
    content: Buffer,
  ): Promise<SireTicketResult>;
  registerPreliminary(
    companyId: string,
    period: string,
    bookType: SireDomainBookType,
    proposals: SireProposalEntity[],
  ): Promise<SireTicketResult>;
  deletePreliminary(
    companyId: string,
    period: string,
    bookType: SireDomainBookType,
  ): Promise<SireTicketResult>;
  generateRecord(
    companyId: string,
    period: string,
    bookType: SireDomainBookType,
  ): Promise<SireTicketResult>;
  getTicketStatus(companyId: string, ticket: string): Promise<SireTicketState>;
}
