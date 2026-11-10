import type { PrismaClient } from '../../src/generated/client/client';

/** Reglas base PCGE para una MYPE ferretera. Se pueden ajustar por empresa. */
import { DEFAULT_ACCOUNTING_RULES as RULES } from '../../src/modules/accounting/domain/rules/defaultAccountingRules';

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
