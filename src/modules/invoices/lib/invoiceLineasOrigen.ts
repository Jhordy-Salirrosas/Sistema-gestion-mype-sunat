import type { LineaOrigen } from '../types/invoice.types';
import type { AfectacionIgv } from './invoiceTaxes';
import { unidadValida, type ItemBorrador } from './invoiceItems';
import { nuevaClave } from './invoiceEmitDraft';

const AFECTACION: Record<string, AfectacionIgv> = { '10': 'GRAVADA', '20': 'EXONERADA', '30': 'INAFECTA', '11': 'GRATUITA' };

/** null indica datos que la grilla no puede representar sin inventar o alterar valores. */
export function lineasParaNota(lineas: readonly LineaOrigen[]): ItemBorrador[] | null {
  const resultado: ItemBorrador[] = [];
  for (const linea of lineas) {
    const afectacion = linea.afectacion && AFECTACION[linea.afectacion];
    const descuentos = linea.descuentos ?? [];
    if (!linea.descripcion || !linea.unidad || !unidadValida(linea.unidad) ||
        !afectacion || typeof linea.cantidad !== 'number' || !Number.isFinite(linea.cantidad) || linea.cantidad <= 0 ||
        typeof linea.valor_unitario !== 'number' || !Number.isFinite(linea.valor_unitario) || linea.valor_unitario < 0 ||
        descuentos.length > 1 || descuentos.some((d) => (d.codigo !== '00' && d.codigo !== '01') || typeof d.monto !== 'number' || !Number.isFinite(d.monto) || d.monto < 0) ||
        (linea.icbper != null && (!Number.isFinite(linea.icbper) || linea.icbper < 0))) return null;
    const d = descuentos[0];
    resultado.push({ clave: nuevaClave(), codigo: linea.codigo ?? '', descripcion: linea.descripcion,
      unidad: linea.unidad, cantidad: linea.cantidad, valorUnitario: linea.valor_unitario,
      afectacion, icbper: linea.icbper ?? 0,
      descuento: d ? { codigo: d.codigo as '00' | '01', monto: d.monto! } : null });
  }
  return resultado;
}
