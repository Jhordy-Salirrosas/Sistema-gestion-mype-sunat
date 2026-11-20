import type { SireAccountingMappingEntry } from '../ports/sireAccountingMappingRepositoryPort';

/** Libro contable que se deriva de una propuesta SIRE. */
export type SireAccountingBookKind = 'VENTAS' | 'COMPRAS';

/** Totales monetarios de un libro SIRE. */
export interface SireAccountingTotals {
  taxableBase: number;
  igvAmount: number;
  totalAmount: number;
}

/** Línea de un asiento contable lista para pintarse en el frontend. */
export interface SireAccountingLinePreview {
  cuenta: string;
  nombre: string;
  debe: number;
  haber: number;
}

/** Cuentas por defecto del PCGE cuando la empresa no configuró el mapeo. */
export const SIRE_ACCOUNTING_DEFAULT_ACCOUNTS = {
  VENTAS: '121',
  COMPRAS: '421',
  IGV: '40111',
  BASE_VENTAS: '701',
  BASE_COMPRAS: '6011',
} as const;

const ACCOUNT_NAMES: Record<string, string> = {
  '121': 'Cuentas por cobrar comerciales',
  '421': 'Cuentas por pagar comerciales',
  '40111': 'IGV cuenta propia',
  '701': 'Ventas de mercaderías',
  '6011': 'Compras de mercaderías',
};

export function roundSireAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

/** Suma los importes de los comprobantes de un libro. */
export function sumSireRecordTotals(
  records: ReadonlyArray<{
    taxableBase: number;
    igvAmount: number;
    totalAmount: number;
  }>,
): SireAccountingTotals {
  return records.reduce<SireAccountingTotals>(
    (totals, record) => ({
      taxableBase: totals.taxableBase + roundSireAmount(record.taxableBase),
      igvAmount: totals.igvAmount + roundSireAmount(record.igvAmount),
      totalAmount: totals.totalAmount + roundSireAmount(record.totalAmount),
    }),
    { taxableBase: 0, igvAmount: 0, totalAmount: 0 },
  );
}

/**
 * Nombre visible de la cuenta.
 *
 * Prioriza el nombre real del catálogo PCGE (`accounting_accounts`); el mapa
 * local queda solo como respaldo para pruebas o catálogos incompletos.
 */
export function accountDisplayName(
  cuenta: string,
  accountNames?: ReadonlyMap<string, string>,
): string {
  return (
    accountNames?.get(cuenta) ??
    ACCOUNT_NAMES[cuenta] ??
    `Cuenta contable ${cuenta}`
  );
}

function resolveAccount(
  mappings: ReadonlyArray<SireAccountingMappingEntry>,
  aliases: string[],
  fallback: string,
): string {
  const normalized = new Map<string, string>();
  for (const mapping of mappings) {
    normalized.set(
      mapping.tipoOperacion.trim().toUpperCase(),
      mapping.cuentaContable.trim(),
    );
  }
  for (const alias of aliases) {
    const account = normalized.get(alias);
    if (account) return account;
  }
  return fallback;
}

/**
 * Construye las líneas del asiento de un libro SIRE.
 *
 * El mapeo configurado por la empresa decide las cuentas:
 *  - VENTAS: contrapartida del debe (por defecto, cuentas por cobrar).
 *  - COMPRAS: contrapartida del haber (por defecto, cuentas por pagar).
 *  - BASE_VENTAS / BASE_COMPRAS: cuenta de ingresos o gastos.
 *  - BASE: se usa como respaldo de las dos anteriores.
 *  - IGV_VENTAS / IGV_COMPRAS: cuenta del impuesto por libro; `IGV` queda como
 *    alias legado para empresas que ya tenían un único mapeo.
 *
 * El IGV se ajusta contra el total para que el asiento siempre cuadre, incluso
 * si la importación trae diferencias de redondeo.
 */
export function buildSireAccountingLines(
  kind: SireAccountingBookKind,
  totals: SireAccountingTotals,
  mappings: ReadonlyArray<SireAccountingMappingEntry>,
  accountNames?: ReadonlyMap<string, string>,
): SireAccountingLinePreview[] {
  const base = Math.max(0, roundSireAmount(totals.taxableBase));
  const rawIgv = Math.max(0, roundSireAmount(totals.igvAmount));
  let total = roundSireAmount(totals.totalAmount);
  if (total <= 0) total = roundSireAmount(base + rawIgv);

  if (kind === 'VENTAS') {
    const totalAccount = resolveAccount(
      mappings,
      ['VENTAS'],
      SIRE_ACCOUNTING_DEFAULT_ACCOUNTS.VENTAS,
    );
    const baseAccount = resolveAccount(
      mappings,
      ['BASE_VENTAS', 'BASE'],
      SIRE_ACCOUNTING_DEFAULT_ACCOUNTS.BASE_VENTAS,
    );
    const igvAccount = resolveAccount(
      mappings,
      ['IGV_VENTAS', 'IGV'],
      SIRE_ACCOUNTING_DEFAULT_ACCOUNTS.IGV,
    );
    const safeBase = Math.min(base, total);
    const igv = roundSireAmount(total - safeBase);
    const lines: SireAccountingLinePreview[] = [
      {
        cuenta: totalAccount,
        nombre: accountDisplayName(totalAccount, accountNames),
        debe: total,
        haber: 0,
      },
      {
        cuenta: baseAccount,
        nombre: accountDisplayName(baseAccount, accountNames),
        debe: 0,
        haber: safeBase,
      },
      {
        cuenta: igvAccount,
        nombre: accountDisplayName(igvAccount, accountNames),
        debe: 0,
        haber: igv,
      },
    ];
    return lines.filter((line) => line.debe > 0 || line.haber > 0);
  }

  const totalAccount = resolveAccount(
    mappings,
    ['COMPRAS'],
    SIRE_ACCOUNTING_DEFAULT_ACCOUNTS.COMPRAS,
  );
  const baseAccount = resolveAccount(
    mappings,
    ['BASE_COMPRAS', 'BASE'],
    SIRE_ACCOUNTING_DEFAULT_ACCOUNTS.BASE_COMPRAS,
  );
  const igvAccount = resolveAccount(
    mappings,
    ['IGV_COMPRAS', 'IGV'],
    SIRE_ACCOUNTING_DEFAULT_ACCOUNTS.IGV,
  );
  const safeBase = Math.min(base, total);
  const igv = roundSireAmount(total - safeBase);
  const lines: SireAccountingLinePreview[] = [
    {
      cuenta: baseAccount,
      nombre: accountDisplayName(baseAccount, accountNames),
      debe: safeBase,
      haber: 0,
    },
    {
      cuenta: igvAccount,
      nombre: accountDisplayName(igvAccount, accountNames),
      debe: igv,
      haber: 0,
    },
    {
      cuenta: totalAccount,
      nombre: accountDisplayName(totalAccount, accountNames),
      debe: 0,
      haber: total,
    },
  ];
  return lines.filter((line) => line.debe > 0 || line.haber > 0);
}
