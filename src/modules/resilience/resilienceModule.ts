import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/authModule';
import { PrismaModule } from '../../database/prismaModule';
import { SunatModule } from '../sunat/sunatModule';
import { ResilienceStateModule } from './application/resilienceStateModule';
import { ResilienceController } from './infrastructure/controllers/resilienceController';
import { QueueModule } from './infrastructure/queue/queueModule';
import {
  dormir,
  InvoiceRetryService,
  RETRY_SLEEP,
} from './infrastructure/queue/invoiceRetryService';
import { InvoiceDlqService } from './infrastructure/queue/invoiceDlqService';
import { SunatMockModule } from './infrastructure/mock/sunatMockModule';

@Module({
  // AuthModule es necesario porque ResilienceController usa AuthGuard, que
  // inyecta TOKEN_SERVICE_PORT. Igual que lo hace InvoicesModule.
  //
  // SunatModule aporta `SunatBillService`, que InvoiceRetryService envuelve
  // para aplicar el backoff de HU-04 y el Circuit Breaker de TA-33. No hay
  // ciclo: SunatModule no importa ResilienceModule.
  imports: [
    QueueModule,
    PrismaModule,
    SunatMockModule,
    ResilienceStateModule,
    AuthModule,
    SunatModule,
  ],
  controllers: [ResilienceController],
  providers: [
    InvoiceRetryService,
    InvoiceDlqService,
    { provide: RETRY_SLEEP, useValue: dormir },
  ],
  exports: [QueueModule, SunatMockModule, InvoiceRetryService],
})
export class ResilienceModule {}
