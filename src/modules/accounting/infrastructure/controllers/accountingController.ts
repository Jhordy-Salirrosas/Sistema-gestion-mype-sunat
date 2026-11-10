import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { PrismaService } from '../../../../database/prismaService';
import { CreateAccountingEntryDto } from '../../application/dto/createAccountingEntryDto';
import { CreateAccountingAccountDto } from '../../application/dto/createAccountingAccountDto';
import { OpenAccountingPeriodDto } from '../../application/dto/openAccountingPeriodDto';
import { ExportPleDto } from '../../application/dto/exportPleDto';
import { GenerateAccountingEntryUseCase } from '../../application/use-cases/generateAccountingEntryUseCase';
import { GenerateClosingEntryUseCase } from '../../application/use-cases/generateClosingEntryUseCase';
import { ExportPleTxtUseCase, PleExportResult } from '../../application/use-cases/exportPleTxtUseCase';
import { ExportTaxPleUseCase } from '../../application/use-cases/exportTaxPleUseCase';
import { GetAccountingEntriesUseCase } from '../../application/use-cases/getAccountingEntriesUseCase';
import { ListAccountingAccountsUseCase } from '../../application/use-cases/listAccountingAccountsUseCase';
import { CreateAccountingAccountUseCase } from '../../application/use-cases/createAccountingAccountUseCase';
import { ListAccountingPeriodsUseCase } from '../../application/use-cases/listAccountingPeriodsUseCase';
import { OpenAccountingPeriodUseCase } from '../../application/use-cases/openAccountingPeriodUseCase';
import { OpenFiscalYearUseCase } from '../../application/use-cases/openFiscalYearUseCase';
import { CloseFiscalYearUseCase } from '../../application/use-cases/closeFiscalYearUseCase';
import { CloseAccountingPeriodUseCase } from '../../application/use-cases/closeAccountingPeriodUseCase';
import { GetLedgerUseCase } from '../../application/use-cases/getLedgerUseCase';
import { GetTrialBalanceUseCase } from '../../application/use-cases/getTrialBalanceUseCase';
import { GetIncomeStatementUseCase } from '../../application/use-cases/getIncomeStatementUseCase';
import { GetBalanceSheetUseCase } from '../../application/use-cases/getBalanceSheetUseCase';
import { AccountingEntryEntity } from '../../domain/entities/accountingEntryEntity';

@Controller('api/v1/accounting')
@UseGuards(AuthGuard)
export class AccountingController {
  constructor(
    private readonly generateEntryUseCase: GenerateAccountingEntryUseCase,
    private readonly generateClosingEntryUseCase: GenerateClosingEntryUseCase,
    private readonly exportPleUseCase: ExportPleTxtUseCase,
    private readonly exportTaxPleUseCase: ExportTaxPleUseCase,
    private readonly getEntriesUseCase: GetAccountingEntriesUseCase,
    private readonly listAccountsUseCase: ListAccountingAccountsUseCase,
    private readonly createAccountUseCase: CreateAccountingAccountUseCase,
    private readonly listPeriodsUseCase: ListAccountingPeriodsUseCase,
    private readonly openPeriodUseCase: OpenAccountingPeriodUseCase,
    private readonly openFiscalYearUseCase: OpenFiscalYearUseCase,
    private readonly closeFiscalYearUseCase: CloseFiscalYearUseCase,
    private readonly closePeriodUseCase: CloseAccountingPeriodUseCase,
    private readonly getLedgerUseCase: GetLedgerUseCase,
    private readonly getTrialBalanceUseCase: GetTrialBalanceUseCase,
    private readonly getIncomeStatementUseCase: GetIncomeStatementUseCase,
    private readonly getBalanceSheetUseCase: GetBalanceSheetUseCase,
    private readonly prisma: PrismaService,
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
  /**
   * @param period Periodo `YYYY-MM`. Si no llega se usa el mes en curso en Lima.
   *
   * Antes se llamaba al caso de uso SIN periodo, así que caía siempre en su
   * valor por defecto (`2026-10`) y el Libro Diario mostraba los asientos de
   * octubre aunque la empresa ya facturara en noviembre. El `AccountingEntry`
   * que genera el módulo de facturación se asienta en el mes del comprobante,
   * así que el filtro tiene que venir de la petición.
   */
  @Get('entries')
  async getEntries(
    @CurrentCompany() currentCompanyId?: string,
    @Query('period') period?: string,
  ): Promise<AccountingEntryEntity[]> {
    return this.getEntriesUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      // Si no llega, el caso de uso usa el mes en curso (`periodoActual()`).
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

  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  async createAccount(@Body() dto: CreateAccountingAccountDto) {
    return this.createAccountUseCase.execute(dto);
  }

  @Post('closing-entry/:year')
  @HttpCode(HttpStatus.CREATED)
  async generateClosingEntry(
    @Param('year') year: string,
    @CurrentCompany() currentCompanyId?: string,
  ) {
    return this.generateClosingEntryUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      Number(year),
    );
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

  @Post('periods/year/:year/open')
  @HttpCode(HttpStatus.CREATED)
  async openFiscalYear(
    @Param('year') year: string,
    @CurrentCompany() currentCompanyId?: string,
  ) {
    return this.openFiscalYearUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      Number(year),
    );
  }

  @Post('periods/year/:year/close')
  @HttpCode(HttpStatus.OK)
  async closeFiscalYear(
    @Param('year') year: string,
    @CurrentCompany() currentCompanyId?: string,
  ) {
    return this.closeFiscalYearUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      Number(year),
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
  // GET: Libro Mayor y Balance de Comprobación
  // ==========================================
  @Get('ledger')
  async getLedger(
    @CurrentCompany() currentCompanyId?: string,
    @Query('period') period?: string,
    @Query('accountCode') accountCode?: string,
  ) {
    return this.getLedgerUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      period ?? this.periodoActual(),
      accountCode ?? '',
    );
  }

  @Get('trial-balance')
  async getTrialBalance(
    @CurrentCompany() currentCompanyId?: string,
    @Query('period') period?: string,
  ) {
    return this.getTrialBalanceUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      period ?? this.periodoActual(),
    );
  }

  @Get('balance-sheet')
  async getBalanceSheet(
    @CurrentCompany() currentCompanyId?: string,
    @Query('period') period?: string,
  ) {
    return this.getBalanceSheetUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      period ?? this.periodoActual(),
    );
  }

  @Get('income-statement')
  async getIncomeStatement(
    @CurrentCompany() currentCompanyId?: string,
    @Query('period') period?: string,
  ) {
    return this.getIncomeStatementUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      period ?? this.periodoActual(),
    );
  }

  private periodoActual(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }).slice(0, 7);
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

  @Post('ple/tax-export')
  @HttpCode(HttpStatus.OK)
  async exportTaxPle(
    @Body() body: { year: number; month: number; bookCode: '080100' | '140100'; companyRuc: string },
    @CurrentCompany() currentCompanyId?: string,
  ) {
    return this.exportTaxPleUseCase.execute(
      this.empresaDelToken(currentCompanyId),
      body.companyRuc,
      Number(body.year),
      Number(body.month),
      body.bookCode,
    );
  }

  @Get('rules')
  async listRules(@CurrentCompany() currentCompanyId?: string) {
    return this.prisma.accountingRule.findMany({
      where: { company_id: this.empresaDelToken(currentCompanyId), is_active: true },
      orderBy: [{ process_code: 'asc' }, { document_type: 'asc' }, { line_order: 'asc' }],
    });
  }

  @Put('rules')
  async upsertRule(@Body() body: {
    processCode: string; documentType?: string; lineOrder: number;
    accountCode: string; side: 'DEBE' | 'HABER'; baseCalculation: string; description?: string;
  }, @CurrentCompany() currentCompanyId?: string) {
    const companyId = this.empresaDelToken(currentCompanyId);
    if (!body.processCode || !body.accountCode || !['DEBE', 'HABER'].includes(body.side)) {
      throw new BadRequestException('Regla inválida: proceso, cuenta y lado son obligatorios.');
    }
    const documentType = body.documentType ?? '*';
    return this.prisma.accountingRule.upsert({
      where: { company_id_process_code_document_type_line_order: { company_id: companyId, process_code: body.processCode, document_type: documentType, line_order: body.lineOrder } },
      update: { account_code: body.accountCode, side: body.side, base_calculation: body.baseCalculation, description: body.description, is_active: true },
      create: { company_id: companyId, process_code: body.processCode, document_type: documentType, line_order: body.lineOrder, account_code: body.accountCode, side: body.side, base_calculation: body.baseCalculation, description: body.description },
    });
  }

  // ==========================================
  // GET & PUT: Mapeador de Cuentas Contables PCGE (§ 9.3 del Plan Maestro)
  // ==========================================
  @Get('mappings')
  async getAccountingMappings(@CurrentCompany() currentCompanyId?: string) {
    const companyId = this.empresaDelToken(currentCompanyId);

    const defaultMappings = [
      { process_code: 'VENTA', role_code: 'CXC', account_code: '12121', description: 'Facturas por cobrar emitidas (Debe)' },
      { process_code: 'VENTA', role_code: 'IGV', account_code: '40111', description: 'IGV - Cuenta propia (Haber)' },
      { process_code: 'VENTA', role_code: 'INGRESO', account_code: '70121', description: 'Ventas de mercaderías (Haber)' },
      { process_code: 'VENTA', role_code: 'COSTO_VENTA', account_code: '69111', description: 'Costo de ventas mercaderías (Debe)' },
      { process_code: 'VENTA', role_code: 'INVENTARIO_SALIDA', account_code: '20111', description: 'Salida de mercaderías al costo (Haber)' },

      { process_code: 'COMPRA', role_code: 'GASTO_COMPRA', account_code: '60111', description: 'Mercaderías manufacturadas (Debe)' },
      { process_code: 'COMPRA', role_code: 'IGV_CREDITO', account_code: '40111', description: 'IGV - Crédito fiscal (Debe)' },
      { process_code: 'COMPRA', role_code: 'CXP', account_code: '42121', description: 'Facturas por pagar emitidas (Haber)' },
      { process_code: 'COMPRA', role_code: 'DESTINO_INVENTARIO', account_code: '20111', description: 'Mercaderías en almacén (Debe)' },
      { process_code: 'COMPRA', role_code: 'VARIACION_EXISTENCIA', account_code: '61111', description: 'Variación de mercaderías (Haber)' },

      { process_code: 'IMPORTACION', role_code: 'TRANSITO', account_code: '28111', description: 'Existencias por recibir (Tránsito) (Debe)' },
      { process_code: 'IMPORTACION', role_code: 'CXP_EXTERIOR', account_code: '42122', description: 'Proveedores del exterior (Haber)' },
      { process_code: 'IMPORTACION', role_code: 'AD_VALOREM', account_code: '40151', description: 'Derechos arancelarios Ad-Valorem (Debe)' },
      { process_code: 'IMPORTACION', role_code: 'IGV_IMPORTACION', account_code: '40115', description: 'IGV importación definitiva (Debe)' },
      { process_code: 'IMPORTACION', role_code: 'IPM', account_code: '40116', description: 'Impuesto de Promoción Municipal (Debe)' },
      { process_code: 'IMPORTACION', role_code: 'PERCEPCION_IGV', account_code: '40113', description: 'Percepción IGV aduanera (Debe)' },
      { process_code: 'IMPORTACION', role_code: 'INGRESO_ALMACEN', account_code: '20111', description: 'Mercaderías al costo Landed Cost (Debe/Haber)' },

      { process_code: 'TRANSFERENCIA', role_code: 'ALMACEN_DESTINO', account_code: '20111.02', description: 'Mercaderías Almacén 02 (Debe)' },
      { process_code: 'TRANSFERENCIA', role_code: 'ALMACEN_ORIGEN', account_code: '20111.01', description: 'Mercaderías Almacén 01 (Haber)' },

      { process_code: 'NOTA_CREDITO', role_code: 'REVERSO_VENTA', account_code: '70121', description: 'Reverso Venta de mercaderías (Debe)' },
      { process_code: 'NOTA_CREDITO', role_code: 'REVERSO_IGV', account_code: '40111', description: 'Reverso IGV - Cuenta propia (Debe)' },
      { process_code: 'NOTA_CREDITO', role_code: 'REVERSO_CXC', account_code: '12121', description: 'Reverso Facturas por cobrar (Haber)' },
      { process_code: 'NOTA_CREDITO', role_code: 'REINGRESO_STOCK', account_code: '20111', description: 'Reingreso físico al costo (Debe)' },
      { process_code: 'NOTA_CREDITO', role_code: 'REVERSO_COSTO_VENTA', account_code: '69111', description: 'Reverso Costo de ventas (Haber)' },
    ];

    const saved = await this.prisma.accountingMapping.findMany({
      where: { company_id: companyId },
    });

    const savedMap = new Map(saved.map((s) => [`${s.process_code}:${s.role_code}`, s.account_code]));

    return defaultMappings.map((m) => ({
      ...m,
      account_code: savedMap.get(`${m.process_code}:${m.role_code}`) ?? m.account_code,
      is_custom: savedMap.has(`${m.process_code}:${m.role_code}`),
    }));
  }

  @Put('mappings')
  @HttpCode(HttpStatus.OK)
  async updateAccountingMapping(
    @Body() body: { process_code: string; role_code: string; account_code: string },
    @CurrentCompany() currentCompanyId?: string,
  ) {
    const companyId = this.empresaDelToken(currentCompanyId);

    const result = await this.prisma.accountingMapping.upsert({
      where: {
        company_id_process_code_role_code: {
          company_id: companyId,
          process_code: body.process_code,
          role_code: body.role_code,
        },
      },
      update: {
        account_code: body.account_code,
      },
      create: {
        company_id: companyId,
        process_code: body.process_code,
        role_code: body.role_code,
        account_code: body.account_code,
      },
    });

    return result;
  }
}