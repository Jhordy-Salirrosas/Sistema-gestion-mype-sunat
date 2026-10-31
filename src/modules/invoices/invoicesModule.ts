import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prismaModule';
import { AuthModule } from '../auth/authModule';
import { ResilienceModule } from '../resilience/resilienceModule';
import { SunatModule } from '../sunat/sunatModule';
import { InvoicesController } from './infrastructure/controllers/invoicesController';
import { InvoiceQueryController } from './infrastructure/controllers/invoiceQueryController';
import { InvoicesService } from './application/services/invoicesService';
import { InvoiceQueryService } from './application/services/invoiceQueryService';
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
  // TA-29: el controlador de consulta va aparte del de emisión; comparten
  // prefijo y guard, pero no responsabilidades.
  controllers: [InvoicesController, InvoiceQueryController],
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
  ],
  exports: [
    CreateInvoiceUseCase,
    InvoicesService,
    InvoiceQueryService,
    INVOICE_REPOSITORY_PORT,
    InvoiceWorkerService,
    UblGeneratorService,
    XsdValidatorService,
    SunatXslValidatorService,
  ],
})
export class InvoicesModule {}