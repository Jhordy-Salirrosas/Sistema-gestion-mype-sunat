import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { PleFileNameRule } from '../../domain/rules/pleFileNameRule';

export interface TaxPleResult {
  fileName: string;
  recordsCount: number;
  content: string;
}

const fecha = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const periodo = (year: number, month: number) => `${year}${String(month).padStart(2, '0')}00`;

@Injectable()
export class ExportTaxPleUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(companyId: string, companyRuc: string, year: number, month: number, bookCode: '080100' | '140100'): Promise<TaxPleResult> {
    if (!/^\d{11}$/.test(companyRuc)) throw new BadRequestException('RUC inválido para PLE.');
    const desde = new Date(Date.UTC(year, month - 1, 1));
    const hasta = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const p = periodo(year, month);
    const rows: string[] = [];

    if (bookCode === '140100') {
      const ventas = await this.prisma.invoice.findMany({
        where: { company_id: companyId, fecha_emision: { gte: desde, lte: hasta }, estado: { not: 'ANULADO' } },
        orderBy: [{ fecha_emision: 'asc' }, { correlativo: 'asc' }],
      });
      ventas.forEach((v, i) => {
        rows.push([
          p, `001-${p.slice(0, 6)}-${String(i + 1).padStart(3, '0')}`, String(i + 1),
          fecha(v.fecha_emision), fecha(v.fecha_emision), v.tipo_comprobante, v.serie,
          String(v.correlativo), v.customer_identity_type, v.customer_identity_number,
          v.customer_legal_name, '0.00', Number(v.taxable_operations).toFixed(2), '0.00',
          Number(v.total_igv).toFixed(2), Number(v.exempt_operations).toFixed(2),
          Number(v.unaffected_operations).toFixed(2), '0.00', '0.00',
          Number(v.monto_total).toFixed(2), v.currency_code, '1.000', '', '1', '',
        ].join('|'));
      });
    } else {
      const compras = await this.prisma.nationalPurchase.findMany({
        where: { company_id: companyId, issue_date: { gte: desde, lte: hasta }, status: { not: 'ANULADA' } },
        orderBy: [{ issue_date: 'asc' }, { purchase_number: 'asc' }],
      });
      compras.forEach((c, i) => {
        const neto = Number(c.net_amount);
        const igv = Number(c.igv_amount);
        rows.push([
          p, `001-${p.slice(0, 6)}-${String(i + 1).padStart(3, '0')}`, String(i + 1),
          fecha(c.issue_date), c.document_type_code, c.document_serial, c.document_number,
          c.supplier_doc_type, c.supplier_doc_number, c.supplier_name,
          neto.toFixed(2), igv.toFixed(2), '0.00', '0.00',
          Number(c.total_amount).toFixed(2), c.currency_code, '1.000', '', '1', '',
        ].join('|'));
      });
    }

    return {
      fileName: PleFileNameRule.generate({ ruc: companyRuc, year, month, bookCode }),
      recordsCount: rows.length,
      content: rows.length ? rows.join('\r\n') + '\r\n' : '',
    };
  }
}
