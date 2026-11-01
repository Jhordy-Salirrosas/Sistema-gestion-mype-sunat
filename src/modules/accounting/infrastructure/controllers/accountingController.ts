import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { CreateAccountingEntryDto } from '../../application/dto/createAccountingEntryDto';
import { ExportPleDto } from '../../application/dto/exportPleDto';
import { GenerateAccountingEntryUseCase } from '../../application/use-cases/generateAccountingEntryUseCase';
import { ExportPleTxtUseCase, PleExportResult } from '../../application/use-cases/exportPleTxtUseCase';
import { GetAccountingEntriesUseCase } from '../../application/use-cases/getAccountingEntriesUseCase';
import { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';

@Controller('api/v1/accounting')
export class AccountingController {
  constructor(
    private readonly generateEntryUseCase: GenerateAccountingEntryUseCase,
    private readonly exportPleUseCase: ExportPleTxtUseCase,
    private readonly getEntriesUseCase: GetAccountingEntriesUseCase,
  ) {}

  // ==========================================
  // GET: Obtener lista de asientos de la empresa
  // ==========================================
  @Get('entries')
  async getEntries(
    @CurrentCompany() currentCompanyId?: string,
    @Query('companyId') queryCompanyId?: string,
  ): Promise<AccountingEntryEntity[]> {
    const companyId = currentCompanyId || queryCompanyId || '5eaccb4e-a6ec-4f23-9909-85fe7fc9e879';
    return this.getEntriesUseCase.execute(companyId);
  }

  // ==========================================
  // POST: Crear un nuevo asiento contable
  // ==========================================
  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  async createEntry(
    @Body() dto: CreateAccountingEntryDto,
    @CurrentCompany() currentCompanyId?: string,
  ): Promise<AccountingEntryEntity> {
    const companyId = currentCompanyId || dto.companyId || '5eaccb4e-a6ec-4f23-9909-85fe7fc9e879';
    return this.generateEntryUseCase.execute({ ...dto, companyId });
  }

  // ==========================================
  // POST: Generar la trama oficial PLE para SUNAT
  // ==========================================
  @Post('ple/export')
  @HttpCode(HttpStatus.OK)
  async exportPle(
    @Body() dto: ExportPleDto,
    @CurrentCompany() currentCompanyId?: string,
  ): Promise<PleExportResult> {
    const companyId = currentCompanyId || dto.companyId || '5eaccb4e-a6ec-4f23-9909-85fe7fc9e879';

    // El periodo se toma del cuerpo de la petición (year/month). Antes se usaba
    // el valor por defecto del caso de uso, que está fijo en 2026-10: el libro
    // se generaba con los asientos de octubre aunque se pidiera otro mes, así
    // que las ventas del mes pedido no aparecían en la trama.
    const period = `${dto.year}-${String(dto.month).padStart(2, '0')}`;

    // 1. Obtener los asientos contables persistidos de la empresa y del periodo
    const entries = await this.getEntriesUseCase.execute(companyId, period);

    // 2. Generar la trama PLE con los datos reales
    return this.exportPleUseCase.execute({ ...dto, companyId }, entries);
  }
}