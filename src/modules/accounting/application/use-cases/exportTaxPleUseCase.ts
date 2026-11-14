import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { PleFileNameRule } from '../../domain/rules/pleFileNameRule';
import {
  clavesDuplicadas,
  construirLinea,
  r2,
  validarEstructura,
  validarRucEmisor,
} from '../../domain/rules/pleStructureRule';

export interface TaxPleResult {
  fileName: string;
  recordsCount: number;
  content: string;
  /** Totales del libro: sirven para contrastar contra el registro contable. */
  totales: { baseGravada: number; igv: number; total: number };
}

const fecha = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const periodo = (year: number, month: number) => `${year}${String(month).padStart(2, '0')}00`;

@Injectable()
export class ExportTaxPleUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    companyId: string,
    companyRuc: string,
    year: number,
    month: number,
    bookCode: '080100' | '140100',
  ): Promise<TaxPleResult> {
    const ruc = (companyRuc ?? '').replace(/\s/g, '');
    const problemaRuc = validarRucEmisor(ruc);
    if (problemaRuc) throw new BadRequestException(problemaRuc);

    const desde = new Date(Date.UTC(year, month - 1, 1));
    const hasta = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const p = periodo(year, month);
    const rows: string[] = [];
    const claves: string[] = [];
    let baseGravada = 0;
    let igv = 0;
    let total = 0;

    if (bookCode === '140100') {
      const ventas = await this.prisma.invoice.findMany({
        where: { company_id: companyId, fecha_emision: { gte: desde, lte: hasta }, estado: { not: 'ANULADO' } },
        orderBy: [{ fecha_emision: 'asc' }, { correlativo: 'asc' }],
      });
      ventas.forEach((v, i) => {
        claves.push(`${v.tipo_comprobante}-${v.serie}-${v.correlativo}`);
        const base = Number(v.taxable_operations);
        const impuesto = Number(v.total_igv);
        baseGravada += base;
        igv += impuesto;
        total += Number(v.monto_total);
        rows.push(
          construirLinea([
            p,
            `001-${p.slice(0, 6)}-${String(i + 1).padStart(3, '0')}`,
            String(i + 1),
            fecha(v.fecha_emision),
            fecha(v.fecha_emision),
            v.tipo_comprobante,
            v.serie,
            String(v.correlativo),
            v.customer_identity_type,
            v.customer_identity_number,
            v.customer_legal_name,
            '0.00',
            base.toFixed(2),
            '0.00',
            impuesto.toFixed(2),
            Number(v.exempt_operations).toFixed(2),
            Number(v.unaffected_operations).toFixed(2),
            '0.00',
            '0.00',
            Number(v.monto_total).toFixed(2),
            v.currency_code,
            '1.000',
            '',
            '1',
          ]),
        );
      });
    } else {
      const compras = await this.prisma.nationalPurchase.findMany({
        where: { company_id: companyId, issue_date: { gte: desde, lte: hasta }, status: { not: 'ANULADA' } },
        orderBy: [{ issue_date: 'asc' }, { purchase_number: 'asc' }],
      });
      compras.forEach((c, i) => {
        claves.push(`${c.document_type_code}-${c.document_serial}-${c.document_number}`);
        const neto = Number(c.net_amount);
        const impuesto = Number(c.igv_amount);
        baseGravada += neto;
        igv += impuesto;
        total += Number(c.total_amount);
        rows.push(
          construirLinea([
            p,
            `001-${p.slice(0, 6)}-${String(i + 1).padStart(3, '0')}`,
            String(i + 1),
            fecha(c.issue_date),
            c.document_type_code,
            c.document_serial,
            c.document_number,
            c.supplier_doc_type,
            c.supplier_doc_number,
            c.supplier_name,
            neto.toFixed(2),
            impuesto.toFixed(2),
            '0.00',
            '0.00',
            Number(c.total_amount).toFixed(2),
            c.currency_code,
            '1.000',
            '',
            '1',
          ]),
        );
      });
    }

    // Un comprobante repetido entra dos veces al crédito fiscal o al débito
    // fiscal del período: es el error más caro del libro y el más difícil de
    // ver a ojo.
    const repetidas = clavesDuplicadas(claves);
    if (repetidas.length > 0) {
      throw new BadRequestException(
        `Hay comprobantes repetidos en el libro ${bookCode}: ${repetidas.slice(0, 5).join(', ')}`,
      );
    }

    const issues = validarEstructura(rows);
    if (issues.length > 0) {
      throw new BadRequestException(
        `El libro ${bookCode} tiene una fila con formato inconsistente: ${issues[0].message}`,
      );
    }

    return {
      fileName: PleFileNameRule.generate({ ruc, year, month, bookCode }),
      recordsCount: rows.length,
      content: rows.length ? rows.join('\r\n') + '\r\n' : '',
      totales: { baseGravada: r2(baseGravada), igv: r2(igv), total: r2(total) },
    };
  }
}
