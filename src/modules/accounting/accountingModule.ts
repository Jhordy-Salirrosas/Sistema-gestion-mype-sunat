import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { AccountingController } from './infrastructure/controllers/accountingController';
import { GenerateAccountingEntryUseCase } from './application/use-cases/generateAccountingEntryUseCase';
import { ExportPleTxtUseCase } from './application/use-cases/exportPleTxtUseCase';

@Module({
  imports: [AuthModule],
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
