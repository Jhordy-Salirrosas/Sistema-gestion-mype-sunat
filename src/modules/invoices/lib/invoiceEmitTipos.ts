/**
 * Correspondencia entre las opciones del menú de emisión y el Catálogo 01.
 *
 * Vive en su propio módulo para no mezclar constantes con componentes y no
 * romper la regla `react-refresh/only-export-components`.
 */
import type { TipoEmision } from '../components/InvoiceEmitMenu';

/** Mapea la opción del menú al tipo de comprobante del Catálogo 01. */
export const TIPO_POR_OPCION: Record<TipoEmision, '01' | '03' | '07'> = {
  Factura: '01',
  Boleta: '03',
  Nota: '07',
};
