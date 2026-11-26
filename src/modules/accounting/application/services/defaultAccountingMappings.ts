/**
 * Cuentas PCGE por defecto para las operaciones contables de la empresa.
 *
 * Esta tabla es la base común de Ventas, Compras, SIRE e Importaciones. Las
 * empresas pueden sobrescribir cualquier rol en `accounting_mappings`; las
 * reglas históricas por proceso se aplican después como overrides del módulo.
 */
export type AccountingOperation =
  | 'VENTA'
  | 'COMPRA'
  | 'IMPORTACION'
  | 'SIRE_VENTAS'
  | 'SIRE_COMPRAS'
  | 'GASTO'
  | 'PAGO'
  | 'COBRO';

export type AccountingDirection = 'SALIDA' | 'ENTRADA';

export type AccountingRole =
  | 'CXC'
  | 'CXP'
  | 'IGV'
  | 'INGRESO'
  | 'COMPRA'
  | 'VENTA_EXONERADA'
  | 'VENTA_INAFECTA'
  | 'ICBPER'
  | 'DETRACCION'
  | 'RETENCION'
  | 'DESCUENTO'
  | 'COSTO_VENTA'
  | 'INVENTARIO'
  | 'GASTO'
  | 'BANCOS'
  | 'CAJA'
  | 'FOB_EXTERIOR'
  | 'FLETE_INT'
  | 'SEGURO_INT'
  | 'AD_VALOREM'
  | 'TDA'
  | 'AGENCIA_ADUANA'
  | 'IGV_IMPORTACION'
  | 'PERCEPCION_IGV'
  | 'CXP_EXTERIOR'
  | 'CXP_LOCAL'
  | 'TRANSITO'
  | 'VARIACION_EXISTENCIAS'
  | 'ALMACEN_FINAL'
  | 'VENTAS'
  | 'COMPRAS'
  | 'BASE_VENTAS'
  | 'BASE_COMPRAS'
  | 'BASE';

export interface DefaultAccount {
  code: string;
  name: string;
}

export const ACCOUNT_NAMES: Readonly<Record<string, string>> = {
  '12121': 'Facturas, boletas y otros comprobantes por cobrar, emitidas',
  '12129': 'Cuentas por cobrar - detracciones',
  '40111': 'IGV - Cuenta propia',
  '40113': 'IGV - Régimen de percepciones',
  '40114': 'IGV - Retenciones',
  '70121': 'Ventas gravadas',
  '70321': 'Ventas exoneradas del IGV',
  '70521': 'Ventas inafectas del IGV',
  '74111': 'Impuesto a las bolsas plásticas por pagar',
  '74': 'Descuentos, rebajas y bonificaciones concedidas',
  '69111': 'Costo de ventas',
  '20111': 'Mercaderías manufacturadas al costo',
  '60111': 'Compras de mercaderías',
  '6011': 'Mercaderías manufacturadas',
  '60911': 'Transporte y flete internacional',
  '60912': 'Seguro de transporte internacional',
  '60913': 'Derechos arancelarios (Ad Valorem)',
  '60914': 'Servicios de despacho y agenciamiento',
  '60915': 'Tasa por servicio de despacho',
  '42121': 'Facturas por pagar - Emitidas en el país',
  '42122': 'Facturas por pagar - Emitidas en el exterior',
  '63111': 'Gastos de servicios',
  '1041': 'Cuentas corrientes operativas',
  '1011': 'Caja',
  '2811': 'Mercaderías en tránsito',
  '6111': 'Variación de existencias',
  '121': 'Cuentas por cobrar comerciales - terceros',
  '421': 'Cuentas por pagar comerciales - terceros',
  '701': 'Ventas de mercaderías',
};

const account = (code: string): DefaultAccount => ({
  code,
  name: ACCOUNT_NAMES[code] ?? `Cuenta contable ${code}`,
});

/** Matriz global por defecto. No reemplaza mapeos existentes. */
export const DEFAULT_ACCOUNTING_MAPPINGS: Readonly<
  Record<AccountingOperation, Readonly<Record<string, DefaultAccount>>>
> = {
  VENTA: {
    CXC: account('12121'),
    IGV: account('40111'),
    INGRESO: account('70121'),
    VENTA_EXONERADA: account('70321'),
    VENTA_INAFECTA: account('70521'),
    ICBPER: account('74111'),
    DETRACCION: account('12129'),
    RETENCION: account('40114'),
    DESCUENTO: account('74'),
    COSTO_VENTA: account('69111'),
    INVENTARIO: account('20111'),
  },
  COMPRA: {
    COMPRA: account('60111'),
    IGV: account('40111'),
    CXP: account('42121'),
    INVENTARIO: account('20111'),
  },
  IMPORTACION: {
    FOB_EXTERIOR: account('6011'),
    FLETE_INT: account('60911'),
    SEGURO_INT: account('60912'),
    AD_VALOREM: account('60913'),
    TDA: account('60915'),
    AGENCIA_ADUANA: account('60914'),
    IGV_IMPORTACION: account('40111'),
    PERCEPCION_IGV: account('40113'),
    CXP_EXTERIOR: account('42122'),
    CXP_LOCAL: account('42121'),
    BANCOS: account('1041'),
    TRANSITO: account('2811'),
    VARIACION_EXISTENCIAS: account('6111'),
    ALMACEN_FINAL: account('20111'),
  },
  SIRE_VENTAS: {
    CXC: account('121'),
    VENTAS: account('121'),
    IGV: account('40111'),
    INGRESO: account('701'),
    BASE_VENTAS: account('701'),
    BASE: account('701'),
  },
  SIRE_COMPRAS: {
    CXP: account('421'),
    COMPRAS: account('421'),
    IGV: account('40111'),
    COMPRA: account('6011'),
    BASE_COMPRAS: account('6011'),
    BASE: account('6011'),
  },
  GASTO: {
    GASTO: account('63111'),
    IGV: account('40111'),
    CXP: account('42121'),
  },
  PAGO: {
    CXP: account('42121'),
    BANCOS: account('1041'),
    CAJA: account('1011'),
  },
  COBRO: {
    BANCOS: account('1041'),
    CAJA: account('1011'),
    CXC: account('12121'),
  },
};

export const DEFAULT_DIRECTION: Readonly<Record<AccountingOperation, AccountingDirection>> = {
  VENTA: 'SALIDA',
  SIRE_VENTAS: 'SALIDA',
  COBRO: 'ENTRADA',
  COMPRA: 'ENTRADA',
  IMPORTACION: 'ENTRADA',
  SIRE_COMPRAS: 'ENTRADA',
  GASTO: 'ENTRADA',
  PAGO: 'SALIDA',
};

/** Orden histórico de las reglas por proceso, para heredar sus overrides. */
export const RULE_ORDER_ROLES: Readonly<Record<AccountingOperation, readonly string[]>> = {
  VENTA: ['CXC', 'IGV', 'INGRESO', 'VENTA_EXONERADA', 'VENTA_INAFECTA', 'ICBPER', 'DETRACCION', 'RETENCION', 'DESCUENTO', 'COSTO_VENTA', 'INVENTARIO'],
  COMPRA: ['COMPRA', 'IGV', 'CXP'],
  IMPORTACION: [],
  SIRE_VENTAS: [],
  SIRE_COMPRAS: [],
  GASTO: ['GASTO', 'IGV', 'CXP'],
  PAGO: ['CXP', 'BANCOS'],
  COBRO: ['BANCOS', 'CXC'],
};

export const OPERATION_ALIASES: Readonly<Record<string, AccountingOperation>> = {
  VENTA: 'VENTA',
  VENTAS: 'VENTA',
  COMPRA: 'COMPRA',
  COMPRAS: 'COMPRA',
  IMPORTACION: 'IMPORTACION',
  IMPORTACIONES: 'IMPORTACION',
  SIRE_VENTAS: 'SIRE_VENTAS',
  SIRE_COMPRAS: 'SIRE_COMPRAS',
  GASTO: 'GASTO',
  PAGO: 'PAGO',
  COBRO: 'COBRO',
};

export function normalizeAccountingOperation(value: string): AccountingOperation {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');
  return OPERATION_ALIASES[normalized] ?? 'VENTA';
}
