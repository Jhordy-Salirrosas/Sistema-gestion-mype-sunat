import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prismaModule';
import { AuthModule } from '../auth/authModule';
import { ResilienceModule } from '../resilience/resilienceModule';
import { SunatModule } from '../sunat/sunatModule';
import { InvoicesController } from './infrastructure/controllers/invoicesController';
import { InvoiceQueryController } from './infrastructure/controllers/invoiceQueryController';
import { InvoiceConfigController } from './infrastructure/controllers/invoiceConfigController';
import { InvoiceDownloadController } from './infrastructure/controllers/invoiceDownloadController';
import { InvoicesService } from './application/services/invoicesService';
import { InvoiceQueryService } from './application/services/invoiceQueryService';
import { InvoiceSeriesService } from './application/services/invoiceSeriesService';
import { InvoiceConfigService } from './application/services/invoiceConfigService';
import { InvoiceDownloadService } from './application/services/invoiceDownloadService';
import { InvoicePdfService } from './application/services/invoicePdfService';
import { InvoiceQrService } from './application/services/invoiceQrService';
import { InvoiceMetricsService } from './application/services/invoiceMetricsService';
import { InvoiceAlertService } from './application/services/invoiceAlertService';
import { InvoiceCustomerService } from './application/services/invoiceCustomerService';
import { CreateInvoiceUseCase } from './application/use-cases/createInvoiceUseCase';
import { INVOICE_REPOSITORY_PORT } from './domain/ports/invoiceRepositoryPort';
import { PrismaInvoiceRepository } from './infrastructure/persistence/prismaInvoiceRepository';
import { InvoiceJobConsumer } from './invoiceJobConsumer';
import { InvoiceWorkerService } from './invoiceWorkerService';
import { UblGeneratorService } from './ublGeneratorService';
import { XsdValidatorService } from './xsdValidatorService';
import { SunatXslValidatorService } from './application/services/sunatXslValidatorService';
import { InvoiceNoteService } from './application/services/invoiceNoteService';
import { InvoiceAccountingBridgeService } from './application/services/invoiceAccountingBridgeService';
import { SummaryDispatchService } from './application/services/summaryDispatchService';
import { SummaryJobConsumer } from './summaryJobConsumer';
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
  // TA-29 / TA-60 / TA-65: un controlador por responsabilidad. El de consulta,
  // el de configuracion y el de emision devuelven JSON; el de descargas entrega
  // binarios con su Content-Disposition.
  controllers: [
    InvoicesController,
    InvoiceQueryController,
    InvoiceConfigController,
    InvoiceDownloadController,
  ],
  providers: [
    CreateInvoiceUseCase,
    InvoicesService,
    InvoiceQueryService,
    // TA-60: series con reserva atomica del correlativo + configuracion.
    InvoiceSeriesService,
    InvoiceConfigService,
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
    // que la capa de envio (worker de TA-28 y reintentos) lo consuma antes de
    // tocar la red.
    SunatXslValidatorService,
    // TA-65: descargas de XML, CDR y PDF con su QR.
    InvoiceDownloadService,
    InvoicePdfService,
    InvoiceQrService,
    // TA-66: notas de crédito y débito con control de saldo.
    InvoiceNoteService,
    // TA-69: métricas del periodo para la barra de KPIs del módulo.
    InvoiceMetricsService,
    // TA-69: alertas de vencimiento del certificado y de la cola de muertos.
    InvoiceAlertService,
    // TA-61: buscador de clientes sobre la cartera ya emitida.
    InvoiceCustomerService,
    // TA-68: puente facturación -> Kardex + Contabilidad.
    InvoiceAccountingBridgeService,
    // TA-67: encolado y sondeo del ticket de resumenes y bajas.
    SummaryDispatchService,
    SummaryJobConsumer,
  ],
  exports: [
    CreateInvoiceUseCase,
    InvoicesService,
    InvoiceQueryService,
    InvoiceSeriesService,
    InvoiceConfigService,
    InvoiceDownloadService,
    InvoiceMetricsService,
    INVOICE_REPOSITORY_PORT,
    InvoiceWorkerService,
    UblGeneratorService,
    XsdValidatorService,
    SunatXslValidatorService,
    InvoiceAccountingBridgeService,
  ],
})
export class InvoicesModule {}
