import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { AccountingController } from './infrastructure/controllers/accountingController';
import { GenerateAccountingEntryUseCase } from './application/use-cases/generateAccountingEntryUseCase';
import { ExportPleTxtUseCase } from './application/use-cases/exportPleTxtUseCase';
import { GetAccountingEntriesUseCase } from './application/use-cases/getAccountingEntriesUseCase';

// Importa el token del puerto y tu adaptador de base de datos de Prisma
import { ACCOUNTING_REPOSITORY_PORT } from './domain/ports/accountingRepositoryPort';
import { PrismaAccountingRepository } from './infrastructure/prismaAccountingRepository';

@Module({
  imports: [AuthModule],
  controllers: [AccountingController],
  providers: [
    GenerateAccountingEntryUseCase,
    ExportPleTxtUseCase,
    GetAccountingEntriesUseCase,
    {
      provide: ACCOUNTING_REPOSITORY_PORT,
      useClass: PrismaAccountingRepository,
    },
  ],
  exports: [
    GenerateAccountingEntryUseCase,
    ExportPleTxtUseCase,
    GetAccountingEntriesUseCase,
  ],
})
export class AccountingModule {}