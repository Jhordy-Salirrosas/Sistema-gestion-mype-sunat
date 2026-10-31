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
import { InvoiceAccountingBridgeService } from './application/services/invoiceAccountingBridgeService';
import { InventoryModule } from '../inventory/inventoryModule';
import { AccountingModule } from '../accounting/accountingModule';

@Module({
  // ResilienceModule reexporta QueueModule (aportando QueueService) y ademas
  // provee InvoiceRetryService, que el InvoiceJobConsumer de TA-28 necesita.
  //
  // TA-68: InventoryModule y AccountingModule aportan los casos de uso que el
  // puente contable reutiliza. Se importan los modulos enteros en lugar de
  // duplicar sus proveedores, para que el promedio ponderado del Kardex y la
  // partida doble sigan existiendo en un solo sitio.
  imports: [
    PrismaModule,
    AuthModule,
    ResilienceModule,
    SunatModule,
    InventoryModule,
    AccountingModule,
  ],
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
    // TA-68: puente facturación -> Kardex + Contabilidad.
    InvoiceAccountingBridgeService,
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
    InvoiceAccountingBridgeService,
  ],
})
export class InvoicesModule {}