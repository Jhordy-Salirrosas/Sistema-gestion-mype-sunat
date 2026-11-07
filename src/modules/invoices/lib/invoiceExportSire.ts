/**
 * Exportación del reporte SIRE RVIE en formato CSV (M1).
 *
 * Genera la propuesta del Registro de Ventas e Ingresos Electrónico que el
 * contribuyente sube al Módulo 3 de SUNAT, con una fila por comprobante.
 */
import type { ComprobanteDemo } from '../data/invoiceDemoTypes';
import { identidadEmisora } from './invoiceExportConstants';

/** Encabezados del RVIE (Módulo 3 del SIRE). */
const COLUMNAS_RVIE = [
  'Periodo',
  'CAR_SUNAT',
  'Fecha_Emision',
  'Tipo_CPE',
  'Serie',
  'Correlativo',
  'Tipo_Doc_Cliente',
  'RUC_DNI_Cliente',
  'Razon_Social',
  'Moneda',
  'Base_Gravada',
  'IGV',
  'Detraccion',
  'Retencion',
  'Total_Neto',
  'Forma_Pago',
  'Estado_SUNAT',
  'Codigo_CDR',
  'Doc_Modificado',
] as const;

/** Escapa un campo CSV entrecomillándolo siempre. */
const campo = (valor: string | number): string =>
  `"${String(valor).replace(/"/g, '""')}"`;

/** Serializa un comprobante como fila del RVIE. */
const filaRvie = (c: ComprobanteDemo, carSunat: number): string => {
  const periodo = c.fechaEmision.slice(0, 7).replace('-', '');

  return [
    periodo,
    carSunat,
    c.fechaEmision,
    c.tipo,
    c.serie,
    c.correlativo,
    c.clienteTipoDoc,
    c.clienteRuc,
    c.clienteRazonSocial,
    c.moneda,
    c.baseImponible.toFixed(2),
    c.igv.toFixed(2),
    c.detraccion.toFixed(2),
    c.retencion.toFixed(2),
    c.totalNeto.toFixed(2),
    // La columna existe para informar; si el dato no se conoce se deja vacío en
    // vez de escribir "Contado" sobre una venta al crédito.
    c.formaPago ?? '',
    c.estado,
    c.cdrCodigo ?? '',
    c.documentoAfectado ?? '',
  ]
    .map(campo)
    .join(',');
};

/** Construye el contenido CSV del RVIE para el conjunto de comprobantes. */
export const construirCsvRvie = (
  comprobantes: readonly ComprobanteDemo[],
): string => {
  const encabezado = COLUMNAS_RVIE.map(campo).join(',');
  const filas = comprobantes.map((c, i) => filaRvie(c, i + 1));

  return [encabezado, ...filas].join('\r\n');
};

/** Nombre del archivo CSV según el periodo y el RUC del emisor. */
export const nombreArchivoRvie = (
  comprobantes: readonly ComprobanteDemo[],
): string => {
  const periodo = comprobantes[0]?.fechaEmision.slice(0, 7).replace('-', '');
  return `RVIE-${identidadEmisora().ruc}-${periodo ?? 'SIN-PERIODO'}.csv`;
};

/** Descarga el CSV del RVIE con MIME text/csv. */
export const exportarReporteSireCsv = (
  comprobantes: readonly ComprobanteDemo[],
): void => {
  const csv = construirCsvRvie(comprobantes);
  // BOM UTF-8 para que Excel muestre correctamente los acentos.
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivoRvie(comprobantes);
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
};
