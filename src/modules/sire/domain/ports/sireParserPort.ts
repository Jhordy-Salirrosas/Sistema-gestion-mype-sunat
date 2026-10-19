import type { SireProposalEntity } from '../entities/sireProposalEntity';

export const SIRE_PARSER_PORT = Symbol('SIRE_PARSER_PORT');

export interface SireParseFailure {
  line: number;
  reason: string;
}

export type ParsedSireProposal = Omit<
  SireProposalEntity,
  'companyId' | 'period' | 'bookType'
>;

export interface SireParseResult {
  records: ParsedSireProposal[];
  rejected: SireParseFailure[];
}

export interface ISireParserPort {
  parse(buffer: Uint8Array): SireParseResult;
}
