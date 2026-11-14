import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { SalesQuotesController } from './infrastructure/controllers/salesQuotesController';
import { SalesQuotesService } from './application/services/salesQuotesService';
import { CashClosuresService } from './application/services/cashClosuresService';
import { CashClosuresController } from './infrastructure/controllers/cashClosuresController';

@Module({ imports: [AuthModule], controllers: [SalesQuotesController, CashClosuresController], providers: [SalesQuotesService, CashClosuresService], exports: [SalesQuotesService, CashClosuresService] })
export class SalesModule {}
