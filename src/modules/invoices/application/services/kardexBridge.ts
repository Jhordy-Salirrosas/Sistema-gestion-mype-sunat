import { Prisma } from '../../../../generated/client/client';
/**
 * Movimientos de Kardex que genera una factura emitida (TA-68).
 *
 * Una factura de venta produce una SALIDA de inventario por cada línea que
 * corresponde a un producto del almacén. Las líneas que no son inventariables
 * (servicios, o un código que no coincide con ningún SKU) NO generan movimiento:
 * inventar una salida de un producto que no existe descuadraría el Kardex y
 * rompería la conciliación con el PLE 12.1.
 *
 * La traducción es pura: recibe las líneas y devuelve los movimientos a
 * registrar. La persistencia la hace `RegisterManualMovementUseCase`, que ya
 * aplica el promedio ponderado móvil y actualiza el saldo.
 */
import type { RegisterManualMovementDto } from '../../../inventory/application/dto/registerManualMovementDto';

/** Tabla 12 de SUNAT: la operación es una venta nacional. */
export const OPERACION_VENTA = '01';

/** Tabla 12 de SUNAT: devolución de mercaderías (por Nota de Crédito). */
export const OPERACION_DEVOLUCION_VENTA = '05';

/** Línea de comprobante con lo necesario para un movimiento de almacén. */
export interface LineaParaKardex {
  /** Código del producto; se cruza con el SKU del inventario. */
  itemCode?: string;
  descripcion: string;
  /** Unidad del Catálogo 03. */
  unidad: string;
  cantidad: number;
  /** Valor unitario sin IGV; el Kardex se lleva sin impuestos. */
  valorUnitario: number;
  afectacion: string;
}

/** Datos de la factura o nota que acompañan al movimiento. */
export interface DocumentoKardex {
  tipoComprobante: string;
  serie: string;
  correlativo: number;
  fechaEmision: string;
  /** Código del almacén; si falta se usa el por defecto (ALM-01). */
  almacen?: string;
  /** Código de motivo SUNAT Catálogo 09 para Notas de Crédito. */
  motivoNota?: string;
}

/**
 * Líneas que NO deben generar salida de almacén.
 *
 * Las gratuitas (11-16, 21, 31-36) sí sacan mercadería físicamente, pero hoy el
 * sistema no puede valuarlas sin costo de referencia, así que se excluyen
 * explícitamente y se documenta el hueco en lugar de mover stock a cero. Las de
 * exportación y las inafectas sí se mueven: son mercadería real.
 */
export const AFECTACIONES_SIN_MOVIMIENTO: readonly string[] = [
  '11', '12', '13', '14', '15', '16',
  '21', '31', '32', '33', '34', '35', '36', '37',
];

/** ¿La línea debe generar un movimiento de inventario? */
export const generaMovimiento = (linea: LineaParaKardex): boolean => {
  if (!linea.itemCode?.trim()) return false;
  if (!(linea.cantidad > 0)) return false;
  return !AFECTACIONES_SIN_MOVIMIENTO.includes(linea.afectacion);
};

/**
 * Convierte las líneas del comprobante (Factura, Boleta o Nota de Crédito) en
 * movimientos de Kardex pendientes.
 *
 * Conforme al Plan Maestro § 9.2:
 *  - Factura / Boleta (01, 03): SALIDA de almacén (Operación 01 - Venta).
 *  - Nota de Crédito (07) con motivos 01 (Anulación), 06 (Devolución total) o
 *    07 (Devolución por ítem): ENTRADA a almacén (Operación 05 - Devolución).
 *  - Nota de Crédito con motivos de ajuste/descuento (03, 04, 05, 09, 13):
 *    no mueve existencias físicas, solo ajuste contable.
 */
export const movimientosDeFactura = (
  lineas: readonly LineaParaKardex[],
  documento: DocumentoKardex,
): readonly RegisterManualMovementDto[] => {
  const porSku = new Map<string, LineaParaKardex>();
  for (const linea of lineas.filter(generaMovimiento)) {
    const sku = linea.itemCode!.trim();
    const anterior = porSku.get(sku);
    porSku.set(sku, anterior ? { ...anterior,
      cantidad: new Prisma.Decimal(anterior.cantidad).plus(linea.cantidad).toNumber(),
    } : { ...linea, itemCode: sku });
  }
  const agrupadas = [...porSku.values()];
  const numeroDocumento = `${documento.serie}-${String(documento.correlativo).padStart(8, '0')}`;
  const esNotaCredito = documento.tipoComprobante === '07';

  // Si es Nota de Crédito, evaluar el motivo del Catálogo 09
  if (esNotaCredito) {
    const motivosDevolucion = ['01', '06', '07'];
    if (!documento.motivoNota || !motivosDevolucion.includes(documento.motivoNota)) {
      // Motivos puramente económicos (descuento, corrección) no mueven mercadería física
      return [];
    }

    return agrupadas.map((linea) => ({
      warehouse_code: documento.almacen,
      sku: linea.itemCode!.trim(),
      direction: 'ENTRADA' as const,
      operation_type_code: OPERACION_DEVOLUCION_VENTA,
      quantity: linea.cantidad,
      unit_cost: linea.valorUnitario,
      document_type_code: documento.tipoComprobante,
      document_serial: documento.serie,
      document_number: numeroDocumento,
      movement_date: documento.fechaEmision,
      source_reference_id: numeroDocumento,
      notes: `Devolución según Nota de Crédito ${numeroDocumento} (Motivo ${documento.motivoNota}) - ${linea.descripcion}`,
    }));
  }

  // Factura o Boleta estándar: Venta nacional (Salida)
  return agrupadas.map((linea) => ({
    warehouse_code: documento.almacen,
    sku: linea.itemCode!.trim(),
    direction: 'SALIDA' as const,
    operation_type_code: OPERACION_VENTA,
    quantity: linea.cantidad,
    unit_cost: linea.valorUnitario,
    document_type_code: documento.tipoComprobante,
    document_serial: documento.serie,
    document_number: numeroDocumento,
    movement_date: documento.fechaEmision,
    source_reference_id: numeroDocumento,
    notes: `Venta según ${numeroDocumento} - ${linea.descripcion}`,
  }));
};
