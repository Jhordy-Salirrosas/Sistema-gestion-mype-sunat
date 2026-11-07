/**
 * Ítem de detalle por defecto de un comprobante de demostración.
 *
 * Se aísla de `invoiceDemoTypes.ts` para mantener la fábrica por debajo del
 * límite de líneas.
 */
import { round2, type AfectacionIgv } from '../lib/invoiceCalculations';
import type { ItemDemo } from './invoiceDemoTypes';

/** Genera un único ítem a partir de la base y la serie del comprobante. */
export const itemsPorDefecto = (
  serie: string,
  correlativo: number,
  base: number,
  afectacion: AfectacionIgv,
): readonly ItemDemo[] => [
  {
    codigo: `ITM-${correlativo}`,
    descripcion: `Servicio de confección ${serie}-${correlativo}`,
    unidad: 'NIU',
    cantidad: 1,
    valorUnitario: round2(base),
    afectacion,
  },
];
