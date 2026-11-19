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
export class RegisterSirePreliminaryUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT) private readonly repository: ISireRepositoryPort,
    @Inject(SIRE_SUNAT_GATEWAY) private readonly sunat: SireSunatGatewayPort,
  ) {}

  async execute(dto: SirePeriodBookDto, companyId: string) {
    const bookType = toDomainBookType(dto.bookType);
    const period = await this.repository.getPeriod(companyId, dto.period, bookType);
    if (period?.state === 'CON_PRELIMINAR' || period?.state === 'GENERADO') {
      throw new ConflictException('El periodo ya tiene preliminar o está generado.');
    }
    const proposals = await this.repository.getPeriodProposals(companyId, dto.period, bookType);
    const result = await this.sunat.registerPreliminary(companyId, dto.period, bookType, proposals);
    await this.repository.setPeriodTicket(companyId, dto.period, bookType, 'PROCESANDO_PRELIMINAR', result.ticket, 'REGISTRO_PRELIMINAR');
    return { ticket: result.ticket, state: 'PROCESANDO_PRELIMINAR' };
  }
}
