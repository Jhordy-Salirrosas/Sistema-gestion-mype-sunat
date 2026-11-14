/**
 * Reglas puras de integridad del catálogo PCGE y de `accounting_rules`.
 *
 * El módulo ya validaba, al crear un asiento MANUAL, que la cuenta exista y que
 * no sea una cuenta de mayor con subcuentas. Los asientos AUTOMÁTICOS (venta,
 * compra, recepción, pago, gasto, cobro, ajuste) no pasaban por esa validación:
 * tomaban el `account_code` de la regla y lo escribían tal cual. Una regla mal
 * configurada no rompía la emisión, simplemente contaminaba el Libro Diario con
 * una cuenta inexistente o con una cuenta de mayor agregada, y como el asiento
 * seguía cuadrando, ningún control de partida doble lo detectaba.
 *
 * Este archivo concentra esas comprobaciones en funciones puras para poder
 * usarlas tanto en la auditoría (`GET /accounting/audit`) como en los tests, sin
 * arrastrar Prisma ni NestJS al dominio.
 */

/** Cuenta mínima del catálogo que necesitan las validaciones. */
export interface CatalogAccount {
  code: string;
  name?: string;
  parentCode?: string | null;
  isActive?: boolean;
}

/** Regla de contabilización mínima (`accounting_rules`). */
export interface AccountingRuleLike {
  process_code: string;
  document_type?: string | null;
  line_order: number;
  account_code: string;
  side?: string;
  is_active?: boolean;
}

export type IntegritySeverity = 'ERROR' | 'WARN';

export type IntegrityCode =
  | 'CATALOGO_VACIO'
  | 'CUENTA_NO_EXISTE'
  | 'CUENTA_INACTIVA'
  | 'CUENTA_MADRE'
  | 'PROCESO_SIN_REGLA'
  | 'PROCESO_INCOMPLETO'
  | 'LINEA_DUPLICADA'
  | 'LADO_INVALIDO'
  | 'CUENTA_REPETIDA';

export interface IntegrityIssue {
  severity: IntegritySeverity;
  code: IntegrityCode;
  process?: string;
  lineOrder?: number;
  accountCode?: string;
  message: string;
}

/**
 * Líneas que el código exige por proceso.
 *
 * `obligatorias` son las que el servicio lee sin respaldo: si falta una, el
 * asiento no se puede armar. `recomendadas` son las que hoy admiten respaldo por
 * `accounting_mapping` y solo se avisan (costo de ventas, p. ej.).
 */
export const LINEAS_POR_PROCESO: Readonly<
  Record<string, { obligatorias: number[]; recomendadas: number[] }>
> = {
  VENTA: { obligatorias: [1, 2, 3], recomendadas: [10, 11] },
  COMPRA: { obligatorias: [1, 2, 3], recomendadas: [] },
  RECEPCION: { obligatorias: [1, 2], recomendadas: [] },
  PAGO: { obligatorias: [1, 2], recomendadas: [] },
  GASTO: { obligatorias: [1, 2, 3], recomendadas: [] },
  COBRO: { obligatorias: [1, 2], recomendadas: [] },
  AJUSTE: { obligatorias: [1, 2, 3], recomendadas: [] },
};

export const PROCESOS_SOPORTADOS = Object.keys(LINEAS_POR_PROCESO);

/**
 * Nivel a partir del cual una cuenta es divisionaria y sí admite asientos.
 *
 * El PCGE llega a seis dígitos (40111 → 401111), pero una divisionaria que
 * tiene subdivisionarias opcionales sigue siendo una cuenta de posteo: la 40111
 * "IGV cuenta propia" se usa en todas las ventas aunque existan 401111 y
 * 401119. Marcar esas cuentas como "de mayor" llenaba la auditoría de falsos
 * positivos. Se considera agregada solo una cuenta de 4 dígitos o menos que
 * tenga hijas: elemento (2), cuenta (3) y subcuenta (4).
 */
export const LONGITUD_MINIMA_POSTEO = 5;

/** Códigos de cuenta agregados: tienen hijas y están en nivel de subcuenta o superior. */
export const cuentasConHijos = (
  catalog: readonly CatalogAccount[],
): ReadonlySet<string> => {
  const padres = new Set<string>();
  for (const cuenta of catalog) {
    const padre = cuenta.parentCode;
    if (!padre) continue;
    if (padre.length < LONGITUD_MINIMA_POSTEO) padres.add(padre);
  }
  return padres;
};

const etiqueta = (process?: string, lineOrder?: number): string => {
  if (!process && lineOrder === undefined) return '';
  if (!process) return `Línea ${lineOrder}: `;
  return lineOrder === undefined
    ? `${process}: `
    : `${process} línea ${lineOrder}: `;
};

/**
 * Comprueba un código de cuenta contra el catálogo.
 *
 * El orden importa: primero "no existe" (no hay nada más que decir), después
 * inactiva y al final cuenta de mayor con subcuentas. Una cuenta inactiva que
 * además es de mayor se reporta una sola vez, con el motivo más accionable.
 */
export const checkAccountCode = (
  catalog: readonly CatalogAccount[],
  accountCode: string,
  contexto: { process?: string; lineOrder?: number } = {},
  agregadas: ReadonlySet<string> = cuentasConHijos(catalog),
): IntegrityIssue | null => {
  const prefijo = etiqueta(contexto.process, contexto.lineOrder);
  const cuenta = catalog.find((c) => c.code === accountCode);
  if (!cuenta) {
    return {
      severity: 'ERROR',
      code: 'CUENTA_NO_EXISTE',
      process: contexto.process,
      lineOrder: contexto.lineOrder,
      accountCode,
      message: `${prefijo}la cuenta PCGE ${accountCode} no existe en el catálogo`,
    };
  }
  if (cuenta.isActive === false) {
    return {
      severity: 'ERROR',
      code: 'CUENTA_INACTIVA',
      process: contexto.process,
      lineOrder: contexto.lineOrder,
      accountCode,
      message: `${prefijo}la cuenta PCGE ${accountCode} está inactiva`,
    };
  }
  if (agregadas.has(accountCode)) {
    return {
      severity: 'ERROR',
      code: 'CUENTA_MADRE',
      process: contexto.process,
      lineOrder: contexto.lineOrder,
      accountCode,
      message: `${prefijo}la cuenta PCGE ${accountCode} es de mayor y tiene subcuentas; use una subcuenta`,
    };
  }  return null;
};

/**
 * Valida el juego completo de reglas de una empresa.
 *
 * Devuelve un issue por cada problema encontrado, sin cortar en el primero: la
 * auditoría necesita la lista completa para que el contador corrija todo de una
 * vez en lugar de descubrir los errores de uno en uno.
 */
export const checkRules = (
  catalog: readonly CatalogAccount[],
  rules: readonly AccountingRuleLike[],
): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];
  if (catalog.length === 0) {
    issues.push({
      severity: 'ERROR',
      code: 'CATALOGO_VACIO',
      message:
        'El catálogo PCGE está vacío: ninguna regla puede validarse. Cargue el plan contable antes de contabilizar.',
    });
    return issues;
  }

  const activas = rules.filter((r) => r.is_active !== false);
  const agregadas = cuentasConHijos(catalog);
  const porProceso = new Map<string, AccountingRuleLike[]>();
  for (const regla of activas) {
    const lista = porProceso.get(regla.process_code) ?? [];
    lista.push(regla);
    porProceso.set(regla.process_code, lista);
  }

  for (const [proceso, reglas] of porProceso) {
    const config = LINEAS_POR_PROCESO[proceso];
    if (!config) {
      issues.push({
        severity: 'WARN',
        code: 'PROCESO_SIN_REGLA',
        process: proceso,
        message: `${proceso}: proceso sin plantilla conocida; no se valida su completitud`,
      });
      continue;
    }

    const ordenes = new Set<number>();
    const cuentasPorOrden = new Map<number, string>();
    for (const regla of reglas) {
      const issue = checkAccountCode(catalog, regla.account_code, {
        process: proceso,
        lineOrder: regla.line_order,
      }, agregadas);
      if (issue) issues.push(issue);

      if (regla.side && !['DEBE', 'HABER'].includes(regla.side)) {
        issues.push({
          severity: 'ERROR',
          code: 'LADO_INVALIDO',
          process: proceso,
          lineOrder: regla.line_order,
          accountCode: regla.account_code,
          message: `${proceso} línea ${regla.line_order}: lado "${regla.side}" inválido; use DEBE o HABER`,
        });
      }

      if (ordenes.has(regla.line_order)) {
        issues.push({
          severity: 'ERROR',
          code: 'LINEA_DUPLICADA',
          process: proceso,
          lineOrder: regla.line_order,
          message: `${proceso} línea ${regla.line_order}: hay más de una regla activa para la misma línea`,
        });
      }
      ordenes.add(regla.line_order);
      cuentasPorOrden.set(regla.line_order, regla.account_code);
    }

    const faltantes = config.obligatorias.filter((n) => !ordenes.has(n));
    if (faltantes.length > 0) {
      issues.push({
        severity: 'ERROR',
        code: faltantes.length === ordenes.size ? 'PROCESO_SIN_REGLA' : 'PROCESO_INCOMPLETO',
        process: proceso,
        message: `${proceso}: faltan las líneas obligatorias ${faltantes.join(', ')}`,
      });
    }

    const recomendadasFaltantes = config.recomendadas.filter((n) => !ordenes.has(n));
    if (recomendadasFaltantes.length > 0) {
      issues.push({
        severity: 'WARN',
        code: 'PROCESO_INCOMPLETO',
        process: proceso,
        message: `${proceso}: sin regla para las líneas ${recomendadasFaltantes.join(', ')}; se usará el mapeo de cuentas si existe`,
      });
    }

    // Dos líneas del mismo proceso apuntando a la misma cuenta y lado producen
    // un asiento que cuadra pero es ilegible en el PLE (dos movimientos
    // idénticos que deberían ser uno). Se avisa, no se bloquea.
    const vistos = new Map<string, number>();
    for (const regla of reglas) {
      const clave = `${regla.side ?? ''}:${regla.account_code}`;
      const previa = vistos.get(clave);
      if (previa !== undefined) {
        issues.push({
          severity: 'WARN',
          code: 'CUENTA_REPETIDA',
          process: proceso,
          lineOrder: regla.line_order,
          accountCode: regla.account_code,
          message: `${proceso} líneas ${previa} y ${regla.line_order} usan la misma cuenta ${regla.account_code} y lado ${regla.side ?? ''}`,
        });
      } else {
        vistos.set(clave, regla.line_order);
      }
    }
    void cuentasPorOrden;
  }

  return issues;
};

/** Valida las cuentas de las líneas de un asiento ya construido. */
export const checkEntryLines = (
  catalog: readonly CatalogAccount[],
  lines: readonly { accountCode: string }[],
): IntegrityIssue[] => {
  if (catalog.length === 0) {
    return [
      {
        severity: 'ERROR',
        code: 'CATALOGO_VACIO',
        message: 'El catálogo PCGE está vacío: no se pueden validar las cuentas del asiento.',
      },
    ];
  }
  const issues: IntegrityIssue[] = [];
  const agregadas = cuentasConHijos(catalog);
  lines.forEach((linea, index) => {
    const issue = checkAccountCode(catalog, linea.accountCode, { lineOrder: index + 1 }, agregadas);
    if (issue) issues.push(issue);
  });
  return issues;
};

/** Resume la severidad de una lista de hallazgos. */
export const resumir = (issues: readonly IntegrityIssue[]) => ({
  errors: issues.filter((i) => i.severity === 'ERROR').length,
  warnings: issues.filter((i) => i.severity === 'WARN').length,
  ok: issues.every((i) => i.severity !== 'ERROR'),
});
