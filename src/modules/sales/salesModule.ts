import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { SalesQuotesController } from './infrastructure/controllers/salesQuotesController';
import { SalesQuotesService } from './application/services/salesQuotesService';

@Module({ imports: [AuthModule], controllers: [SalesQuotesController], providers: [SalesQuotesService], exports: [SalesQuotesService] })
export class SalesModule {}
