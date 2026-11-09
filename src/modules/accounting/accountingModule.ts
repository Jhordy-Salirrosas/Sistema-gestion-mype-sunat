import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { AccountingController } from './infrastructure/controllers/accountingController';
import { GenerateAccountingEntryUseCase } from './application/use-cases/generateAccountingEntryUseCase';
import { GenerateClosingEntryUseCase } from './application/use-cases/generateClosingEntryUseCase';
import { ExportPleTxtUseCase } from './application/use-cases/exportPleTxtUseCase';
import { GetAccountingEntriesUseCase } from './application/use-cases/getAccountingEntriesUseCase';
import { RegisterInvoiceAccountingEntryUseCase } from './application/use-cases/registerInvoiceAccountingEntryUseCase';
import { ListAccountingAccountsUseCase } from './application/use-cases/listAccountingAccountsUseCase';
import { ListAccountingPeriodsUseCase } from './application/use-cases/listAccountingPeriodsUseCase';
import { OpenAccountingPeriodUseCase } from './application/use-cases/openAccountingPeriodUseCase';
import { OpenFiscalYearUseCase } from './application/use-cases/openFiscalYearUseCase';
import { CloseFiscalYearUseCase } from './application/use-cases/closeFiscalYearUseCase';
import { CloseAccountingPeriodUseCase } from './application/use-cases/closeAccountingPeriodUseCase';
import { GetLedgerUseCase } from './application/use-cases/getLedgerUseCase';
import { GetTrialBalanceUseCase } from './application/use-cases/getTrialBalanceUseCase';
import { GetIncomeStatementUseCase } from './application/use-cases/getIncomeStatementUseCase';
import { GetBalanceSheetUseCase } from './application/use-cases/getBalanceSheetUseCase';

// Importa el token del puerto y tu adaptador de base de datos de Prisma
import { ACCOUNTING_REPOSITORY_PORT } from './domain/ports/accountingRepositoryPort';
import { PrismaAccountingRepository } from './infrastructure/prismaAccountingRepository';

@Module({
  imports: [AuthModule],
  controllers: [AccountingController],
  providers: [
    GenerateAccountingEntryUseCase,
    GenerateClosingEntryUseCase,
    ExportPleTxtUseCase,
    GetAccountingEntriesUseCase,
    RegisterInvoiceAccountingEntryUseCase,
    ListAccountingAccountsUseCase,
    ListAccountingPeriodsUseCase,
    OpenAccountingPeriodUseCase,
    OpenFiscalYearUseCase,
    CloseFiscalYearUseCase,
    CloseAccountingPeriodUseCase,
    GetLedgerUseCase,
    GetTrialBalanceUseCase,
    GetIncomeStatementUseCase,
    GetBalanceSheetUseCase,
    {
      provide: ACCOUNTING_REPOSITORY_PORT,
      useClass: PrismaAccountingRepository,
    },
  ],
  exports: [
    GenerateAccountingEntryUseCase,
    GenerateClosingEntryUseCase,
    ExportPleTxtUseCase,
    GetAccountingEntriesUseCase,
    RegisterInvoiceAccountingEntryUseCase,
    ListAccountingAccountsUseCase,
    ListAccountingPeriodsUseCase,
    OpenAccountingPeriodUseCase,
    OpenFiscalYearUseCase,
    CloseFiscalYearUseCase,
    CloseAccountingPeriodUseCase,
    GetLedgerUseCase,
    GetTrialBalanceUseCase,
    GetIncomeStatementUseCase,
    GetBalanceSheetUseCase,
  ],
})
export class AccountingModule {}