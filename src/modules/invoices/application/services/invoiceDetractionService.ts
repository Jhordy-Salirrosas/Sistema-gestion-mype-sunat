import { Prisma } from '../../../../generated/client/client';
import { fechaIso } from './paymentTermsAndSpotValidator';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { importesPersistidos } from './invoiceQueryMapper';

type DepositInput = { amount?: number; date?: string; constancia?: string };
const snapshot = (d: { date: Date; amount: Prisma.Decimal | number; constancia: string | null }) => ({ fecha: d.date.toISOString(), monto: Number(d.amount), constancia: d.constancia });

@Injectable()
export class InvoiceDetractionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('Período inválido.');
    const desde = new Date(`${period}-01T00:00:00Z`);
    const hasta = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0, 23, 59, 59, 999));
    const facturas = await this.prisma.invoice.findMany({
      where: { company_id: companyId, fecha_emision: { gte: desde, lte: hasta }, estado: { in: ['ACEPTADO', 'OBSERVADO'] } },
      include: { detraction_deposits: { orderBy: [{ date: 'asc' }, { created_at: 'asc' }, { id: 'asc' }] } },
      orderBy: [{ fecha_emision: 'asc' }, { correlativo: 'asc' }],
    });
    return facturas.map((f) => {
      const { monto_detraccion } = importesPersistidos(f.payload_ubl);
      const depositedTotal = Number(f.detraccion_deposited_amount ?? 0);
      return {
        id: f.id, numero: `${f.serie}-${String(f.correlativo).padStart(8, '0')}`, date: f.fecha_emision,
        customer: f.customer_legal_name ?? '', total: Number(f.monto_total), detraction: monto_detraccion ?? 0,
        depositedAt: f.detraccion_deposited_at, depositedAmount: f.detraccion_deposited_amount ? Number(f.detraccion_deposited_amount) : null,
        constancia: f.detraccion_constancia, depositedTotal,
        balance: new Prisma.Decimal(monto_detraccion ?? 0).minus(depositedTotal).toNumber(),
        deposits: (f.detraction_deposits ?? []).map(d => ({ id: d.id, date: d.date, amount: Number(d.amount), constancia: d.constancia })),
      };
    }).filter((f) => f.detraction > 0);
  }

  /** POST agrega un movimiento; PUT edita únicamente el movimiento identificado. */
  async registerDeposit(companyId: string, id: string, dto: DepositInput, actor = 'no informado', depositId?: string) {
    if (dto.constancia != null && typeof dto.constancia !== 'string') throw new BadRequestException('La constancia debe contener solo dígitos o quedar vacía.');
    const constancia = dto.constancia?.trim() || null;
    if (constancia && !/^[0-9]+$/.test(constancia)) throw new BadRequestException('La constancia debe contener solo dígitos o quedar vacía.');
    return this.prisma.$transaction(async tx => {
      // Todos los escritores de movimientos toman el mismo lock antes de leer la suma.
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${id} AND company_id = ${companyId} FOR UPDATE`;
      const factura = await tx.invoice.findFirst({ where: { id, company_id: companyId } });
      if (!factura) throw new NotFoundException('Comprobante no encontrado.');
      if (factura.estado === 'ANULADO') throw new BadRequestException('El comprobante está anulado.');
      const { monto_detraccion } = importesPersistidos(factura.payload_ubl);
      if (!monto_detraccion || monto_detraccion <= 0) throw new BadRequestException('El comprobante no tiene detracción.');
      const monto = Number(dto.amount);
      if (!Number.isFinite(monto) || !(monto > 0) || new Prisma.Decimal(monto).decimalPlaces() > 2 || monto > monto_detraccion) throw new BadRequestException(`El depósito debe tener como máximo 2 decimales y estar entre 0.01 y ${monto_detraccion.toFixed(2)}.`);
      const fecha = new Date(fechaIso(dto.date ?? '', 'depósito'));
      const movements = await tx.invoiceDetractionDeposit.findMany({ where: { company_id: companyId, invoice_id: id } });
      const previous = depositId ? movements.find(d => d.id === depositId) : undefined;
      if (depositId && !previous) throw new NotFoundException('Depósito no encontrado.');
      const total = movements.filter(d => d.id !== depositId).reduce((sum, d) => sum.plus(d.amount), new Prisma.Decimal(0)).plus(monto);
      if (total.greaterThan(monto_detraccion)) throw new BadRequestException(`El total depositado no puede superar la detracción de ${monto_detraccion.toFixed(2)}.`);
      const data = { date: fecha, amount: monto, constancia, legacy: false };
      const movement = previous
        ? await tx.invoiceDetractionDeposit.update({ where: { id: previous.id }, data })
        : await tx.invoiceDetractionDeposit.create({ data: { ...data, company_id: companyId, invoice_id: id } });
      const latest = [...movements.filter(d => d.id !== depositId), movement]
        .sort((a, b) => a.date.getTime() - b.date.getTime() || a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id)).at(-1)!;
      const updated = await tx.invoice.update({ where: { id }, data: { detraccion_deposited_at: latest.date, detraccion_deposited_amount: total, detraccion_constancia: latest.constancia } });
      await tx.transactionHistory.create({ data: { company_id: companyId, invoice_id: id, intento: 0,
        estado_anterior: factura.estado, estado_nuevo: factura.estado, codigo_error: 'M1_DETRACTION_DEPOSIT',
        mensaje_error: JSON.stringify({ version: 1, accion: previous ? 'Depósito de detracción actualizado' : 'Depósito de detracción registrado', actor,
          movimientoId: movement.id, anterior: previous ? snapshot(previous) : null, nuevo: snapshot(movement) }) } });
      return { ...updated, deposit: { id: movement.id, date: movement.date, amount: Number(movement.amount), constancia: movement.constancia } };
    });
  }
}
