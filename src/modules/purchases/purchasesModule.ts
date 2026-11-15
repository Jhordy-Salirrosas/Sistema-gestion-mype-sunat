import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { AccountingModule } from '../accounting/accountingModule';
import { PurchasesController } from './infrastructure/controllers/purchasesController';
import { PurchasesService } from './application/services/purchasesService';
import { PurchaseOrdersService } from './application/services/purchaseOrdersService';
import { PurchaseOrdersController } from './infrastructure/controllers/purchaseOrdersController';

@Module({
  imports: [AuthModule, AccountingModule],
  controllers: [PurchasesController, PurchaseOrdersController],
  providers: [PurchasesService, PurchaseOrdersService],
  exports: [PurchasesService],
})
export class PurchasesModule {}

