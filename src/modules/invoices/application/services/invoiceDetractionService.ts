import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { importesPersistidos } from './invoiceQueryMapper';

@Injectable()
export class InvoiceDetractionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, period: string) {
    if (!/^\d{4}-\d{2}$/.test(period)) throw new BadRequestException('Período inválido.');
    const desde = new Date(`${period}-01T00:00:00Z`);
    const hasta = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0, 23, 59, 59));
    const facturas = await this.prisma.invoice.findMany({
      where: { company_id: companyId, fecha_emision: { gte: desde, lte: hasta }, estado: { not: 'ANULADO' } },
      orderBy: [{ fecha_emision: 'asc' }, { correlativo: 'asc' }],
    });
    return facturas.map((f) => {
      const { monto_detraccion } = importesPersistidos(f.payload_ubl);
      return {
        id: f.id, numero: `${f.serie}-${String(f.correlativo).padStart(8, '0')}`, date: f.fecha_emision,
        customer: f.customer_legal_name ?? '', total: Number(f.monto_total),
        detraction: monto_detraccion ?? 0,
        depositedAt: f.detraccion_deposited_at, depositedAmount: f.detraccion_deposited_amount ? Number(f.detraccion_deposited_amount) : null,
        constancia: f.detraccion_constancia,
      };
    }).filter((f) => f.detraction > 0);
  }

  async registerDeposit(companyId: string, id: string, dto: { amount?: number; date?: string; constancia?: string }) {
    const factura = await this.prisma.invoice.findFirst({ where: { id, company_id: companyId } });
    if (!factura) throw new NotFoundException('Comprobante no encontrado.');
    if (factura.estado === 'ANULADO') throw new BadRequestException('El comprobante está anulado.');
    const { monto_detraccion } = importesPersistidos(factura.payload_ubl);
    if (!monto_detraccion || monto_detraccion <= 0) throw new BadRequestException('El comprobante no tiene detracción.');
    const monto = Math.round(Number(dto.amount ?? monto_detraccion) * 100) / 100;
    if (!(monto > 0) || monto > monto_detraccion + 0.005) throw new BadRequestException(`El depósito debe estar entre 0.01 y ${monto_detraccion.toFixed(2)}.`);
    const fecha = dto.date ? new Date(`${dto.date}T00:00:00Z`) : new Date();
    if (Number.isNaN(fecha.getTime())) throw new BadRequestException('Fecha de depósito inválida.');
    return this.prisma.invoice.update({
      where: { id }, data: { detraccion_deposited_at: fecha, detraccion_deposited_amount: monto, detraccion_constancia: dto.constancia?.trim() || null },
    });
  }
}
