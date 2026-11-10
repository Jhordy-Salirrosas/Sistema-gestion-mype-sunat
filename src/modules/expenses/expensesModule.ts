import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accountingModule';
import { AuthModule } from '../auth/authModule';
import { ExpensesController } from './infrastructure/controllers/expensesController';
import { ExpensesService } from './application/services/expensesService';

@Module({ imports: [AuthModule, AccountingModule], controllers: [ExpensesController], providers: [ExpensesService] })
export class ExpensesModule {}
