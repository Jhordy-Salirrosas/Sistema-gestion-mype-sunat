import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accountingModule';
import { AuthModule } from '../auth/authModule';
import { CollectionsController } from './infrastructure/controllers/collectionsController';
import { CollectionsService } from './application/services/collectionsService';

@Module({ imports: [AuthModule, AccountingModule], controllers: [CollectionsController], providers: [CollectionsService] })
export class CollectionsModule {}
