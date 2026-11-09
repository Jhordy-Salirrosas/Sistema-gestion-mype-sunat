import { detalleErrorConsulta } from '../../../sunat/statusConsultaError';
import { Controller, HttpCode, HttpException, Logger, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { PrismaService } from '../../../../database/prismaService';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { SunatStatusConsultaService } from '../../../sunat/statusConsultaService';

/** Solo getStatusCdr. No importa cola ni servicio de emisión. */
@Controller('api/v1/invoices')
@UseGuards(AuthGuard)
export class InvoiceSunatConsultController {
  private readonly logger = new Logger(InvoiceSunatConsultController.name);
  constructor(private readonly prisma: PrismaService, private readonly consulta: SunatStatusConsultaService) {}

  @Post(':id/consultar-sunat')
  @HttpCode(200)
  async consultar(@CurrentCompany() companyId: string, @Param('id') id: string) {
    try {
      const invoice = await this.prisma.invoice.findFirst({ where: { id, company_id: companyId },
        select: { id: true, ruc_emisor: true, tipo_comprobante: true, serie: true, correlativo: true } });
      if (!invoice) throw new NotFoundException('Comprobante no encontrado en la empresa');
      const result = await this.consulta.consultar({ companyId, invoiceId: id, rucEmisor: invoice.ruc_emisor,
        tipoComprobante: invoice.tipo_comprobante, serie: invoice.serie, correlativo: invoice.correlativo });
      if (result.tipo !== 'RECUPERADO') return result;
      return { tipo: result.tipo, estado: result.resultado.estado,
        codigo: result.resultado.responseCode, mensaje: result.resultado.cdr?.description ?? null, referencia: result.resultado.cdr?.referenceId ?? null };
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) throw error;
      const detalle = detalleErrorConsulta(error);
      this.logger.error(`[M1 consulta] ${id}: ${detalle.nombre}: ${detalle.mensaje}`);
      return { tipo: 'INCIERTO', motivo: 'No se pudo preparar la consulta SUNAT. Intente nuevamente o solicite revisar la configuración del emisor.' };
    }
  }
}
