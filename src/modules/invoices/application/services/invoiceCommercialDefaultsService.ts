import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { MEDIOS_PAGO_VENTA } from '../dto/emitirComprobanteDto';

export interface CommercialDefaults { forma_pago: 'Contado' | 'Credito'; medio_pago: string }
/** Configuración empresarial aditiva; no altera el maestro de clientes. */
@Injectable()
export class InvoiceCommercialDefaultsService {
  constructor(private readonly prisma: PrismaService) {}
  async get(companyId: string): Promise<CommercialDefaults> {
    const rows = await this.prisma.$queryRaw<CommercialDefaults[]>`
      SELECT forma_pago, medio_pago FROM invoice_commercial_defaults WHERE company_id = ${companyId}`;
    return rows[0] ?? { forma_pago: 'Contado', medio_pago: 'EFECTIVO' };
  }
  async save(companyId: string, body: unknown) {
    const d = body as CommercialDefaults;
    if (!d || Object.keys(d).some(k => !['forma_pago', 'medio_pago'].includes(k)) ||
      !['Contado', 'Credito'].includes(d.forma_pago) || !(MEDIOS_PAGO_VENTA as readonly string[]).includes(d.medio_pago)) {
      throw new BadRequestException('Indique una forma y un medio de pago válidos.');
    }
    await this.prisma.$executeRaw`INSERT INTO invoice_commercial_defaults(company_id, forma_pago, medio_pago)
      VALUES (${companyId}, ${d.forma_pago}, ${d.medio_pago})
      ON CONFLICT (company_id) DO UPDATE SET forma_pago = EXCLUDED.forma_pago, medio_pago = EXCLUDED.medio_pago`;
    return this.get(companyId);
  }
}
