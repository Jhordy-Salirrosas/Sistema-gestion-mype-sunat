import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  SIRE_PARSER_PORT,
  type ISireParserPort,
} from '../../domain/ports/sireParserPort';
import {
  SIRE_REPOSITORY_PORT,
  type ISireRepositoryPort,
} from '../../domain/ports/sireRepositoryPort';
import type { SirePeriodBookDto } from '../dto/sirePeriodBookDto';
import { toDomainBookType } from '../sireBookType';

@Injectable()
export class IngestSireProposalUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT)
    private readonly repository: ISireRepositoryPort,
    @Inject(SIRE_PARSER_PORT)
    private readonly parser: ISireParserPort,
  ) {}

  async execute(
    dto: SirePeriodBookDto,
    companyId: string,
    file: Buffer,
  ): Promise<{
    imported: number;
    rejected: number;
    errors: { line: number; reason: string }[];
  }> {
    if (!file.length) throw new BadRequestException('El archivo está vacío.');
    const bookType = toDomainBookType(dto.bookType);
    await this.repository.ensurePeriodOpen(companyId, dto.period, bookType);
    const parsed = this.parser.parse(file);
    if (!parsed.records.length) {
      throw new BadRequestException(
        'El archivo no contiene filas importables.',
      );
    }
    await this.repository.saveBatchProposals(
      parsed.records.map((record) => ({
        ...record,
        companyId,
        period: dto.period,
        bookType,
      })),
    );
    return {
      imported: parsed.records.length,
      rejected: parsed.rejected.length,
      errors: parsed.rejected,
    };
  }
}
