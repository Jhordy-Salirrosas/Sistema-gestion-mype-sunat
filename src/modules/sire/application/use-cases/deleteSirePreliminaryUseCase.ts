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
export class DeleteSirePreliminaryUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT) private readonly repository: ISireRepositoryPort,
    @Inject(SIRE_SUNAT_GATEWAY) private readonly sunat: SireSunatGatewayPort,
  ) {}

  async execute(dto: SirePeriodBookDto, companyId: string) {
    const bookType = toDomainBookType(dto.bookType);
    const period = await this.repository.getPeriod(companyId, dto.period, bookType);
    if (period?.state !== 'CON_PRELIMINAR') {
      throw new ConflictException('Solo se puede eliminar un preliminar existente.');
    }
    const result = await this.sunat.deletePreliminary(companyId, dto.period, bookType);
    await this.repository.setPeriodTicket(companyId, dto.period, bookType, 'PROCESANDO_ELIMINACION', result.ticket, 'ELIMINACION_PRELIMINAR');
    return { ticket: result.ticket, state: 'PROCESANDO_ELIMINACION' };
  }
}
