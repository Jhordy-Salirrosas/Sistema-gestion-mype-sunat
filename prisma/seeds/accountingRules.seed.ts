import type { PrismaClient } from '../../src/generated/client/client';

/** Reglas base PCGE para una MYPE ferretera. Se pueden ajustar por empresa. */
const RULES: Array<[string, string, number, string, 'DEBE' | 'HABER', string, string]> = [
  ['VENTA', '*', 1, '12121', 'DEBE', 'TOTAL', 'Cuentas por cobrar emitidas'],
  ['VENTA', '*', 2, '40111', 'HABER', 'IGV', 'IGV cuenta propia'],
  ['VENTA', '*', 3, '70121', 'HABER', 'BASE', 'Ventas de mercaderías gravadas'],
  ['VENTA', '*', 4, '69111', 'DEBE', 'COSTO', 'Costo de ventas'],
  ['VENTA', '*', 5, '20111', 'HABER', 'COSTO', 'Mercaderías'],
  ['COMPRA', '*', 1, '60111', 'DEBE', 'BASE', 'Compras de mercaderías'],
  ['COMPRA', '*', 2, '40111', 'DEBE', 'IGV', 'IGV crédito fiscal'],
  ['COMPRA', '*', 3, '42121', 'HABER', 'TOTAL', 'Cuentas por pagar comerciales'],
  ['COMPRA', '*', 4, '20111', 'DEBE', 'BASE', 'Ingreso a almacén'],
  ['COMPRA', '*', 5, '61111', 'HABER', 'BASE', 'Variación de existencias'],
  ['PAGO', '*', 1, '42121', 'DEBE', 'MONTO_PAGADO', 'Pago a proveedor'],
  ['PAGO', '*', 2, '1041', 'HABER', 'MONTO_PAGADO', 'Cuenta corriente'],
  ['GASTO', '*', 1, '63111', 'DEBE', 'BASE', 'Gastos de servicios'],
  ['GASTO', '*', 2, '40111', 'DEBE', 'IGV', 'IGV crédito fiscal'],
  ['GASTO', '*', 3, '42121', 'HABER', 'TOTAL', 'Cuentas por pagar'],
  ['AJUSTE', '*', 1, '65911', 'DEBE', 'COSTO', 'Pérdida por ajuste'],
  ['AJUSTE', '*', 2, '20111', 'HABER', 'COSTO', 'Mercaderías'],
];

export async function seedAccountingRules(prisma: PrismaClient): Promise<void> {
  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const company of companies) {
    for (const [process, doc, order, account, side, base, description] of RULES) {
      await prisma.accountingRule.upsert({
        where: { company_id_process_code_document_type_line_order: { company_id: company.id, process_code: process, document_type: doc, line_order: order } },
        update: { account_code: account, side, base_calculation: base, description, is_active: true },
        create: { company_id: company.id, process_code: process, document_type: doc, line_order: order, account_code: account, side, base_calculation: base, description },
      });
    }
  }
  console.log(`Reglas contables: ${companies.length * RULES.length} aseguradas.`);
}
