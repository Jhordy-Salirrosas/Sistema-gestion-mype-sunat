import { Inject, Injectable } from '@nestjs/common';
import {
  SIRE_REPOSITORY_PORT,
  type ISireRepositoryPort,
} from '../../domain/ports/sireRepositoryPort';
import type { SirePeriodBookDto } from '../dto/sirePeriodBookDto';
import { toDomainBookType } from '../sireBookType';

@Injectable()
export class CloseFiscalPeriodUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT)
    private readonly repository: ISireRepositoryPort,
  ) {}

  async execute(dto: SirePeriodBookDto, companyId: string) {
    const bookType = toDomainBookType(dto.bookType);
    await this.repository.closeFiscalPeriod(companyId, dto.period, bookType);
    return {
      period: dto.period,
      bookType: dto.bookType,
      status: 'CERRADO' as const,
    };
  }
}
