/**
 * Endpoints de consulta de comprobantes (TA-29).
 *
 * Vive en un controlador aparte del de emisión (`invoicesController`) para no
 * mezclar dos responsabilidades y mantener ambos archivos dentro del límite de
 * líneas del proyecto. Comparte el prefijo `api/v1/invoices` y el mismo
 * `AuthGuard`.
 *
 * `companyId` llega por `@CurrentCompany()`, que lo lee del token ya validado:
 * ninguna ruta acepta la empresa por query o body (criterio 4).
 */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { InvoiceQueryService } from '../../application/services/invoiceQueryService';
import {
  InvoiceNoteService,
  type SolicitudNota,
} from '../../application/services/invoiceNoteService';
import { InvoiceMetricsService } from '../../application/services/invoiceMetricsService';
import { InvoiceAlertService } from '../../application/services/invoiceAlertService';
import { InvoiceCustomerService } from '../../application/services/invoiceCustomerService';

@Controller('api/v1/invoices')
@UseGuards(AuthGuard)
export class InvoiceQueryController {
  constructor(
    private readonly consultas: InvoiceQueryService,
    private readonly notas: InvoiceNoteService,
    private readonly metricas: InvoiceMetricsService,
    private readonly alertasOperativas: InvoiceAlertService,
    private readonly clientes: InvoiceCustomerService,
  ) {}

  /**
   * GET /api/v1/invoices/metrics
   *
   * Resumen del periodo para la barra de KPIs (TA-69): emitidos, aceptados,
   * rechazados, pendientes, importe facturado (con las notas de crédito ya
   * restadas) y tasa de aceptación.
   *
   * Va declarado ANTES de `GET /:id`, porque Nest resuelve las rutas en orden
   * de declaración y `metrics` encajaría como un id.
   */
  @Get('metrics')
  resumen(
    @CurrentCompany() companyId: string,
    @Query('periodo') periodo?: string,
  ) {
    return this.metricas.metricas(companyId, periodo);
  }

  /**
   * GET /api/v1/invoices/alertas
   *
   * Riesgos operativos que la barra de KPIs no cubre (TA-69): cuántos días le
   * quedan al certificado de firma y cuántos comprobantes están trabados en la
   * cola de muertos.
   *
   * Va en su propia ruta y no dentro de `metrics` porque tiene otro costo: la
   * DLQ abre pg-boss, mientras que las métricas son un `groupBy`. Así la
   * barra puede pintar las cifras del periodo sin esperar a la cola.
   */
  @Get('alertas')
  alertas(@CurrentCompany() companyId: string) {
    return this.alertasOperativas.estado(companyId);
  }

  /**
   * GET /api/v1/invoices/customers/lookup?q=...
   *
   * Buscador de clientes de TA-61. La ruta va ANTES de `GET /:id` por el mismo
   * motivo que `metrics` y `alertas`: si se declarara después, `customers`
   * encajaría como un id y el buscador respondería 404.
   *
   * Sin `q` devuelve la cartera completa, que es lo que necesita el
   * desplegable al abrirse.
   */
  @Get('customers/lookup')
  buscarClientes(
    @CurrentCompany() companyId: string,
    @Query('q') consulta?: string,
  ) {
    return this.clientes.buscar(companyId, consulta ?? '');
  }

  /**
   * GET /api/v1/invoices
   *
   * Paginado con filtros por estado, tipo, serie y rango de fechas. El
   * contrato de respuesta (`{ data, total, page, ... }`) es el que ya espera
   * `invoicesApi.getInvoices(page)` del frontend.
   */
  @Get()
  listar(
    @CurrentCompany() companyId: string,
    @Query('estado') estado?: string,
    @Query('tipo') tipo?: string,
    @Query('serie') serie?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.consultas.listar(
      companyId,
      { estado, tipo, serie, desde, hasta },
      page,
      pageSize,
    );
  }

  /**
   * GET /api/v1/invoices/:id
   *
   * Devuelve el comprobante, su CDR y su historial de estados. Un comprobante
   * de otra empresa responde 404, no 403 (criterio 4).
   */
  @Get(':id')
  detalle(@CurrentCompany() companyId: string, @Param('id') id: string) {
    return this.consultas.detalle(companyId, id);
  }

  /**
   * POST /api/v1/invoices/:id/retry-cdr
   *
   * Reencola un comprobante en error para volver a consultar su CDR y
   * registra la acción en la auditoría (criterio 3).
   */
  @Post(':id/retry-cdr')
  reintentarCdr(
    @CurrentCompany() companyId: string,
    @Param('id') id: string,
  ) {
    return this.consultas.reintentarCdr(companyId, id);
  }

  /**
   * GET /api/v1/invoices/:id/saldo
   *
   * Saldo del comprobante que todavía se puede acreditar con notas (TA-66).
   * Responde 409 si el comprobante no está en un estado que admita notas.
   */
  @Get(':id/saldo')
  saldo(@CurrentCompany() companyId: string, @Param('id') id: string) {
    return this.notas.saldo(companyId, id);
  }

  /**
   * POST /api/v1/invoices/:id/notas-credito
   *
   * Valida el motivo del Catálogo 09 y que el importe quepa en el saldo antes
   * de emitir. Un importe que supera el saldo responde 409 y no 400: es un
   * conflicto con el estado del comprobante, no un error de formato.
   */
  @Post(':id/notas-credito')
  notaCredito(
    @CurrentCompany() companyId: string,
    @Param('id') id: string,
    @Body() cuerpo: Omit<SolicitudNota, 'comprobanteOrigenId'>,
  ) {
    return this.notas.autorizarCredito(companyId, {
      ...cuerpo,
      comprobanteOrigenId: id,
    });
  }

  /**
   * POST /api/v1/invoices/:id/notas-debito
   *
   * Valida el motivo del Catálogo 10 y el importe. Una nota de débito aumenta
   * el importe de la operación, así que no consume el saldo del comprobante.
   */
  @Post(':id/notas-debito')
  notaDebito(
    @CurrentCompany() companyId: string,
    @Param('id') id: string,
    @Body() cuerpo: Omit<SolicitudNota, 'comprobanteOrigenId'>,
  ) {
    return this.notas.autorizarDebito(companyId, {
      ...cuerpo,
      comprobanteOrigenId: id,
    });
  }
}
