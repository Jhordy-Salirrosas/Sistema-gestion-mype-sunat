import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prismaModule';
import { AuthModule } from '../auth/authModule';
import { ResilienceModule } from '../resilience/resilienceModule';
import { SunatModule } from '../sunat/sunatModule';
import { InvoicesController } from './infrastructure/controllers/invoicesController';
import { InvoiceQueryController } from './infrastructure/controllers/invoiceQueryController';
import { InvoiceDownloadController } from './infrastructure/controllers/invoiceDownloadController';
import { InvoicesService } from './application/services/invoicesService';
import { InvoiceQueryService } from './application/services/invoiceQueryService';
import { InvoiceDownloadService } from './application/services/invoiceDownloadService';
import { InvoicePdfService } from './application/services/invoicePdfService';
import { InvoiceQrService } from './application/services/invoiceQrService';
import { CreateInvoiceUseCase } from './application/use-cases/createInvoiceUseCase';
import { INVOICE_REPOSITORY_PORT } from './domain/ports/invoiceRepositoryPort';
import { PrismaInvoiceRepository } from './infrastructure/persistence/prismaInvoiceRepository';
import { InvoiceJobConsumer } from './invoiceJobConsumer';
import { InvoiceWorkerService } from './invoiceWorkerService';
import { UblGeneratorService } from './ublGeneratorService';
import { XsdValidatorService } from './xsdValidatorService';
import { SunatXslValidatorService } from './application/services/sunatXslValidatorService';

@Module({
  // ResilienceModule reexporta QueueModule (aportando QueueService) y ademas
  // provee InvoiceRetryService, que el InvoiceJobConsumer de TA-28 necesita.
  imports: [PrismaModule, AuthModule, ResilienceModule, SunatModule],
  // TA-29 / TA-65: un controlador por responsabilidad. El de consulta y el de
  // emisión devuelven JSON; el de descargas entrega binarios con su
  // Content-Disposition.
  controllers: [
    InvoicesController,
    InvoiceQueryController,
    InvoiceDownloadController,
  ],
  providers: [
    CreateInvoiceUseCase,
    InvoicesService,
    InvoiceQueryService,
    {
      provide: INVOICE_REPOSITORY_PORT,
      useClass: PrismaInvoiceRepository,
    },
    PrismaInvoiceRepository,
    InvoiceWorkerService,
    InvoiceJobConsumer,
    UblGeneratorService,
    XsdValidatorService,
    // TA-31: validador local con las XSL oficiales de SUNAT. Se exporta para
    // que la capa de envío (worker de TA-28 y reintentos) lo consuma antes de
    // tocar la red.
    SunatXslValidatorService,
    // TA-65: descargas de XML, CDR y PDF con su QR.
    InvoiceDownloadService,
    InvoicePdfService,
    InvoiceQrService,
  ],
  exports: [
    CreateInvoiceUseCase,
    InvoicesService,
    InvoiceQueryService,
    InvoiceDownloadService,
    INVOICE_REPOSITORY_PORT,
    InvoiceWorkerService,
    UblGeneratorService,
    XsdValidatorService,
    SunatXslValidatorService,
    InvoiceDownloadService,
  ],
})
export class InvoicesModule {}
