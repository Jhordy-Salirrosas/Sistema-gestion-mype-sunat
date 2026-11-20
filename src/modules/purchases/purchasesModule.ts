import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { AccountingModule } from '../accounting/accountingModule';
import { PurchasesController } from './infrastructure/controllers/purchasesController';
import { PurchasesService } from './application/services/purchasesService';
import { PurchaseOrdersService } from './application/services/purchaseOrdersService';
import { PurchaseOrdersController } from './infrastructure/controllers/purchaseOrdersController';
import { PaymentSchedulesController, PurchaseDueDateController } from './infrastructure/controllers/paymentSchedulesController';
import { PaymentSchedulesService } from './application/services/paymentSchedulesService';

@Module({
  imports: [AuthModule, AccountingModule],
  controllers: [PurchasesController, PurchaseOrdersController, PaymentSchedulesController, PurchaseDueDateController],
  providers: [PurchasesService, PurchaseOrdersService, PaymentSchedulesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}

