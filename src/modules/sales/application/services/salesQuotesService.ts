import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const map = (q: any) => ({
  id: q.id,
  quoteNumber: q.quote_number,
  customerDocType: q.customer_doc_type,
  customerDocNumber: q.customer_doc_number,
  customerName: q.customer_name,
  issueDate: q.issue_date,
  validUntil: q.valid_until,
  currencyCode: q.currency_code,
  subtotal: Number(q.subtotal),
  igvAmount: Number(q.igv_amount),
  totalAmount: Number(q.total_amount),
  status: q.status,
  notes: q.notes,
  items: (q.items ?? []).map((i: any) => ({
    id: i.id, sku: i.sku, description: i.description, unitCode: i.unit_code,
    quantity: Number(i.quantity), unitPrice: Number(i.unit_price),
    subtotal: Number(i.subtotal), igvAmount: Number(i.igv_amount), totalAmount: Number(i.total_amount),
  })),
});

@Injectable()
export class SalesQuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, kind: 'COTIZACION' | 'PEDIDO' = 'COTIZACION') {
    const rows = await this.prisma.salesQuote.findMany({
      where: { company_id: companyId, kind },
      include: { items: { orderBy: { item_order: 'asc' } } },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    return rows.map(map);
  }

  async get(companyId: string, id: string) {
    const row = await this.prisma.salesQuote.findFirst({ where: { id, company_id: companyId }, include: { items: { orderBy: { item_order: 'asc' } } } });
    if (!row) throw new NotFoundException('Cotización no encontrada.');
    return map(row);
  }

  async create(companyId: string, dto: { kind?: 'COTIZACION' | 'PEDIDO'; customerDocType?: string; customerDocNumber?: string; customerName: string; validUntil?: string; notes?: string; items: Array<{ sku?: string; description: string; unitCode?: string; quantity: number; unitPrice: number }> }) {
    if (!dto.customerName?.trim()) throw new BadRequestException('El cliente es obligatorio.');
    if (!dto.items?.length) throw new BadRequestException('La cotización necesita al menos un ítem.');
    const items = dto.items.map((item, index) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      if (!(quantity > 0) || !(unitPrice >= 0)) throw new BadRequestException(`Ítem ${index + 1} inválido.`);
      const total = r2(quantity * unitPrice);
      const subtotal = r2(total / 1.18);
      return {
        item_order: index + 1, sku: item.sku?.trim().toUpperCase() || null,
        description: item.description.trim(), unit_code: item.unitCode?.trim().toUpperCase() || 'NIU',
        quantity, unit_price: unitPrice, subtotal, igv_amount: r2(total - subtotal), total_amount: total,
      };
    });
    const subtotal = r2(items.reduce((sum, item) => sum + item.subtotal, 0));
    const igv = r2(items.reduce((sum, item) => sum + item.igv_amount, 0));
    const total = r2(items.reduce((sum, item) => sum + item.total_amount, 0));
    const kind = dto.kind ?? 'COTIZACION';
    const row = await this.prisma.salesQuote.create({
      data: {
        company_id: companyId, kind, quote_number: `${kind === 'PEDIDO' ? 'PED' : 'COT'}-${Date.now().toString().slice(-9)}`,
        customer_doc_type: dto.customerDocType?.trim() || '6', customer_doc_number: dto.customerDocNumber?.trim() || null,
        customer_name: dto.customerName.trim(), valid_until: dto.validUntil ? new Date(dto.validUntil) : null,
        notes: dto.notes?.trim() || null, subtotal, igv_amount: igv, total_amount: total,
        items: { create: items },
      },
      include: { items: { orderBy: { item_order: 'asc' } } },
    });
    return map(row);
  }

  async updateStatus(companyId: string, id: string, status: string) {
    const actual = await this.prisma.salesQuote.findFirst({ where: { id, company_id: companyId } });
    if (!actual) throw new NotFoundException('Cotización no encontrada.');
    const row = await this.prisma.salesQuote.update({ where: { id }, data: { status: status as never }, include: { items: { orderBy: { item_order: 'asc' } } } });
    return map(row);
  }
}
