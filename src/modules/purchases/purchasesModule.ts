import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { AccountingModule } from '../accounting/accountingModule';
import { PurchasesController } from './infrastructure/controllers/purchasesController';
import { PurchasesService } from './application/services/purchasesService';

@Module({
  imports: [AuthModule, AccountingModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}

