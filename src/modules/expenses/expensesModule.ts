import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accountingModule';
import { ExpensesController } from './infrastructure/controllers/expensesController';
import { ExpensesService } from './application/services/expensesService';

@Module({ imports: [AccountingModule], controllers: [ExpensesController], providers: [ExpensesService] })
export class ExpensesModule {}
