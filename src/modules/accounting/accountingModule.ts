import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { AccountingController } from './infrastructure/controllers/accountingController';
import { AccountingPlanCuentasController } from './infrastructure/controllers/accountingPlanCuentasController';
import { GenerateAccountingEntryUseCase } from './application/use-cases/generateAccountingEntryUseCase';
import { GenerateClosingEntryUseCase } from './application/use-cases/generateClosingEntryUseCase';
import { ExportPleTxtUseCase } from './application/use-cases/exportPleTxtUseCase';
import { ExportTaxPleUseCase } from './application/use-cases/exportTaxPleUseCase';
import { ValidateTaxPleUseCase } from './application/use-cases/validateTaxPleUseCase';
import { GetIgvReconciliationUseCase } from './application/use-cases/getIgvReconciliationUseCase';
import { CloseAnnualUseCase } from './application/use-cases/closeAnnualUseCase';
import { GetClosingPreviewUseCase } from './application/use-cases/getClosingPreviewUseCase';
import { GetAccountingEntriesUseCase } from './application/use-cases/getAccountingEntriesUseCase';
import { RegisterInvoiceAccountingEntryUseCase } from './application/use-cases/registerInvoiceAccountingEntryUseCase';
import { ListAccountingAccountsUseCase } from './application/use-cases/listAccountingAccountsUseCase';
import { GetAccountsWithMovementsUseCase } from './application/use-cases/getAccountsWithMovementsUseCase';
import { CreateAccountingAccountUseCase } from './application/use-cases/createAccountingAccountUseCase';
import { UpdateAccountingAccountUseCase } from './application/use-cases/updateAccountingAccountUseCase';
import { ListAccountingPeriodsUseCase } from './application/use-cases/listAccountingPeriodsUseCase';
import { OpenAccountingPeriodUseCase } from './application/use-cases/openAccountingPeriodUseCase';
import { OpenFiscalYearUseCase } from './application/use-cases/openFiscalYearUseCase';
import { CloseFiscalYearUseCase } from './application/use-cases/closeFiscalYearUseCase';
import { CloseAccountingPeriodUseCase } from './application/use-cases/closeAccountingPeriodUseCase';
import { ReopenAccountingPeriodUseCase } from './application/use-cases/reopenAccountingPeriodUseCase';
import { DeleteAccountingPeriodUseCase } from './application/use-cases/deleteAccountingPeriodUseCase';
import { GetLedgerUseCase } from './application/use-cases/getLedgerUseCase';
import { GetTrialBalanceUseCase } from './application/use-cases/getTrialBalanceUseCase';
import { GetIncomeStatementUseCase } from './application/use-cases/getIncomeStatementUseCase';
import { GetBalanceSheetUseCase } from './application/use-cases/getBalanceSheetUseCase';
import { AuditAccountingUseCase } from './application/use-cases/auditAccountingUseCase';
import { TreasuryAccountsService } from './application/services/treasuryAccountsService';
import { AccountingCatalogService } from './application/services/accountingCatalogService';
import { AccountingMappingService } from './application/services/accountingMappingService';

// Importa el token del puerto y tu adaptador de base de datos de Prisma
import { ACCOUNTING_REPOSITORY_PORT } from './domain/ports/accountingRepositoryPort';
import { PrismaAccountingRepository } from './infrastructure/prismaAccountingRepository';

@Module({
  imports: [AuthModule],
  controllers: [AccountingController, AccountingPlanCuentasController],
  providers: [
    GenerateAccountingEntryUseCase,
    GenerateClosingEntryUseCase,
    ExportPleTxtUseCase,
    ExportTaxPleUseCase,
    ValidateTaxPleUseCase,
    GetIgvReconciliationUseCase,
    CloseAnnualUseCase,
    GetClosingPreviewUseCase,
    GetAccountingEntriesUseCase,
    RegisterInvoiceAccountingEntryUseCase,
    ListAccountingAccountsUseCase,
    GetAccountsWithMovementsUseCase,
    CreateAccountingAccountUseCase,
    UpdateAccountingAccountUseCase,
    ListAccountingPeriodsUseCase,
    OpenAccountingPeriodUseCase,
    OpenFiscalYearUseCase,
    CloseFiscalYearUseCase,
    CloseAccountingPeriodUseCase,
    ReopenAccountingPeriodUseCase,
    DeleteAccountingPeriodUseCase,
    GetLedgerUseCase,
    GetTrialBalanceUseCase,
    GetIncomeStatementUseCase,
    GetBalanceSheetUseCase,
    AuditAccountingUseCase,
    TreasuryAccountsService,
    AccountingCatalogService,
    AccountingMappingService,
    {
      provide: ACCOUNTING_REPOSITORY_PORT,
      useClass: PrismaAccountingRepository,
    },
  ],
  exports: [
    GenerateAccountingEntryUseCase,
    GenerateClosingEntryUseCase,
    ExportPleTxtUseCase,
    ExportTaxPleUseCase,
    ValidateTaxPleUseCase,
    GetIgvReconciliationUseCase,
    CloseAnnualUseCase,
    GetClosingPreviewUseCase,
    GetAccountingEntriesUseCase,
    RegisterInvoiceAccountingEntryUseCase,
    ListAccountingAccountsUseCase,
    GetAccountsWithMovementsUseCase,
    CreateAccountingAccountUseCase,
    UpdateAccountingAccountUseCase,
    ListAccountingPeriodsUseCase,
    OpenAccountingPeriodUseCase,
    OpenFiscalYearUseCase,
    CloseFiscalYearUseCase,
    CloseAccountingPeriodUseCase,
    ReopenAccountingPeriodUseCase,
    DeleteAccountingPeriodUseCase,
    GetLedgerUseCase,
    GetTrialBalanceUseCase,
    GetIncomeStatementUseCase,
    GetBalanceSheetUseCase,
    AuditAccountingUseCase,
    TreasuryAccountsService,
    AccountingCatalogService,
    AccountingMappingService,
  ],
})
export class AccountingModule {}