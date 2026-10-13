import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreateAccountingEntryDto } from '../../application/dto/createAccountingEntryDto';
import { ExportPleDto } from '../../application/dto/exportPleDto';
import { GenerateAccountingEntryUseCase } from '../../application/use-cases/generateAccountingEntryUseCase';
import { ExportPleTxtUseCase, PleExportResult } from '../../application/use-cases/exportPleTxtUseCase';
import { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';

@Controller('api/v1/accounting')
export class AccountingController {
  constructor(
    private readonly generateEntryUseCase: GenerateAccountingEntryUseCase,
    private readonly exportPleUseCase: ExportPleTxtUseCase,
  ) {}

  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  async createEntry(
    @Body() dto: CreateAccountingEntryDto,
  ): Promise<AccountingEntryEntity> {
    return this.generateEntryUseCase.execute(dto);
  }

  @Post('ple/export')
  @HttpCode(HttpStatus.OK)
  async exportPle(
    @Body() dto: ExportPleDto,
  ): Promise<PleExportResult> {
    return this.exportPleUseCase.execute(dto);
  }
}
