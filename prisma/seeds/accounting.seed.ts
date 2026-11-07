import type { PrismaClient } from '../../src/generated/client/client';

/** Semilla base del PCGE 2019 (98 cuentas). */
import { PCGE_2019_ACCOUNTS } from './pcge2019';

const ACCOUNTS: Array<[string, string]> = PCGE_2019_ACCOUNTS;

const ELEMENTS: Record<string, string> = {
  '1': 'Activo',
  '2': 'Activo realizable',
  '3': 'Activo inmovilizado',
  '4': 'Pasivo',
  '5': 'Patrimonio',
  '6': 'Gastos',
  '7': 'Ingresos',
  '8': 'Saldos intermediarios',
  '9': 'Contabilidad analítica',
};

function nature(code: string): string {
  return ['1', '2', '3', '6', '8', '9'].includes(code[0]) ? 'Deudora' : 'Acreedora';
}

/** Divisionarias con padre explícito. */
const PARENT_OVERRIDES: Record<string, string> = {
  '121101': '1211',
  '1212': '121',
  '12121': '121',
  '401111': '40111',
  '401119': '40111',
  '701111': '7011',
  '70121': '701',
};

function parentOf(code: string): string | null {
  return PARENT_OVERRIDES[code] ?? (code.length > 1 ? code.slice(0, -1) : null);
}

export async function seedAccounting(prisma: PrismaClient): Promise<void> {
  for (const [code, name] of ACCOUNTS) {
    await prisma.accountingAccount.upsert({
      where: { code },
      update: {
        name,
        element: ELEMENTS[code[0]] ?? 'Sin elemento',
        nature: nature(code),
        parent_code: parentOf(code),
        level: code.length,
        is_active: true,
      },
      create: {
        code,
        name,
        element: ELEMENTS[code[0]] ?? 'Sin elemento',
        nature: nature(code),
        parent_code: parentOf(code),
        level: code.length,
        is_active: true,
      },
    });
  }
  console.log(`PCGE: ${ACCOUNTS.length} cuentas aseguradas.`);
}
