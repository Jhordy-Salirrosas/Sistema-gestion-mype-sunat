import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CreateAccountingEntryDto } from '../../application/dto/createAccountingEntryDto';
import { OpenAccountingPeriodDto } from '../../application/dto/openAccountingPeriodDto';
import { ExportPleDto } from '../../application/dto/exportPleDto';
import { GenerateAccountingEntryUseCase } from '../../application/use-cases/generateAccountingEntryUseCase';
import { ExportPleTxtUseCase, PleExportResult } from '../../application/use-cases/exportPleTxtUseCase';
import { GetAccountingEntriesUseCase } from '../../application/use-cases/getAccountingEntriesUseCase';
import { ListAccountingAccountsUseCase } from '../../application/use-cases/listAccountingAccountsUseCase';
import { ListAccountingPeriodsUseCase } from '../../application/use-cases/listAccountingPeriodsUseCase';
import { OpenAccountingPeriodUseCase } from '../../application/use-cases/openAccountingPeriodUseCase';
import { CloseAccountingPeriodUseCase } from '../../application/use-cases/closeAccountingPeriodUseCase';
import { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';

@Controller('api/v1/accounting')
@UseGuards(AuthGuard)
export class AccountingController {
  constructor(
    private readonly generateEntryUseCase: GenerateAccountingEntryUseCase,
    private readonly exportPleUseCase: ExportPleTxtUseCase,
    private readonly getEntriesUseCase: GetAccountingEntriesUseCase,
    private readonly listAccountsUseCase: ListAccountingAccountsUseCase,
    private readonly listPeriodsUseCase: ListAccountingPeriodsUseCase,
    private readonly openPeriodUseCase: OpenAccountingPeriodUseCase,
    private readonly closePeriodUseCase: CloseAccountingPeriodUseCase,
  ) {}

  /**
   * La empresa sale SIEMPRE del token: aceptar un id del cuerpo o del query
   * permitiria leer o escribir asientos de otra empresa (IDOR).
   */
  private empresaDelToken(currentCompanyId?: string): string {
    if (!currentCompanyId) {
      throw new ForbiddenException(
        'La petición no tiene empresa asociada: falta companyId en el token',
      );
    }
    return currentCompanyId;
  }

  // ==========================================
  // GET: Obtener lista de asientos de la empresa
  // ==========================================
  @Get('entries')
  async getEntries(
    @CurrentCompany() currentCompanyId?: string,
    @Query('period') period?: string,
  ): Promise<AccountingEntryEntity[]> {
    return this.getEntriesUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      period,
    );
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
    return this.generateEntryUseCase.execute({
      ...dto,
      companyId: this.empresaDelToken(currentCompanyId),
    });
  }

  // ==========================================
  // GET: Catálogo PCGE y períodos de la empresa
  // ==========================================
  @Get('accounts')
  async getAccounts() {
    return this.listAccountsUseCase.execute();
  }

  @Get('periods')
  async getPeriods(@CurrentCompany() currentCompanyId?: string) {
    return this.listPeriodsUseCase.execute(this.empresaDelToken(currentCompanyId));
  }

  @Post('periods')
  @HttpCode(HttpStatus.CREATED)
  async openPeriod(
    @Body() dto: OpenAccountingPeriodDto,
    @CurrentCompany() currentCompanyId?: string,
  ) {
    return this.openPeriodUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      dto.year,
      dto.month,
    );
  }

  @Post('periods/:period/close')
  @HttpCode(HttpStatus.OK)
  async closePeriod(
    @Param('period') period: string,
    @CurrentCompany() currentCompanyId?: string,
  ) {
    return this.closePeriodUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      period,
    );
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
    const companyId = this.empresaDelToken(currentCompanyId);
    const period = `${dto.year}-${String(dto.month).padStart(2, '0')}`;

    // 1. Obtener los asientos contables persistidos del periodo solicitado
    const entries = await this.getEntriesUseCase.execute(companyId, period);

    // 2. Generar la trama PLE con los datos reales
    return this.exportPleUseCase.execute({ ...dto, companyId }, entries);
  }
}