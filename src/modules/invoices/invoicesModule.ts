import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prismaModule';
import { AuthModule } from '../auth/authModule';
import { QueueModule } from '../resilience/infrastructure/queue/queueModule';
import { SunatModule } from '../sunat/sunatModule';
import { InvoicesController } from './infrastructure/controllers/invoicesController';
import { InvoicesService } from './application/services/invoicesService';
import { CreateInvoiceUseCase } from './application/use-cases/createInvoiceUseCase';
import { INVOICE_REPOSITORY_PORT } from './domain/ports/invoiceRepositoryPort';
import { PrismaInvoiceRepository } from './infrastructure/persistence/prismaInvoiceRepository';
import { InvoiceWorkerService } from './invoice-worker.service';
import { UblGeneratorService } from './ubl-generator.service';
import { XsdValidatorService } from './xsd-validator.service';

@Module({
  imports: [PrismaModule, AuthModule, QueueModule, SunatModule],
  controllers: [InvoicesController],
  providers: [
    CreateInvoiceUseCase,
    InvoicesService,
    {
      provide: INVOICE_REPOSITORY_PORT,
      useClass: PrismaInvoiceRepository,
    },
    PrismaInvoiceRepository,
    InvoiceWorkerService,
    UblGeneratorService,
    XsdValidatorService,
  ],
  exports: [
    CreateInvoiceUseCase,
    InvoicesService,
    INVOICE_REPOSITORY_PORT,
    InvoiceWorkerService,
    UblGeneratorService,
    XsdValidatorService,
  ],
})
export class InvoicesModule {}
