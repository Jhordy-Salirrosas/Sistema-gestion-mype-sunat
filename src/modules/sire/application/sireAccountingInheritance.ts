import type { DefaultAccount } from '../../accounting/application/services/defaultAccountingMappings';
import type { SireAccountingBookKind } from '../domain/rules/sireAccountingMappingRule';

export interface SireInheritedMapping {
  tipoOperacion: string;
  cuentaContable: string;
}

/**
 * Traduce la matriz global de la empresa a los conceptos del asiento SIRE.
 * Los mapeos propios de `sire_accounting_mappings` se aplican después.
 */
export function inheritSireAccountingMappings(
  accounts: Readonly<Record<string, DefaultAccount>>,
  kind: SireAccountingBookKind,
): SireInheritedMapping[] {
  if (kind === 'VENTAS') {
    return [
      accounts.CXC && { tipoOperacion: 'VENTAS', cuentaContable: accounts.CXC.code },
      accounts.IGV && { tipoOperacion: 'IGV', cuentaContable: accounts.IGV.code },
      accounts.INGRESO && { tipoOperacion: 'BASE', cuentaContable: accounts.INGRESO.code },
    ].filter((item): item is SireInheritedMapping => Boolean(item));
  }
  return [
    accounts.CXP && { tipoOperacion: 'COMPRAS', cuentaContable: accounts.CXP.code },
    accounts.IGV && { tipoOperacion: 'IGV', cuentaContable: accounts.IGV.code },
    accounts.COMPRA && { tipoOperacion: 'BASE', cuentaContable: accounts.COMPRA.code },
  ].filter((item): item is SireInheritedMapping => Boolean(item));
}
