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
export class AcceptSireProposalUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT) private readonly repository: ISireRepositoryPort,
    @Inject(SIRE_SUNAT_GATEWAY) private readonly sunat: SireSunatGatewayPort,
  ) {}

  async execute(dto: SirePeriodBookDto, companyId: string, confirmed: boolean) {
    if (!confirmed) {
      throw new ConflictException('La aceptación requiere confirmed=true.');
    }
    const bookType = toDomainBookType(dto.bookType);
    const result = await this.sunat.acceptProposal(companyId, dto.period, bookType);
    await this.repository.setPeriodTicket(
      companyId,
      dto.period,
      bookType,
      'PROCESANDO_PRELIMINAR',
      result.ticket,
      'REGISTRO_PRELIMINAR',
    );
    return { ticket: result.ticket, state: 'PROCESANDO_PRELIMINAR' };
  }
}
