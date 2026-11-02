import { ConflictException, Inject, Injectable } from '@nestjs/common';
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
export class ReplaceSireProposalUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT) private readonly repository: ISireRepositoryPort,
    @Inject(SIRE_SUNAT_GATEWAY) private readonly sunat: SireSunatGatewayPort,
  ) {}

  async execute(dto: SirePeriodBookDto, companyId: string, content: Buffer) {
    const bookType = toDomainBookType(dto.bookType);
    const period = await this.repository.getPeriod(companyId, dto.period, bookType);
    if (period?.state === 'GENERADO') {
      throw new ConflictException('El periodo ya fue generado y no admite cambios.');
    }
    const result = await this.sunat.replaceProposal(companyId, dto.period, bookType, content);
    await this.repository.setPeriodTicket(companyId, dto.period, bookType, 'PROCESANDO_REEMPLAZO', result.ticket, 'REEMPLAZO');
    return { ticket: result.ticket, state: 'PROCESANDO_REEMPLAZO' };
  }
}
