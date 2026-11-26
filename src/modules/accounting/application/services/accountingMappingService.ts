import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prismaService';
import {
  ACCOUNT_NAMES,
  DEFAULT_ACCOUNTING_MAPPINGS,
  DEFAULT_DIRECTION,
  RULE_ORDER_ROLES,
  normalizeAccountingOperation,
  type AccountingOperation,
  type DefaultAccount,
} from './defaultAccountingMappings';

export interface OperationAccounts {
  operation: AccountingOperation;
  direction: 'SALIDA' | 'ENTRADA';
  accounts: Readonly<Record<string, DefaultAccount>>;
}

interface MappingRow {
  role_code: string;
  account_code: string;
}

interface RuleRow {
  line_order: number;
  account_code: string;
  document_type?: string | null;
  description?: string | null;
}

/**
 * Fuente única de cuentas contables de la empresa.
 *
 * Precedencia:
 *  1. Matriz global de la empresa (`accounting_mappings`).
 *  2. Reglas heredadas del proceso (`accounting_rules`), que pueden sobrescribir
 *     una cuenta concreta sin eliminar el resto de la configuración global.
 *  3. Matriz PCGE por defecto (`DEFAULT_ACCOUNTING_MAPPINGS`).
 *
 * Las cuentas específicas de SIRE siguen viviendo en su tabla y se aplican
 * encima del resultado de este servicio, para no perder configuraciones ya
 * existentes.
 */
@Injectable()
export class AccountingMappingService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccountsForOperation(
    tipoOperacion: string,
    companyId: string,
  ): Promise<OperationAccounts> {
    const operation = normalizeAccountingOperation(tipoOperacion);
    const accounts: Record<string, DefaultAccount> = {
      ...DEFAULT_ACCOUNTING_MAPPINGS[operation],
    };

    const processCodes = this.processCodes(operation);
    const [mappings, rules] = await Promise.all([
      this.findMappings(companyId, processCodes),
      this.findRules(companyId, processCodes),
    ]);

    for (const row of mappings) {
      const role = this.normalizeRole(row.role_code);
      if (!role) continue;
      accounts[role] = this.account(row.account_code);
    }

    for (const rule of rules) {
      const role = this.roleForRule(operation, rule);
      if (!role) continue;
      accounts[role] = this.account(rule.account_code);
    }

    await this.completeAccountNames(accounts);

    return {
      operation,
      direction: DEFAULT_DIRECTION[operation],
      accounts,
    };
  }

  private processCodes(operation: AccountingOperation): string[] {
    if (operation === 'SIRE_VENTAS') return ['SIRE_VENTAS', 'SIRE'];
    if (operation === 'SIRE_COMPRAS') return ['SIRE_COMPRAS', 'SIRE'];
    return [operation];
  }

  private async findMappings(
    companyId: string,
    processCodes: readonly string[],
  ): Promise<MappingRow[]> {
    const model = (this.prisma as unknown as { accountingMapping?: { findMany?: (args: unknown) => Promise<MappingRow[]> } }).accountingMapping;
    if (!model?.findMany) return [];
    try {
      return await model.findMany({
        where: {
          company_id: companyId,
          process_code: { in: [...processCodes] },
          is_active: true,
        },
        select: { role_code: true, account_code: true },
      });
    } catch {
      return [];
    }
  }

  private async findRules(
    companyId: string,
    processCodes: readonly string[],
  ): Promise<RuleRow[]> {
    const model = (this.prisma as unknown as { accountingRule?: { findMany?: (args: unknown) => Promise<RuleRow[]> } }).accountingRule;
    if (!model?.findMany) return [];
    try {
      return await model.findMany({
        where: {
          company_id: companyId,
          process_code: { in: [...processCodes] },
          is_active: true,
        },
        orderBy: { line_order: 'asc' },
        select: {
          line_order: true,
          account_code: true,
          document_type: true,
          description: true,
        },
      });
    } catch {
      return [];
    }
  }

  private roleForRule(
    operation: AccountingOperation,
    rule: RuleRow,
  ): string | undefined {
    const ordered = RULE_ORDER_ROLES[operation];
    const byOrder = ordered[Number(rule.line_order) - 1];
    if (byOrder) return byOrder;

    if (operation === 'IMPORTACION') {
      const candidate = this.normalizeRole(rule.description ?? rule.document_type ?? '');
      if (candidate && DEFAULT_ACCOUNTING_MAPPINGS.IMPORTACION[candidate]) {
        return candidate;
      }
    }
    return undefined;
  }

  private normalizeRole(value: string): string {
    const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');
    const aliases: Record<string, string> = {
      VENTA_GRAVADA: 'INGRESO',
      INVENTARIO_SALIDA: 'INVENTARIO',
    };
    return aliases[normalized] ?? normalized;
  }

  private account(code: string): DefaultAccount {
    const clean = code.trim();
    return {
      code: clean,
      name: ACCOUNT_NAMES[clean] ?? `Cuenta contable ${clean}`,
    };
  }

  /** Los nombres se resuelven contra el PCGE real cuando está disponible. */
  private async completeAccountNames(
    accounts: Record<string, DefaultAccount>,
  ): Promise<void> {
    const codes = [...new Set(Object.values(accounts).map((item) => item.code))];
    if (codes.length === 0) return;

    const model = (this.prisma as unknown as { accountingAccount?: { findMany?: (args: unknown) => Promise<Array<{ code: string; name: string }>> } }).accountingAccount;
    if (!model?.findMany) return;

    try {
      const rows = await model.findMany({
        where: { code: { in: codes } },
        select: { code: true, name: true },
      });
      const names = new Map(rows.map((row) => [row.code, row.name]));
      for (const item of Object.values(accounts)) {
        const name = names.get(item.code);
        if (name) item.name = name;
      }
    } catch {
      // El catálogo es una mejora del nombre, no la fuente del código.
    }
  }
}
