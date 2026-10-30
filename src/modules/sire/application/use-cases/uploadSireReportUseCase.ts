import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SIRE_REPOSITORY_PORT, type ISireRepositoryPort } from '../../domain/ports/sireRepositoryPort';
import { Inject } from '@nestjs/common';
import type { SirePeriodBookDto } from '../dto/sirePeriodBookDto';
import { toDomainBookType } from '../sireBookType';
import { SireReportFileParser } from '../../infrastructure/parsers/sireReportFileParser';

@Injectable()
export class UploadSireReportUseCase {
  constructor(
    @Inject(SIRE_REPOSITORY_PORT) private readonly repository: ISireRepositoryPort,
    private readonly parser: SireReportFileParser,
  ) {}

  async execute(
    dto: SirePeriodBookDto,
    companyId: string,
    file: { originalname: string; buffer: Buffer },
  ) {
    if (!file.buffer.length) throw new BadRequestException('El archivo está vacío.');
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    if (await this.repository.hasReportUploadHash(companyId, fileHash)) {
      throw new ConflictException('El archivo ya fue cargado para esta empresa.');
    }
    const parsed = this.parser.parse(file.buffer);
    if (!parsed.records.length) {
      throw new BadRequestException({
        message: 'El archivo no contiene filas válidas.',
        errors: parsed.rejected,
      });
    }
    const bookType = toDomainBookType(dto.bookType);
    const proposals = parsed.records.map((record) => ({
      ...record,
      companyId,
      period: dto.period,
      bookType,
    }));
    await this.repository.ensurePeriodOpen(companyId, dto.period, bookType);
    await this.repository.saveReportUpload({
      companyId,
      period: dto.period,
      bookType,
      fileName: file.originalname,
      fileHash,
      proposals,
    });
    return {
      imported: parsed.records.length,
      rejected: parsed.rejected.length,
      errors: parsed.rejected,
      fileHash,
      fileName: file.originalname,
      reportType: bookType,
    };
  }
}
