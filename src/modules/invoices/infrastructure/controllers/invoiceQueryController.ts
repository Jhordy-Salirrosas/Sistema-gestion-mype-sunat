import { fechaFiscalLima } from '../../fiscalDate';
import { SummaryAggregateStore } from '../../application/services/summaryAggregateStore';
import { SummaryDispatchService } from '../../application/services/summaryDispatchService';
import { seleccionBaja } from '../../application/services/summaryEnvioService';
import { BadRequestException } from '@nestjs/common';
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
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import { CurrentCompany, Roles } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/currentUserDecorator';
import type { TokenPayload } from '../../../auth/domain/ports/tokenServicePort';
import { WarehouseAccessService } from '../../../auth/application/services/warehouseAccessService';
import { InvoiceQueryService } from '../../application/services/invoiceQueryService';
import {
  InvoiceNoteService,
  type SolicitudNota,
} from '../../application/services/invoiceNoteService';
import { InvoiceMetricsService } from '../../application/services/invoiceMetricsService';
import { InvoiceAlertService } from '../../application/services/invoiceAlertService';
import { InvoiceCustomerService } from '../../application/services/invoiceCustomerService';
import { InvoiceSummaryService } from '../../application/services/invoiceSummaryService';
import { SummaryEnvioService } from '../../application/services/summaryEnvioService';

@Controller('api/v1/invoices')
@UseGuards(AuthGuard)
export class InvoiceQueryController {
  constructor(
    private readonly consultas: InvoiceQueryService,
    private readonly notas: InvoiceNoteService,
    private readonly metricas: InvoiceMetricsService,
    private readonly alertasOperativas: InvoiceAlertService,
    private readonly clientes: InvoiceCustomerService,
    private readonly resumenes: InvoiceSummaryService,
    private readonly envioResumenes: SummaryEnvioService,
    private readonly aggregates: SummaryAggregateStore,
    private readonly aggregateDispatch: SummaryDispatchService,
    private readonly warehouseAccess: WarehouseAccessService,
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
   * GET /api/v1/invoices/products
   *
   * Catálogo de productos con su unidad, stock por almacén, precio final y afectación
   * tributaria (Catálogo 07) configurada en el producto.
   */
  @Get('warehouses')
  async almacenes(@CurrentCompany() companyId: string, @CurrentUser() user: TokenPayload) {
    return this.consultas.almacenes(companyId, await this.warehouseAccess.allowedCodes(user));
  }

  @Get('products')
  catalogoProductos(@CurrentCompany() companyId: string, @Query('almacen') almacen?: string, @Query('historicos') historicos?: string) {
    return this.consultas.catalogoProductos(companyId, almacen?.trim().toUpperCase() || 'ALM-01', historicos === 'true');
  }

  /**
   * GET /api/v1/invoices/resumenes/diario?fecha=YYYY-MM-DD
   *
   * Vista previa del resumen diario de boletas (RC): qué entra, qué queda
   * fuera y por qué, y el XML que se enviaría. Va antes de `/:id` por el mismo
   * motivo que `metrics`, `alertas` y `customers/lookup`.
   */
  @Get('resumenes/diario')
  vistaResumen(
    @CurrentCompany() companyId: string,
    @Query('fecha') fecha?: string,
    @Query('correlativo') correlativo?: string,
  ) {
    return this.resumenes.vistaResumenDiario(
      companyId,
      this.fechaDe(fecha),
      Number(correlativo ?? 1) || 1,
    );
  }

  /**
   * GET /api/v1/invoices/resumenes/baja?fecha=YYYY-MM-DD
   *
   * Vista previa de la comunicación de baja (RA): los comprobantes anulables de
   * la fecha y el XML que se enviaría.
   */
  @Get('resumenes/baja')
  vistaBaja(
    @CurrentCompany() companyId: string,
    @Query('fecha') fecha?: string,
    @Query('correlativo') correlativo?: string,
  ) {
    return this.resumenes.vistaComunicacionBaja(
      companyId,
      this.fechaDe(fecha),
      Number(correlativo ?? 1) || 1,
    );
  }

  /**
   * POST /api/v1/invoices/resumenes/diario/enviar?fecha=YYYY-MM-DD
   *
   * ENVÍA de verdad el resumen diario a SUNAT: firma el XML, lo comprime y lo
   * encola para que el worker lo envíe y sondee el ticket.
   *
   * Antes este envío no tenía disparador: `SummaryDispatchService.encolar()`
   * no lo llamaba nadie, así que un resumen diario nunca llegaba a SUNAT.
   *
   * Responde `enviado: false` con su motivo —y no un error— cuando la vista
   * previa trae reglas incumplidas o no hay nada que informar.
   */
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OPERADOR_FACTURACION')
  @Post('resumenes/diario/enviar')
  @HttpCode(HttpStatus.OK)
  enviarResumen(
    @CurrentCompany() companyId: string,
    @Query('fecha') fecha?: string,
  ) {
    return this.envioResumenes.enviarResumenDiario(
      companyId,
      this.fechaDe(fecha),
    );
  }

  /**
   * POST /api/v1/invoices/resumenes/baja/enviar?fecha=YYYY-MM-DD
   *
   * ENVÍA la comunicación de baja (RA): anula ante SUNAT las facturas ya
   * aceptadas de la fecha.
   */
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OPERADOR_FACTURACION')
  @Post('resumenes/baja/enviar')
  @HttpCode(HttpStatus.OK)
  enviarBaja(
    @CurrentCompany() companyId: string,
    @Query('fecha') fecha?: string,
    @Body() body?: { lineas?: unknown },
  ) {
    return this.envioResumenes.enviarComunicacionBaja(
      companyId,
      this.fechaDe(fecha),
      body?.lineas,
    );
  }

  @Post('resumenes/baja/vista')
  vistaSeleccionBaja(@CurrentCompany() companyId: string, @Query('fecha') fecha?: string, @Body() body?: { lineas?: unknown }) {
    return this.resumenes.vistaComunicacionBaja(companyId, this.fechaDe(fecha), 1, seleccionBaja(body?.lineas));
  }

  @Get('resumenes/envios')
  listarAgregados(@CurrentCompany() companyId: string) { return this.aggregates.listar(companyId); }

  @Roles('ADMIN', 'OPERADOR_FACTURACION')
  @UseGuards(RolesGuard)
  @Post('resumenes/envios/:id/consultar')
  async consultarAgregado(@CurrentCompany() companyId: string, @Param('id') identifier: string) {
    const row = await this.aggregates.cargar(companyId, identifier);
    if (!row.ticket) throw new BadRequestException('No hay ticket para consultar; no se reenvía un intento incierto');
    const result = await this.aggregateDispatch.procesar({ companyId, identificador: identifier, tipo: row.kind === 'RA' ? 'COMUNICACION_BAJA' : 'RESUMEN_DIARIO', fileName: '', zipBase64: '' }, { maxConsultas: 0 });
    return { identificador: identifier, ticket: result.ticket, status: result.status, motivo: result.error, obtenido: result.enviado };
  }

  /** Fecha del día de hoy en hora de Perú si no se indica otra. */
  private fechaDe(fecha?: string): string {
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
      return fecha.trim();
    }
    return fechaFiscalLima();
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
    @Query('puente_pendiente') puentePendiente?: string,
    @Query('en_dlq') enDlq?: string,
  ) {
    return this.consultas.listar(
      companyId,
      { estado, tipo, serie, desde, hasta, ...(enDlq !== undefined ? { en_dlq: enDlq } : {}), ...(puentePendiente !== undefined ? { puente_pendiente: puentePendiente } : {}) },
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

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'OPERADOR_FACTURACION')
  @Post(':id/resolver-dlq')
  resolverDlq(@CurrentCompany() companyId: string, @Param('id') id: string) {
    return this.consultas.resolverDlqAceptado(companyId, id);
  }

  /**
   * POST /api/v1/invoices/:id/retry-cdr
   *
   * Reencola un comprobante en error para volver a consultar su CDR y
   * registra la acción en la auditoría (criterio 3).
   */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
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
  @Roles('ADMIN', 'OPERADOR_FACTURACION')
  @UseGuards(RolesGuard)
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
  @Roles('ADMIN', 'OPERADOR_FACTURACION')
  @UseGuards(RolesGuard)
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
