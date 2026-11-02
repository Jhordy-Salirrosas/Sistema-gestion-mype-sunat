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

@Controller('api/v1/invoices')
@UseGuards(AuthGuard)
export class InvoiceQueryController {
  constructor(private readonly consultas: InvoiceQueryService) {}

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
}
