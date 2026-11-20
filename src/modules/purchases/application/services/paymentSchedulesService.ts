import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const map = (s: any) => ({
  id: s.id, purchaseId: s.purchase_id, scheduledDate: s.scheduled_date, amount: Number(s.amount),
  status: s.status, notes: s.notes, paidAt: s.paid_at, createdAt: s.created_at,
});

@Injectable()
export class PaymentSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    const compras = await this.prisma.nationalPurchase.findMany({
      where: { company_id: companyId, status: { not: 'ANULADA' } },
      include: { payment_schedules: { where: { status: 'PROGRAMADO' }, orderBy: { scheduled_date: 'asc' } } },
      orderBy: { issue_date: 'desc' },
      take: 200,
    });
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const purchases = compras.map((c) => {
      const total = Number(c.total_amount);
      const paid = Number(c.paid_amount ?? 0);
      const credited = Number(c.credit_amount ?? 0);
      const balance = r2(total - paid - credited);
      const scheduled = c.payment_schedules.reduce((s, x) => s + Number(x.amount), 0);
      return {
        id: c.id, purchaseNumber: c.purchase_number, supplierName: c.supplier_name, supplierDocNumber: c.supplier_doc_number,
        document: `${c.document_serial}-${c.document_number}`, issueDate: c.issue_date, dueDate: c.due_date,
        total, paid, credited, balance, scheduledAmount: r2(scheduled), availableToSchedule: r2(Math.max(0, balance - scheduled)),
        overdue: balance > 0 && Boolean(c.due_date && c.due_date < hoy), schedules: c.payment_schedules.map(map),
      };
    }).filter((c) => c.balance > 0.005 || c.schedules.length > 0);
    return {
      purchases,
      summary: {
        totalBalance: r2(purchases.reduce((s, c) => s + c.balance, 0)),
        scheduled: r2(purchases.reduce((s, c) => s + c.scheduledAmount, 0)),
        overdue: r2(purchases.filter((c) => c.overdue).reduce((s, c) => s + c.balance, 0)),
      },
    };
  }

  async create(companyId: string, dto: { purchaseId: string; scheduledDate: string; amount: number; notes?: string }, createdBy?: string) {
    const purchase = await this.prisma.nationalPurchase.findFirst({ where: { id: dto.purchaseId, company_id: companyId } });
    if (!purchase) throw new NotFoundException('Compra no encontrada.');
    if (purchase.status === 'ANULADA') throw new BadRequestException('La compra está anulada.');
    const balance = r2(Number(purchase.total_amount) - Number(purchase.paid_amount ?? 0) - Number(purchase.credit_amount ?? 0));
    if (!(balance > 0)) throw new BadRequestException('La compra no tiene saldo pendiente.');
    const programado = await this.prisma.purchasePaymentSchedule.aggregate({ where: { company_id: companyId, purchase_id: dto.purchaseId, status: 'PROGRAMADO' }, _sum: { amount: true } });
    const disponible = r2(balance - Number(programado._sum.amount ?? 0));
    const monto = r2(Number(dto.amount));
    if (!(monto > 0) || monto > disponible + 0.005) throw new BadRequestException(`El importe debe estar entre 0.01 y ${disponible.toFixed(2)}.`);
    const fecha = new Date(dto.scheduledDate);
    if (Number.isNaN(fecha.getTime())) throw new BadRequestException('La fecha programada es inválida.');
    const row = await this.prisma.purchasePaymentSchedule.create({ data: { company_id: companyId, purchase_id: dto.purchaseId, scheduled_date: fecha, amount: monto, notes: dto.notes?.trim() || null, created_by: createdBy || null } });
    return map(row);
  }

  async cancel(companyId: string, id: string) {
    const row = await this.prisma.purchasePaymentSchedule.findFirst({ where: { id, company_id: companyId } });
    if (!row) throw new NotFoundException('Programación no encontrada.');
    if (row.status !== 'PROGRAMADO') throw new BadRequestException('Solo se puede anular una programación pendiente.');
    const actualizado = await this.prisma.purchasePaymentSchedule.update({ where: { id }, data: { status: 'ANULADO' } });
    return map(actualizado);
  }

  async updateDueDate(companyId: string, purchaseId: string, dueDate?: string | null) {
    const purchase = await this.prisma.nationalPurchase.findFirst({ where: { id: purchaseId, company_id: companyId } });
    if (!purchase) throw new NotFoundException('Compra no encontrada.');
    const fecha = dueDate ? new Date(dueDate) : null;
    if (fecha && Number.isNaN(fecha.getTime())) throw new BadRequestException('La fecha de vencimiento es inválida.');
    await this.prisma.nationalPurchase.update({ where: { id: purchaseId }, data: { due_date: fecha } });
    return { purchaseId, dueDate: fecha };
  }
}
