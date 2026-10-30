import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
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

  // ==========================================
  // Endpoint GET para resolver el error 404
  // ==========================================
  @Get('entries')
  async getEntries(): Promise<any[]> {
    return []; // Retorna un listado vacío de asientos contables para evitar la falla en el Frontend
  }

  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  async createEntry(
    @Body() dto: CreateAccountingEntryDto,
    @CurrentCompany() currentCompanyId?: string,
  ): Promise<AccountingEntryEntity> {
    const companyId = currentCompanyId || dto.companyId || 'default-company-id';
    return this.generateEntryUseCase.execute({ ...dto, companyId });
  }

  @Post('ple/export')
  @HttpCode(HttpStatus.OK)
  async exportPle(
    @Body() dto: ExportPleDto,
    @CurrentCompany() currentCompanyId?: string,
  ): Promise<PleExportResult> {
    const companyId = currentCompanyId || dto.companyId || 'default-company-id';
    return this.exportPleUseCase.execute({ ...dto, companyId });
  }
}