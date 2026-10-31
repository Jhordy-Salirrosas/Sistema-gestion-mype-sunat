/**
 * Descargas de XML, CDR y PDF (TA-65).
 *
 * Controlador aparte del de emisión y del de consulta: entrega BINARIOS con su
 * `Content-Type` y su `Content-Disposition`, mientras los otros devuelven JSON.
 * Mezclarlos obligaría a ramificar el tipo de retorno en cada método.
 *
 * `companyId` viene del token por `@CurrentCompany()`; ninguna ruta acepta la
 * empresa por query, así que no hay forma de pedir el comprobante de otro.
 */
import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentCompany } from '../../../../common/decorators';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { InvoiceDownloadService } from '../../application/services/invoiceDownloadService';

@Controller('api/v1/invoices')
@UseGuards(AuthGuard)
export class InvoiceDownloadController {
  constructor(private readonly descargas: InvoiceDownloadService) {}

  /**
   * GET /api/v1/invoices/:id/xml
   *
   * Devuelve el XML UBL 2.1 del comprobante. Si el worker ya guardó el XML
   * firmado se entrega ese; si no, se regenera desde el payload.
   */
  @Get(':id/xml')
  async xml(
    @CurrentCompany() companyId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const archivo = await this.descargas.descargar(companyId, id, 'xml');
    this.entregar(res, archivo);
  }

  /**
   * GET /api/v1/invoices/:id/cdr
   *
   * Devuelve el CDR que respondió SUNAT, tal cual llegó. Si el comprobante
   * todavía no tiene CDR responde 404 con el motivo.
   */
  @Get(':id/cdr')
  async cdr(
    @CurrentCompany() companyId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const archivo = await this.descargas.descargar(companyId, id, 'cdr');
    this.entregar(res, archivo);
  }

  /**
   * GET /api/v1/invoices/:id/pdf
   *
   * Representación impresa con el QR de la trama oficial de SUNAT.
   */
  @Get(':id/pdf')
  async pdf(
    @CurrentCompany() companyId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const archivo = await this.descargas.descargar(companyId, id, 'pdf');
    this.entregar(res, archivo);
  }

  /**
   * Envía el archivo al cliente con las cabeceras de descarga.
   *
   * Se fija `Content-Length` explícitamente: sin él, Express responde con
   * transferencia chunked y algunos navegadores no muestran la barra de
   * progreso ni proponen el nombre de archivo.
   */
  private entregar(
    res: Response,
    archivo: { nombre: string; contentType: string; contenido: Buffer },
  ): void {
    res.setHeader('Content-Type', archivo.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${archivo.nombre}"`,
    );
    res.setHeader('Content-Length', String(archivo.contenido.length));
    res.end(archivo.contenido);
  }
}
