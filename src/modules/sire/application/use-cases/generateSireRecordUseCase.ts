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
export class GenerateSireRecordUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT) private readonly repository: ISireRepositoryPort,
    @Inject(SIRE_SUNAT_GATEWAY) private readonly sunat: SireSunatGatewayPort,
  ) {}

  async execute(dto: SirePeriodBookDto, companyId: string) {
    const bookType = toDomainBookType(dto.bookType);
    const period = await this.repository.getPeriod(companyId, dto.period, bookType);
    if (period?.state !== 'CON_PRELIMINAR') {
      throw new ConflictException('El periodo debe tener un preliminar antes de generarse.');
    }
    const result = await this.sunat.generateRecord(companyId, dto.period, bookType);
    await this.repository.setPeriodTicket(companyId, dto.period, bookType, 'PROCESANDO_GENERACION', result.ticket, 'GENERACION');
    return { ticket: result.ticket, state: 'PROCESANDO_GENERACION' };
  }
}
