import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import { GenerateAccountingEntryUseCase } from './generateAccountingEntryUseCase';

@Injectable()
export class GenerateClosingEntryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generar: GenerateAccountingEntryUseCase,
  ) {}

  async execute(companyId: string, year: number) {
    const existente = await this.prisma.accountingEntry.findFirst({
      where: { company_id: companyId, source_module: 'CLOSING', source_reference_id: `CIERRE-${year}` },
      select: { id: true },
    });
    if (existente) throw new BadRequestException(`El asiento de cierre ${year} ya existe.`);

    const entradas = await this.prisma.accountingEntry.findMany({
      where: { company_id: companyId, period: { startsWith: `${year}-` } },
      include: { lines: true },
    });
    if (entradas.length === 0) throw new BadRequestException(`No hay asientos en ${year}.`);

    const cuentas = new Map<string, { name: string; debit: number; credit: number }>();
    for (const entrada of entradas) {
      for (const linea of entrada.lines) {
        const actual = cuentas.get(linea.account_code) ?? { name: linea.account_name, debit: 0, credit: 0 };
        actual.debit += Number(linea.debit_amount);
        actual.credit += Number(linea.credit_amount);
        cuentas.set(linea.account_code, actual);
      }
    }

    const ingresos = [...cuentas.entries()].filter(([code]) => code.startsWith('7'));
    const gastos = [...cuentas.entries()].filter(([code]) => code.startsWith('6'));
    const lineas: Array<{ lineOrder: number; accountCode: string; accountName: string; debitAmount: number; creditAmount: number }> = [];
    let totalIngresos = 0;
    let totalGastos = 0;
    const r2 = (n: number) => Math.round(n * 100) / 100;

    for (const [code, cuenta] of ingresos) {
      const saldo = r2(cuenta.credit - cuenta.debit);
      if (saldo <= 0) continue;
      totalIngresos += saldo;
      lineas.push({ lineOrder: lineas.length + 1, accountCode: code, accountName: cuenta.name, debitAmount: saldo, creditAmount: 0 });
    }
    for (const [code, cuenta] of gastos) {
      const saldo = r2(cuenta.debit - cuenta.credit);
      if (saldo <= 0) continue;
      totalGastos += saldo;
      lineas.push({ lineOrder: lineas.length + 1, accountCode: code, accountName: cuenta.name, debitAmount: 0, creditAmount: saldo });
    }

    const resultado = r2(totalIngresos - totalGastos);
    lineas.push({ lineOrder: lineas.length + 1, accountCode: '59', accountName: 'Resultados acumulados', debitAmount: r2(totalGastos), creditAmount: 0 });
    lineas.push({ lineOrder: lineas.length + 1, accountCode: '59', accountName: 'Resultados acumulados', debitAmount: 0, creditAmount: r2(totalIngresos) });

    return this.generar.execute({
      companyId,
      period: `${year}-12`,
      entryDate: new Date(`${year}-12-31T00:00:00Z`).toISOString(),
      glosa: `Asiento de cierre del ejercicio ${year}`,
      sourceModule: 'CLOSING',
      sourceReferenceId: `CIERRE-${year}`,
      idempotencyKey: `closing-${year}`,
      lines: lineas,
    }).then((asiento) => ({ asiento, totalIngresos: r2(totalIngresos), totalGastos: r2(totalGastos), resultado }));
  }
}
