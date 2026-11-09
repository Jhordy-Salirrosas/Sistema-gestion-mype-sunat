import { Controller, HttpCode, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentCompany } from '../../../../common/decorators';
import { PrismaService } from '../../../../database/prismaService';
import { AuthGuard } from '../../../auth/infrastructure/guards/authGuard';
import { SunatStatusConsultaService } from '../../../sunat/statusConsultaService';

/** Solo getStatusCdr. No importa cola ni servicio de emisión. */
@Controller('api/v1/invoices')
@UseGuards(AuthGuard)
export class InvoiceSunatConsultController {
  constructor(private readonly prisma: PrismaService, private readonly consulta: SunatStatusConsultaService) {}

  @Post(':id/consultar-sunat')
  @HttpCode(200)
  async consultar(@CurrentCompany() companyId: string, @Param('id') id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, company_id: companyId },
      select: { id: true, ruc_emisor: true, tipo_comprobante: true, serie: true, correlativo: true } });
    if (!invoice) throw new NotFoundException('Comprobante no encontrado en la empresa');
    const result = await this.consulta.consultar({ companyId, invoiceId: id, rucEmisor: invoice.ruc_emisor,
      tipoComprobante: invoice.tipo_comprobante, serie: invoice.serie, correlativo: invoice.correlativo });
    if (result.tipo !== 'RECUPERADO') return result;
    return { tipo: result.tipo, estado: result.resultado.estado,
      codigo: result.resultado.responseCode, referencia: result.resultado.cdr?.referenceId ?? null };
  }
}
