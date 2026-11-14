/**
 * Distribución de un importe entre varias cuentas contables.
 *
 * Un gasto puede corresponder a más de una cuenta (flete + embalaje + servicio)
 * y un cobro puede aplicarse a más de una cuenta por cobrar (facturas y
 * detracciones). Hasta ahora ambos se contabilizaban en una sola cuenta tomada
 * de las reglas del proceso.
 *
 * Reglas de negocio, en un solo lugar y sin Prisma:
 *  - la distribución nunca puede estar vacía;
 *  - se reparte por **importes** o por **porcentajes**, no mezclando;
 *  - los importes deben sumar el total exacto (tolerancia de un céntimo);
 *  - los porcentajes deben sumar 100 (tolerancia 0.01);
 *  - no se admite la misma cuenta dos veces;
 *  - ningún importe puede ser cero o negativo.
 */

export interface DistributionInput {
  accountCode: string;
  amount?: number;
  percentage?: number;
}

export interface DistributionLine {
  accountCode: string;
  amount: number;
  /** Porcentaje sobre el total, con dos decimales. */
  percentage: number;
}

/** Cuenta de la distribución ya resuelta contra el catálogo. */
export interface DistributionAccount {
  code: string;
  name: string;
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const TOLERANCIA = 0.01;

export class DistributionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DistributionError';
  }
}

/**
 * Valida y normaliza una distribución.
 *
 * @param total  importe a repartir (base del gasto o importe del cobro).
 * @param items  líneas enviadas por el cliente.
 * @throws DistributionError con un mensaje accionable.
 */
export const repartir = (
  total: number,
  items: readonly DistributionInput[],
): DistributionLine[] => {
  const monto = r2(total);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new DistributionError(
      'El importe a distribuir debe ser mayor que cero; no se puede repartir un total vacío.',
    );
  }
  if (items.length === 0) {
    throw new DistributionError('La distribución no puede estar vacía: agregue al menos una cuenta.');
  }

  const codigos = new Set<string>();
  for (const item of items) {
    const code = item.accountCode?.trim();
    if (!code) {
      throw new DistributionError('Cada línea de la distribución necesita una cuenta contable.');
    }
    if (codigos.has(code)) {
      throw new DistributionError(`La cuenta ${code} está repetida en la distribución.`);
    }
    codigos.add(code);
  }

  const conImporte = items.filter((i) => i.amount !== undefined);
  const conPorcentaje = items.filter((i) => i.percentage !== undefined);

  if (conImporte.length > 0 && conPorcentaje.length > 0) {
    throw new DistributionError(
      'Distribuya por importes o por porcentajes, no mezcle ambos criterios en el mismo gasto.',
    );
  }
  if (conImporte.length === 0 && conPorcentaje.length === 0) {
    throw new DistributionError(
      'Indique el importe o el porcentaje de cada cuenta de la distribución.',
    );
  }

  if (conPorcentaje.length === items.length) {
    return repartirPorPorcentaje(monto, items);
  }
  return repartirPorImporte(monto, items);
};

const repartirPorImporte = (
  total: number,
  items: readonly DistributionInput[],
): DistributionLine[] => {
  const lineas: DistributionLine[] = items.map((item) => {
    const amount = r2(Number(item.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new DistributionError(
        `La línea de la cuenta ${item.accountCode} debe tener un importe mayor que cero.`,
      );
    }
    return {
      accountCode: item.accountCode.trim(),
      amount,
      percentage: r2((amount / total) * 100),
    };
  });

  const suma = r2(lineas.reduce((acc, l) => acc + l.amount, 0));
  // La comparación se hace en céntimos: en coma flotante `100 - 99.99` da
  // 0.010000000000005116 y rechazaría una distribución que sí cuadra.
  if (Math.abs(r2(total - suma)) > TOLERANCIA) {
    throw new DistributionError(
      `La distribución suma ${suma.toFixed(2)} y el total es ${total.toFixed(2)}. Ajuste los importes.`,
    );
  }
  return ajustarUltimaLinea(lineas, total);
};

const repartirPorPorcentaje = (
  total: number,
  items: readonly DistributionInput[],
): DistributionLine[] => {
  const lineas: DistributionLine[] = items.map((item) => {
    const percentage = r2(Number(item.percentage));
    if (!Number.isFinite(percentage) || percentage <= 0) {
      throw new DistributionError(
        `La línea de la cuenta ${item.accountCode} debe tener un porcentaje mayor que cero.`,
      );
    }
    return {
      accountCode: item.accountCode.trim(),
      amount: r2((total * percentage) / 100),
      percentage,
    };
  });

  const suma = r2(lineas.reduce((acc, l) => acc + l.percentage, 0));
  if (Math.abs(r2(suma - 100)) > TOLERANCIA) {
    throw new DistributionError(
      `Los porcentajes suman ${suma.toFixed(2)}% y deben sumar 100%.`,
    );
  }
  return ajustarUltimaLinea(lineas, total);
};

/**
 * El redondeo por línea deja diferencias de un céntimo contra el total. Se
 * ajusta la última línea para que el asiento cierre sin recolocar importes ya
 * calculados en las demás.
 */
const ajustarUltimaLinea = (lineas: DistributionLine[], total: number): DistributionLine[] => {
  const suma = r2(lineas.reduce((acc, l) => acc + l.amount, 0));
  const diferencia = r2(total - suma);
  if (diferencia === 0) return lineas;
  const ultima = lineas[lineas.length - 1];
  if (r2(ultima.amount + diferencia) <= 0) {
    throw new DistributionError(
      'El redondeo de la distribución deja una línea en cero; revise los importes.',
    );
  }
  ultima.amount = r2(ultima.amount + diferencia);
  ultima.percentage = r2((ultima.amount / total) * 100);
  return lineas;
};

/** Verifica que todas las cuentas de la distribución existan en el catálogo. */
export const cuentasFaltantes = (
  lineas: readonly DistributionLine[],
  catalogo: readonly DistributionAccount[],
): string[] => {
  const existentes = new Set(catalogo.map((c) => c.code));
  return lineas.map((l) => l.accountCode).filter((code) => !existentes.has(code));
};
