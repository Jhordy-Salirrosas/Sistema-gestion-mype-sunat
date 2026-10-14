import { Module } from '@nestjs/common';
import { AccountingController } from './infrastructure/controllers/accountingController';
import { GenerateAccountingEntryUseCase } from './application/use-cases/generateAccountingEntryUseCase';
import { ExportPleTxtUseCase } from './application/use-cases/exportPleTxtUseCase';

@Module({
  controllers: [AccountingController],
  providers: [
    GenerateAccountingEntryUseCase,
    ExportPleTxtUseCase,
  ],
  exports: [
    GenerateAccountingEntryUseCase,
    ExportPleTxtUseCase,
  ],
})
export class AccountingModule {}
