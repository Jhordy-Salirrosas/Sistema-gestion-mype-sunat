import { IssuerConfigWriter } from './application/services/issuerConfigWriter';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prismaModule';
import { AuthModule } from '../auth/authModule';
import { AccountingModule } from '../accounting/accountingModule';
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
import { InvoiceSummaryService } from './application/services/invoiceSummaryService';
import { CreateInvoiceUseCase } from './application/use-cases/createInvoiceUseCase';
import { INVOICE_REPOSITORY_PORT } from './domain/ports/invoiceRepositoryPort';
import { PrismaInvoiceRepository } from './infrastructure/persistence/prismaInvoiceRepository';
import { InvoiceJobConsumer } from './invoiceJobConsumer';
import { InvoiceWorkerService } from './invoiceWorkerService';
import { UblGeneratorService } from './ublGeneratorService';
import { XsdValidatorService } from './xsdValidatorService';
import { SunatXslValidatorService } from './application/services/sunatXslValidatorService';
import { InvoiceNoteService } from './application/services/invoiceNoteService';
// Corrección del docente (31-10): la emisión desde la pantalla necesitaba su
// propio camino. `StockValidationService` ya existía y estaba probado, pero solo
// lo invocaba su test: ninguna emisión validaba la cantidad contra el almacén.
import { StockValidationService } from './application/services/stockValidationService';
import { EmitirComprobanteService } from './application/services/emitirComprobanteService';
import { SignedXmlStorageService } from './application/services/signedXmlStorageService';
import { InvoiceAccountingBridgeService } from './application/services/invoiceAccountingBridgeService';
import { SummaryDispatchService } from './application/services/summaryDispatchService';
import { SummaryEnvioService } from './application/services/summaryEnvioService';
import { SummaryJobConsumer } from './summaryJobConsumer';
import { InventoryModule } from '../inventory/inventoryModule';

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
    // ORDEN IMPORTANTE. `InvoiceQueryController` declara `GET :id`, que actúa
    // como comodín y se traga cualquier segmento. Nest registra las rutas en el
    // orden en que aparecen los controladores, así que si este va antes,
    // `GET /invoices/series` entra al detalle del comprobante "series" y
    // responde 404 "El comprobante no existe". Comprobado contra el servidor
    // real el 31-10: pasaba exactamente eso, y en consecuencia la pantalla de
    // configuración no podía listar las series.
    //
    // Los controladores con rutas literales (`config`, `series`) van primero.
    InvoiceConfigController,
    InvoiceQueryController,
    InvoiceDownloadController,
  ],
  providers: [
    IssuerConfigWriter,
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
    // TA-67: vista previa de resumenes diarios y comunicaciones de baja.
    InvoiceSummaryService,
    // TA-68: puente facturación -> Kardex + Contabilidad.
    InvoiceAccountingBridgeService,
    // TA-67: encolado y sondeo del ticket de resumenes y bajas.
    SummaryDispatchService,
    // M1: el envío REAL de resumenes diarios (RC) y comunicaciones de baja (RA).
    // Antes `SummaryDispatchService.encolar()` no tenia ningun llamador, asi que
    // RC/RA nunca llegaban a SUNAT.
    SummaryEnvioService,
    SummaryJobConsumer,
    // Docente 31-10: validación de cantidad contra el stock disponible.
    StockValidationService,
    // Docente 31-10: emisión desde la pantalla (traduce, valida y reserva).
    EmitirComprobanteService,
    // Guarda el XML firmado que se envía, para que la descarga entregue el
    // documento real y no una reconstrucción sin firma.
    SignedXmlStorageService,
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
