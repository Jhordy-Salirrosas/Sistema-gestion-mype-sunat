import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  SIRE_EXPORTER_PORT,
  type ISireExporterPort,
} from '../../domain/ports/sireExporterPort';
import {
  SIRE_REPOSITORY_PORT,
  type ISireRepositoryPort,
} from '../../domain/ports/sireRepositoryPort';
import type { SirePeriodBookDto } from '../dto/sirePeriodBookDto';
import { toDomainBookType } from '../sireBookType';

@Injectable()
export class ExportSireProposalUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT)
    private readonly repository: ISireRepositoryPort,
    @Inject(SIRE_EXPORTER_PORT)
    private readonly exporter: ISireExporterPort,
  ) {}

  async execute(dto: SirePeriodBookDto, companyId: string) {
    const result = await this.repository.findReconciliationForExport(
      companyId,
      dto.period,
      toDomainBookType(dto.bookType),
    );
    if (!result) {
      throw new NotFoundException('No existe conciliación para el periodo.');
    }
    return this.exporter.export({
      period: result.period,
      bookType: result.bookType,
      discrepancies: result.discrepancies,
    });
  }
}
