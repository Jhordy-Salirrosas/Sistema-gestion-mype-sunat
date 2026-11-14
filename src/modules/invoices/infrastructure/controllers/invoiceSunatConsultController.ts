import { resumirTransporte } from '../../application/services/invoiceTransportEvidence';
import { RolesGuard } from '../../../auth/infrastructure/guards/rolesGuard';
import { Roles } from '../../../../common/decorators';
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

  @Roles('ADMIN', 'OPERADOR_FACTURACION')
  @UseGuards(RolesGuard)
  @Post(':id/consultar-sunat')
  @HttpCode(200)
  async consultar(@CurrentCompany() companyId: string, @Param('id') id: string) {
    try {
      const invoice = await this.prisma.invoice.findFirst({ where: { id, company_id: companyId },
        select: { id: true, ruc_emisor: true, tipo_comprobante: true, serie: true, correlativo: true, transport_uncertain: true, cdr_sunat: true,
          history: { select: { created_at: true, codigo_error: true, mensaje_error: true, estado_nuevo: true, tiempo_respuesta_ms: true, http_status_code: true } } } });
      if (!invoice) throw new NotFoundException('Comprobante no encontrado en la empresa');
      const evidencia = resumirTransporte(invoice.history ?? []);
      if (!invoice.cdr_sunat && !evidencia.envioAcreditado &&
          (invoice.transport_uncertain === false || evidencia.bloqueoPrevioProbado)) {
        return { tipo: 'SIN_TRANSMISION', motivo: 'El comprobante no tiene transmisión acreditada. Revise la preparación local antes de enviarlo.' };
      }
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
