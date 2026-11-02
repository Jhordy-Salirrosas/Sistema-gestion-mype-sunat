import { Inject, Injectable } from '@nestjs/common';
import { toDomainBookType } from '../sireBookType';
import type { SirePeriodBookDto } from '../dto/sirePeriodBookDto';
import {
  SIRE_REPOSITORY_PORT,
  type ISireRepositoryPort,
} from '../../domain/ports/sireRepositoryPort';
import {
  SIRE_SUNAT_GATEWAY,
  type SireSunatGatewayPort,
} from '../../domain/ports/sireSunatGatewayPort';

@Injectable()
export class GetSireProposalUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT) private readonly repository: ISireRepositoryPort,
    @Inject(SIRE_SUNAT_GATEWAY) private readonly sunat: SireSunatGatewayPort,
  ) {}

  async execute(dto: SirePeriodBookDto, companyId: string) {
    const bookType = toDomainBookType(dto.bookType);
    const proposals = await this.sunat.getProposal(companyId, dto.period, bookType);
    await this.repository.saveSunatProposal(companyId, dto.period, bookType, proposals);
    return { period: dto.period, bookType: dto.bookType, state: 'PROPUESTA', count: proposals.length };
  }
}
