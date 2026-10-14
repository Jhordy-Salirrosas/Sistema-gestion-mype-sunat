import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prismaModule';
import { QueueModule } from '../resilience/infrastructure/queue/queueModule';
import { InvoicesController } from './infrastructure/controllers/invoicesController';
import { InvoicesService } from './application/services/invoicesService';
import { CreateInvoiceUseCase } from './application/use-cases/createInvoiceUseCase';
import { INVOICE_REPOSITORY_PORT } from './domain/ports/invoiceRepositoryPort';
import { PrismaInvoiceRepository } from './infrastructure/persistence/prismaInvoiceRepository';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [InvoicesController],
  providers: [
    CreateInvoiceUseCase,
    InvoicesService,
    {
      provide: INVOICE_REPOSITORY_PORT,
      useClass: PrismaInvoiceRepository,
    },
    PrismaInvoiceRepository,
  ],
  exports: [
    CreateInvoiceUseCase,
    InvoicesService,
    INVOICE_REPOSITORY_PORT,
  ],
})
export class InvoicesModule {}

