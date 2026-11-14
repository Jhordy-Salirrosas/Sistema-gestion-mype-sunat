import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { GenerateAccountingEntryUseCase } from '../../../accounting/application/use-cases/generateAccountingEntryUseCase';
import { TreasuryAccountsService } from '../../../accounting/application/services/treasuryAccountsService';
import { AccountingCatalogService } from '../../../accounting/application/services/accountingCatalogService';
import {
  repartir,
  type DistributionInput,
  type DistributionLine,
} from '../../../accounting/domain/rules/distributionRule';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: GenerateAccountingEntryUseCase,
    @Optional()
    private readonly tesoreria?: TreasuryAccountsService,
    @Optional()
    private readonly catalogo?: AccountingCatalogService,
  ) {}

  async list(companyId: string) {
    return this.prisma.expense.findMany({ where: { company_id: companyId }, orderBy: { expense_date: 'desc' }, take: 200 });
  }

  async listPayments(companyId: string, id: string) {
    const gasto = await this.prisma.expense.findFirst({ where: { id, company_id: companyId }, select: { id: true } });
    if (!gasto) throw new BadRequestException('Gasto no encontrado.');
    const pagos = await this.prisma.treasuryMovement.findMany({
      where: { company_id: companyId, source_module: 'EXPENSES', source_reference_id: id, direction: 'EGRESO' },
      orderBy: { movement_date: 'desc' },
    });
    return pagos.map((p) => ({ id: p.id, date: p.movement_date, amount: Number(p.amount), paymentMethod: p.payment_method, bankName: p.bank_name, concept: p.concept }));
  }

  async create(companyId: string, dto: {
    description: string; supplierName: string; supplierDoc?: string; documentType?: string;
    documentNumber?: string; expenseDate?: string; baseAmount: number; igvAmount: number; totalAmount: number;
    distributions?: DistributionInput[];
  }) {
    if (!dto.description?.trim() || !dto.supplierName?.trim()) throw new BadRequestException('Descripción y proveedor son obligatorios.');
    if (!(dto.totalAmount > 0)) throw new BadRequestException('El total del gasto debe ser mayor a cero.');
    const base = Math.round(Number(dto.baseAmount) * 100) / 100;
    const igv = Math.round(Number(dto.igvAmount) * 100) / 100;
    const total = Math.round(Number(dto.totalAmount) * 100) / 100;
    if (Math.abs(base + igv - total) > 0.02) throw new BadRequestException('Base + IGV no coincide con el total del gasto.');
    const fecha = dto.expenseDate ? new Date(dto.expenseDate) : new Date();
    const reglas = await this.reglasGasto(companyId);
    const distribucion = dto.distributions?.length
      ? await this.repartirBase(base, dto.distributions)
      : null;

    const gasto = await this.prisma.expense.create({
      data: {
        company_id: companyId, expense_date: fecha, supplier_name: dto.supplierName.trim(),
        supplier_doc: dto.supplierDoc?.trim() || null, document_type: dto.documentType ?? '01',
        document_number: dto.documentNumber?.trim() || null, description: dto.description.trim(),
        base_amount: base, igv_amount: igv, total_amount: total, status: 'REGISTRADO',
        ...(distribucion
          ? {
              distributions: {
                create: distribucion.map((linea) => ({
                  company_id: companyId,
                  account_code: linea.accountCode,
                  amount: linea.amount,
                  percentage: linea.percentage,
                })),
              },
            }
          : {}),
      },
    });

    await this.contabilizar(companyId, gasto, { base, igv, total }, fecha, reglas, distribucion);
    return gasto;
  }

  /** Distribución vigente del gasto (vacía si no se repartió). */
  async distributions(companyId: string, id: string) {
    const gasto = await this.prisma.expense.findFirst({
      where: { id, company_id: companyId },
      select: { id: true },
    });
    if (!gasto) throw new BadRequestException('Gasto no encontrado.');
    const filas = await this.prisma.expenseDistribution.findMany({
      where: { expense_id: id, company_id: companyId },
      orderBy: { amount: 'desc' },
    });
    return filas.map((f) => ({
      accountCode: f.account_code,
      amount: Number(f.amount),
      percentage: Number(f.percentage),
    }));
  }

  /**
   * Reemplaza la distribución de un gasto que todavía no se contabilizó.
   *
   * Un gasto con asiento no se redistribuye: cambiarlo dejaría el asiento
   * anterior describiendo otra cosa. El camino correcto es anular y volver a
   * registrar, que es lo que el mensaje le dice al usuario.
   */
  async setDistributions(companyId: string, id: string, items: DistributionInput[]) {
    const gasto = await this.prisma.expense.findFirst({ where: { id, company_id: companyId } });
    if (!gasto) throw new BadRequestException('Gasto no encontrado.');
    if (gasto.status === 'ANULADO') throw new BadRequestException('El gasto está anulado.');
    const asiento = await this.prisma.accountingEntry.findFirst({
      where: { company_id: companyId, source_module: 'EXPENSES', source_reference_id: id },
      select: { id: true },
    });
    if (asiento) {
      throw new BadRequestException(
        'El gasto ya está contabilizado: no se puede redistribuir. Anule el gasto y registre uno nuevo.',
      );
    }
    const lineas = await this.repartirBase(Number(gasto.base_amount), items);
    await this.prisma.$transaction([
      this.prisma.expenseDistribution.deleteMany({ where: { expense_id: id, company_id: companyId } }),
      this.prisma.expenseDistribution.createMany({
        data: lineas.map((linea) => ({
          expense_id: id,
          company_id: companyId,
          account_code: linea.accountCode,
          amount: linea.amount,
          percentage: linea.percentage,
        })),
      }),
    ]);
    return this.distributions(companyId, id);
  }

  /**
   * Contabiliza un gasto que quedó sin asiento.
   *
   * Es el reintento que ofrece la auditoría para los gastos históricos: usa la
   * distribución guardada si existe y, si no, las reglas GASTO.
   */
  async post(companyId: string, id: string) {
    const gasto = await this.prisma.expense.findFirst({ where: { id, company_id: companyId } });
    if (!gasto) throw new BadRequestException('Gasto no encontrado.');
    if (gasto.status === 'ANULADO') throw new BadRequestException('El gasto está anulado.');
    const asiento = await this.prisma.accountingEntry.findFirst({
      where: { company_id: companyId, source_module: 'EXPENSES', source_reference_id: id },
      select: { id: true },
    });
    if (asiento) throw new BadRequestException('El gasto ya tiene asiento contable.');

    const reglas = await this.reglasGasto(companyId);
    const guardadas = await this.prisma.expenseDistribution.findMany({
      where: { expense_id: id, company_id: companyId },
    });
    const distribucion: DistributionLine[] | null = guardadas.length
      ? guardadas.map((d) => ({
          accountCode: d.account_code,
          amount: Number(d.amount),
          percentage: Number(d.percentage),
        }))
      : null;

    await this.contabilizar(
      companyId,
      gasto,
      {
        base: Number(gasto.base_amount),
        igv: Number(gasto.igv_amount),
        total: Number(gasto.total_amount),
      },
      new Date(gasto.expense_date),
      reglas,
      distribucion,
    );
    return { id, contabilizado: true };
  }

  private async reglasGasto(companyId: string) {
    const reglas = await this.prisma.accountingRule.findMany({
      where: { company_id: companyId, process_code: 'GASTO', is_active: true },
      orderBy: { line_order: 'asc' },
    });
    const lineas = new Set(reglas.map((r) => r.line_order));
    if (reglas.length === 0 || ![1, 2, 3].every((n) => lineas.has(n))) {
      throw new BadRequestException('Las reglas GASTO están incompletas: se requieren las líneas 1 a 3.');
    }
    return reglas;
  }

  /** Valida la distribución contra la base y contra el catálogo PCGE. */
  private async repartirBase(
    base: number,
    items: readonly DistributionInput[],
  ): Promise<DistributionLine[]> {
    let lineas: DistributionLine[];
    try {
      lineas = repartir(base, items);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    if (this.catalogo) {
      await this.catalogo.validarCodigos(lineas.map((linea) => linea.accountCode));
    }
    return lineas;
  }

  private async contabilizar(
    companyId: string,
    gasto: { id: string; description: string; supplier_name: string },
    importes: { base: number; igv: number; total: number },
    fecha: Date,
    reglas: Array<{ line_order: number; account_code: string }>,
    distribucion: readonly DistributionLine[] | null,
  ): Promise<void> {
    const porOrden = new Map(reglas.map((r) => [r.line_order, r.account_code]));
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

    const lineas: Array<{
      lineOrder: number;
      accountCode: string;
      accountName: string;
      debitAmount: number;
      creditAmount: number;
    }> = [];

    if (distribucion?.length) {
      const nombres = this.catalogo
        ? await this.catalogo.nombres(distribucion.map((d) => d.accountCode))
        : new Map<string, string>();
      for (const linea of distribucion) {
        lineas.push({
          lineOrder: lineas.length + 1,
          accountCode: linea.accountCode,
          accountName: nombres.get(linea.accountCode) || 'Gasto',
          debitAmount: linea.amount,
          creditAmount: 0,
        });
      }
    } else {
      lineas.push({
        lineOrder: 1,
        accountCode: porOrden.get(1) ?? '63111',
        accountName: 'Gasto',
        debitAmount: importes.base,
        creditAmount: 0,
      });
    }

    // Un gasto sin IGV no debe llevar una línea de IGV en cero: la partida doble
    // rechaza importes vacíos y el asiento quedaría sin generar.
    if (importes.igv > 0) {
      lineas.push({
        lineOrder: lineas.length + 1,
        accountCode: porOrden.get(2) ?? '40111',
        accountName: 'IGV crédito fiscal',
        debitAmount: importes.igv,
        creditAmount: 0,
      });
    }

    lineas.push({
      lineOrder: lineas.length + 1,
      accountCode: porOrden.get(3) ?? '42121',
      accountName: 'Cuentas por pagar',
      debitAmount: 0,
      creditAmount: importes.total,
    });

    await this.accounting.execute({
      companyId,
      period: periodo,
      entryDate: fecha.toISOString(),
      glosa: `Gasto ${gasto.description} · ${gasto.supplier_name}`,
      sourceModule: 'EXPENSES',
      journalCode: 'GAS',
      sourceReferenceId: gasto.id,
      idempotencyKey: `expense:${gasto.id}`,
      lines: lineas,
    });
  }

  async annul(companyId: string, id: string) {
    const gasto = await this.prisma.expense.findFirst({ where: { id, company_id: companyId } });
    if (!gasto) throw new BadRequestException('Gasto no encontrado.');
    if (gasto.status === 'ANULADO') throw new BadRequestException('El gasto ya está anulado.');
    const original = await this.prisma.accountingEntry.findFirst({
      where: { company_id: companyId, source_module: 'EXPENSES', source_reference_id: id },
      include: { lines: true },
    });
    if (!original) throw new BadRequestException('El gasto no tiene asiento contable; no se puede anular.');
    const pagos = Number(gasto.paid_amount ?? 0) > 0
      ? await this.prisma.treasuryMovement.findMany({ where: { company_id: companyId, source_module: 'EXPENSES', source_reference_id: id, direction: 'EGRESO' } })
      : [];
    for (const pago of pagos) {
      await this.prisma.treasuryMovement.create({ data: {
        company_id: companyId, movement_date: new Date(), direction: 'INGRESO',
        document_reference: gasto.document_number ?? gasto.id, counterpart_name: gasto.supplier_name,
        concept: `Devolución por anulación gasto ${gasto.description}`, amount: Number(pago.amount),
        source_module: 'EXPENSES', source_reference_id: id, payment_method: pago.payment_method, bank_name: pago.bank_name,
      } });
      const asientoPago = await this.prisma.accountingEntry.findFirst({
        where: { company_id: companyId, source_module: 'EXPENSES', source_reference_id: `PAGO-GASTO-${id}-${pago.id}` }, include: { lines: true },
      });
      if (asientoPago) {
        const fechaPago = new Date();
        await this.accounting.execute({
          companyId, period: `${fechaPago.getFullYear()}-${String(fechaPago.getMonth() + 1).padStart(2, '0')}`,
          entryDate: fechaPago.toISOString(), glosa: `Anulación pago gasto ${gasto.description}`,
          sourceModule: 'EXPENSES', journalCode: 'CAJ', sourceReferenceId: `ANUL-PAGO-${id}-${pago.id}`,
          idempotencyKey: `expense-payment-annul:${pago.id}`,
          lines: asientoPago.lines.map((l, i) => ({ lineOrder: i + 1, accountCode: l.account_code, accountName: l.account_name, debitAmount: Number(l.credit_amount), creditAmount: Number(l.debit_amount) })),
        });
      }
    }

    const revertido = await this.prisma.accountingEntry.findFirst({
      where: { company_id: companyId, source_module: 'EXPENSES', source_reference_id: `ANUL-${id}` }, select: { id: true },
    });
    if (!revertido) {
      const fecha = new Date();
      const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      await this.accounting.execute({
        companyId, period: periodo, entryDate: fecha.toISOString(), glosa: `Anulación gasto ${gasto.description}`,
        sourceModule: 'EXPENSES', journalCode: 'GAS', sourceReferenceId: `ANUL-${id}`, idempotencyKey: `expense-annul:${id}`,
        lines: original.lines.map((l, i) => ({
          lineOrder: i + 1, accountCode: l.account_code, accountName: l.account_name,
          debitAmount: Number(l.credit_amount), creditAmount: Number(l.debit_amount),
        })),
      });
    }
    return this.prisma.expense.update({ where: { id }, data: { status: 'ANULADO' } });
  }

  async pay(companyId: string, id: string, dto: { amount?: number; paymentMethod?: string; bankName?: string; treasuryAccountId?: string }) {
    const gasto = await this.prisma.expense.findFirst({ where: { id, company_id: companyId } });
    if (!gasto) throw new BadRequestException('Gasto no encontrado.');
    if (gasto.status === 'PAGADO') throw new BadRequestException('El gasto ya está pagado.');
    const total = Number(gasto.total_amount);
    const pagado = Number(gasto.paid_amount ?? 0);
    const saldo = Math.round((total - pagado) * 100) / 100;
    const monto = Math.round(Number(dto.amount ?? saldo) * 100) / 100;
    if (!(monto > 0) || monto > saldo) throw new BadRequestException(`El monto debe estar entre 0.01 y ${saldo.toFixed(2)}.`);
    const nuevoPagado = Math.round((pagado + monto) * 100) / 100;
    const estado = nuevoPagado >= total - 0.005 ? 'PAGADO' : 'PAGO_PARCIAL';
    const fecha = new Date();
    const metodo = dto.paymentMethod ?? 'TRANSFERENCIA';
    const mov = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.treasuryMovement.create({ data: {
        company_id: companyId, movement_date: fecha, direction: 'EGRESO',
        document_reference: gasto.document_number ?? gasto.id, counterpart_name: gasto.supplier_name,
        concept: `Pago gasto ${gasto.description}`, amount: monto, source_module: 'EXPENSES',
        source_reference_id: gasto.id, payment_method: metodo, bank_name: dto.bankName ?? null,
      } });
      await tx.expense.update({ where: { id }, data: { paid_amount: nuevoPagado, status: estado } });
      return creado;
    });
    const reglas = await this.prisma.accountingRule.findMany({ where: { company_id: companyId, process_code: 'PAGO', is_active: true }, orderBy: { line_order: 'asc' } });
    const porOrden = new Map(reglas.map((r) => [r.line_order, r.account_code]));
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    // La cuenta de tesorería elegida por el usuario manda sobre el medio de pago;
    // si no eligió ninguna se conserva el comportamiento histórico.
    const cuentaTesoreriaFallback = {
      code: metodo === 'EFECTIVO' ? '1011' : (porOrden.get(2) ?? '1041'),
      name: metodo === 'EFECTIVO' ? 'Caja principal' : 'Cuenta corriente',
    };
    const cuentaTesoreria = this.tesoreria
      ? await this.tesoreria.cuentaParaAsiento(companyId, dto.treasuryAccountId, cuentaTesoreriaFallback)
      : cuentaTesoreriaFallback;
    await this.accounting.execute({
      companyId, period: periodo, entryDate: fecha.toISOString(), glosa: `Pago gasto ${gasto.description}`,
      sourceModule: 'EXPENSES', journalCode: 'CAJ', sourceReferenceId: `PAGO-GASTO-${id}-${mov.id}`, idempotencyKey: `expense-payment:${mov.id}`,
      lines: [
        { lineOrder: 1, accountCode: porOrden.get(1) ?? '42121', accountName: 'Cuentas por pagar', debitAmount: monto, creditAmount: 0 },
        { lineOrder: 2, accountCode: cuentaTesoreria.code, accountName: cuentaTesoreria.name, debitAmount: 0, creditAmount: monto },
      ],
    });
    return { id, status: estado, amount: monto, paidAmount: nuevoPagado, balance: Math.round((total - nuevoPagado) * 100) / 100 };
  }
}
