import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';

export interface PleIssue {
  document: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface PleValidationResult {
  bookCode: '080100' | '140100';
  records: number;
  valid: boolean;
  errors: number;
  warnings: number;
  issues: PleIssue[];
}

const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

@Injectable()
export class ValidateTaxPleUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(companyId: string, companyRuc: string, year: number, month: number, bookCode: '080100' | '140100'): Promise<PleValidationResult> {
    const ruc = companyRuc?.replace(/[\r\n\t ]/g, '') ?? '';
    if (!/^\d{11}$/.test(ruc)) throw new BadRequestException('RUC inválido para PLE.');
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException('Año inválido.');
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new BadRequestException('Mes inválido.');
    const desde = new Date(Date.UTC(year, month - 1, 1));
    const hasta = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const issues: PleIssue[] = [];
    let records = 0;

    if (bookCode === '140100') {
      const ventas = await this.prisma.invoice.findMany({
        where: { company_id: companyId, fecha_emision: { gte: desde, lte: hasta }, estado: { not: 'ANULADO' } },
        orderBy: [{ fecha_emision: 'asc' }, { correlativo: 'asc' }],
      });
      records = ventas.length;
      for (const v of ventas) {
        const doc = `${v.serie}-${String(v.correlativo).padStart(8, '0')}`;
        this.validarDocumento(issues, doc, v.customer_identity_type, v.customer_identity_number, v.customer_legal_name);
        const total = redondear(Number(v.taxable_operations) + Number(v.total_igv) + Number(v.exempt_operations) + Number(v.unaffected_operations));
        if (Math.abs(total - Number(v.monto_total)) > 0.1) {
          issues.push({ document: doc, field: 'monto_total', message: `El total ${Number(v.monto_total).toFixed(2)} no coincide con la suma de bases e IGV (${total.toFixed(2)}).`, severity: 'error' });
        }
        if (Number(v.taxable_operations) > 0 && Math.abs(Number(v.total_igv) - Number(v.taxable_operations) * 0.18) > 0.5) {
          issues.push({ document: doc, field: 'igv', message: 'El IGV no corresponde al 18 % de la base gravada.', severity: 'warning' });
        }
        if (!v.serie?.trim() || !(Number(v.correlativo) > 0)) {
          issues.push({ document: doc, field: 'serie_correlativo', message: 'Serie o correlativo inválido.', severity: 'error' });
        }
      }
    } else {
      const compras = await this.prisma.nationalPurchase.findMany({
        where: { company_id: companyId, issue_date: { gte: desde, lte: hasta }, status: { not: 'ANULADA' } },
        orderBy: [{ issue_date: 'asc' }, { purchase_number: 'asc' }],
      });
      records = compras.length;
      for (const c of compras) {
        const doc = `${c.document_serial}-${c.document_number}`;
        this.validarDocumento(issues, doc, c.supplier_doc_type, c.supplier_doc_number, c.supplier_name);
        const total = redondear(Number(c.net_amount) + Number(c.igv_amount));
        if (Math.abs(total - Number(c.total_amount)) > 0.1) {
          issues.push({ document: doc, field: 'total_amount', message: `El total ${Number(c.total_amount).toFixed(2)} no coincide con neto + IGV (${total.toFixed(2)}).`, severity: 'error' });
        }
        if (Number(c.net_amount) > 0 && Math.abs(Number(c.igv_amount) - Number(c.net_amount) * 0.18) > 0.5) {
          issues.push({ document: doc, field: 'igv_amount', message: 'El IGV no corresponde al 18 % del neto.', severity: 'warning' });
        }
        if (!c.document_serial?.trim() || !c.document_number?.trim()) {
          issues.push({ document: doc, field: 'documento', message: 'Serie o número de documento vacío.', severity: 'error' });
        }
      }
    }

    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    return { bookCode, records, valid: errors === 0, errors, warnings, issues };
  }

  private validarDocumento(issues: PleIssue[], doc: string, tipo: string | null, numero: string | null, nombre: string | null) {
    if (!numero?.trim()) {
      issues.push({ document: doc, field: 'documento_identidad', message: 'Falta el documento del cliente/proveedor.', severity: 'error' });
    } else if (!/^\d{8,11}$/.test(numero.trim())) {
      issues.push({ document: doc, field: 'documento_identidad', message: 'El documento debe tener 8 u 11 dígitos.', severity: 'error' });
    } else if (tipo === '6' && numero.trim().length !== 11) {
      issues.push({ document: doc, field: 'documento_identidad', message: 'El RUC debe tener 11 dígitos.', severity: 'error' });
    } else if (tipo === '1' && numero.trim().length !== 8) {
      issues.push({ document: doc, field: 'documento_identidad', message: 'El DNI debe tener 8 dígitos.', severity: 'error' });
    }
    if (!nombre?.trim()) issues.push({ document: doc, field: 'razon_social', message: 'Falta la razón social.', severity: 'error' });
  }
}
