import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SIRE_REPOSITORY_PORT,
  type ISireRepositoryPort,
} from '../../domain/ports/sireRepositoryPort';
import {
  SIRE_SUNAT_GATEWAY,
  type SireSunatGatewayPort,
} from '../../domain/ports/sireSunatGatewayPort';

@Injectable()
export class ExcludeSireRecordUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT) private readonly repository: ISireRepositoryPort,
    @Inject(SIRE_SUNAT_GATEWAY) private readonly sunat: SireSunatGatewayPort,
  ) {}

  async execute(companyId: string, proposalId: string, userId: string) {
    const proposal = await this.repository.getProposal(companyId, proposalId);
    if (!proposal) throw new NotFoundException('El comprobante no existe.');
    if (proposal.periodState === 'GENERADO') {
      throw new ConflictException('El periodo ya fue generado y no admite cambios.');
    }
    await this.sunat.excludeRecord(companyId, proposalId);
    await this.repository.excludeSunatProposal(companyId, proposalId, userId);
    return { proposalId, excluded: true };
  }
}
