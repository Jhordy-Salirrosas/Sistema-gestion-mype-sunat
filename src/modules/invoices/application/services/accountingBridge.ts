import { fechaFiscalLima } from '../../fiscalDate';
import { redondearMoneda as r2 } from '../../money';
/**
 * Asiento contable de una factura de venta, según el PCGE 2019 (TA-68).
 *
 * El puente facturación → contabilidad NO reimplementa la partida doble: usa el
 * `GenerateAccountingEntryUseCase` del módulo de contabilidad, que ya valida el
 * balance. Lo que aporta este archivo es la TRADUCCIÓN de un comprobante a
 * cuentas y montos.
 *
 * Las cuentas son las del Plan Contable General Empresarial 2019 que exige SUNAT
 * para el registro de ventas (formato 14.1 del PLE):
 *
 *  - **12121** — Facturas, boletas y otros comprobantes por cobrar, emitidas.
 *    Se carga por el importe que el cliente paga directamente al proveedor.
 *  - **12129** — Cuentas por cobrar - detracciones. El cliente deposita la
 *    detracción en el Banco de la Nación, no en la cuenta del proveedor; es una
 *    cuenta por cobrar distinta y no se cobra por la misma vía.
 *  - **40114** — IGV - Retenciones. Cuando el cliente es agente de retención, el
 *    importe retenido se entera al fisco a nombre del proveedor: es un crédito
 *    contra el IGV, no una cuenta por cobrar.
 *  - **40111** — IGV, cuenta propia. Se abona por el IGV trasladado al cliente.
 *  - **70121** — Servicios prestados / venta de mercadería gravada.
 *  - **70321** — Exoneradas.
 *  - **70521** — Inafectas.
 *  - **74111** — ICBPER por pagar. Se abona por el impuesto a las bolsas.
 *
 * DEFECTO CORREGIDO: antes `porCobrarRetenido` y `detraccion` compartían el
 * código **1212**, así que el asiento mezclaba dos conceptos tributarios bajo la
 * misma cuenta. La 1212 del PCGE es "Efectos y cuentas por cobrar al personal",
 * que no es ni retención ni detracción. El asiento cuadraba en el balance y por
 * eso ningún test de partida doble lo detectó: cuadrar no es clasificar bien.
 *
 * El asiento se genera con el detalle de líneas por tributo y NO como
 * "debe total / haber total": un asiento de dos líneas cuadra pero no sirve
 * para el PLE, que necesita ver la base, el IGV y el ICBPER separados.
 */
import type { AccountingLineDto } from '../../../accounting/application/dto/createAccountingEntryDto';

/** Cuentas del PCGE que se usan en una venta. */
export const CUENTAS_VENTA = {
  porCobrar: { codigo: '12121', nombre: 'Facturas, boletas y otros comprobantes por cobrar, emitidas' },
  porCobrarRetenido: { codigo: '40114', nombre: 'IGV - Retenciones' },
  igv: { codigo: '40111', nombre: 'IGV - Cuenta propia' },
  gravada: { codigo: '70121', nombre: 'Servicios prestados / ventas gravadas' },
  exonerada: { codigo: '70321', nombre: 'Ventas exoneradas del IGV' },
  inafecta: { codigo: '70521', nombre: 'Ventas inafectas del IGV' },
  icbper: { codigo: '74111', nombre: 'Impuesto a las bolsas plásticas por pagar' },
  detraccion: { codigo: '12129', nombre: 'Cuentas por cobrar - detracciones' },
  descuento: { codigo: '74', nombre: 'Descuentos, rebajas y bonificaciones concedidos' },
} as const;

/** Importes de un comprobante necesarios para asentar la venta. */
export type CuentasVentaOverride = Partial<Record<keyof typeof CUENTAS_VENTA, { codigo: string; nombre: string }>>;

export interface DatosAsientoVenta {
  /** Base de las operaciones gravadas (sin IGV). */
  gravado: number;
  igv: number;
  exonerado: number;
  inafecto: number;
  /** Importe del ICBPER informado en las líneas de bolsa. */
  icbper: number;
  /** Importe de la detracción, ya en soles enteros. */
  detraccion: number;
  /** Importe de la retención del IGV practicada por el cliente. */
  retencion: number;
  /** Total del comprobante (base + IGV + ICBPER). */
  total: number;
  /** Descuentos 01/03 que no reducen la base del IGV. */
  descuentoNoAfecto?: number;
  /** Descuento 01/03 que no reduce la base del IGV. */
  descuento?: number;
  /** Cuentas configuradas por el mapeador contable. */
  cuentas?: CuentasVentaOverride;
}

/** Redondea a céntimos sin arrastrar error de coma flotante. */


/** Línea de asiento ya construida, sin el orden. */
type LineaSinOrden = Omit<AccountingLineDto, 'lineOrder'>;

/** Crea una línea con su nombre de cuenta tomado de la tabla del PCGE. */
const linea = (
  cuenta: { codigo: string; nombre: string },
  debe: number,
  haber: number,
): LineaSinOrden => ({
  accountCode: cuenta.codigo,
  accountName: cuenta.nombre,
  debitAmount: r2(debe),
  creditAmount: r2(haber),
});

const cuenta = (
  datos: DatosAsientoVenta,
  key: keyof typeof CUENTAS_VENTA,
): { codigo: string; nombre: string } => datos.cuentas?.[key] ?? CUENTAS_VENTA[key];

/**
 * Construye las líneas del asiento de una venta.
 *
 * La suma de los haberes es el importe efectivamente cobrado (total menos lo
 * que se retiene y lo que se deposita por detracción); la suma de los debes es
 * ese mismo importe repartido entre la cuenta por cobrar y las dos cuentas
 * puente. Si no cuadra, el `DoubleEntryRule` del módulo de contabilidad lo
 * rechaza —y ahí está la garantía—, pero aquí se evita llegar a ese error.
 */
export const lineasAsientoVenta = (
  datos: DatosAsientoVenta,
): readonly AccountingLineDto[] => {
  const lineas: LineaSinOrden[] = [];

  const total = r2(datos.total);
  const detraccion = r2(datos.detraccion);
  const retencion = r2(datos.retencion);
  const icbper = r2(datos.icbper);
  const descuento = r2(datos.descuentoNoAfecto ?? datos.descuento ?? 0);

  // Cobro efectivo: lo que el cliente paga al proveedor.
  const porCobrar = r2(total - detraccion - retencion);

  if (porCobrar > 0) {
    lineas.push(linea(cuenta(datos, 'porCobrar'), porCobrar, 0));
  }
  if (descuento > 0) {
    lineas.push(linea(cuenta(datos, 'descuento'), descuento, 0));
  }
  // La detracción la deposita el cliente en el Banco de la Nación: sigue siendo
  // una cuenta por cobrar del proveedor, pero por otra vía.
  if (detraccion > 0) {
    lineas.push(linea(cuenta(datos, 'detraccion'), detraccion, 0));
  }
  // La retención la entera el cliente al fisco: es un saldo a favor suyo, no
  // dinero que vaya a llegar a la cuenta del proveedor.
  if (retencion > 0) {
    lineas.push(linea(cuenta(datos, 'porCobrarRetenido'), retencion, 0));
  }

  // Bases y tributos del haber.
  if (datos.gravado > 0) {
    lineas.push(linea(cuenta(datos, 'gravada'), 0, datos.gravado));
  }
  if (datos.exonerado > 0) {
    lineas.push(linea(cuenta(datos, 'exonerada'), 0, datos.exonerado));
  }
  if (datos.inafecto > 0) {
    lineas.push(linea(cuenta(datos, 'inafecta'), 0, datos.inafecto));
  }
  if (datos.igv > 0) {
    lineas.push(linea(cuenta(datos, 'igv'), 0, datos.igv));
  }
  if (icbper > 0) {
    lineas.push(linea(cuenta(datos, 'icbper'), 0, icbper));
  }

  // El orden es el de presentación contable: primero los cargos y después los
  // abonos, que es como se lee un asiento.
  return lineas.map((l, index) => ({ ...l, lineOrder: index + 1 }));
};

/**
 * Asiento de una Nota de Crédito (07): invierte la venta original.
 *
 * Una NC reduce el crédito fiscal del cliente y la cuenta por cobrar del
 * emisor. Se obtiene invirtiendo debe/haber del asiento de venta, para que
 * ambas caras usen exactamente las mismas cuentas e importes.
 */
export const lineasAsientoNotaCredito = (
  datos: DatosAsientoVenta,
): readonly AccountingLineDto[] =>
  lineasAsientoVenta(datos).map((linea, index) => ({
    ...linea,
    debitAmount: linea.creditAmount,
    creditAmount: linea.debitAmount,
    lineOrder: index + 1,
  }));

/** Balance del asiento, para verificar antes de persistir. */
export const balanceAsiento = (
  lineas: readonly AccountingLineDto[],
): { debe: number; haber: number; cuadra: boolean } => {
  const debe = r2(lineas.reduce((acc, l) => acc + l.debitAmount, 0));
  const haber = r2(lineas.reduce((acc, l) => acc + l.creditAmount, 0));
  return { debe, haber, cuadra: Math.round(debe * 100) === Math.round(haber * 100) };
};

/** Periodo contable YYYY-MM a partir de una fecha ISO YYYY-MM-DD. */
export const periodoDe = (fecha: string): string => {
  const iso = fecha.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(iso) ? iso : fechaFiscalLima().slice(0, 7);
};
