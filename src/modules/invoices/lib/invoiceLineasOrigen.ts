import type { LineaOrigen } from '../types/invoice.types';
import { normalizarAfectacionProducto, unidadValida, type ItemBorrador } from './invoiceItems';
import { nuevaClave } from './invoiceEmitDraft';

/** null indica datos que la grilla no puede representar sin inventar o alterar valores. */
export function lineasParaNota(lineas: readonly LineaOrigen[]): ItemBorrador[] | null {
  const resultado: ItemBorrador[] = [];
  for (const linea of lineas) {
    if (!linea.afectacion) return null;
    let afectacion;
    try { afectacion = normalizarAfectacionProducto(linea.afectacion); } catch { return null; }
    const descuentos = linea.descuentos ?? [];
    if (!linea.descripcion || !linea.unidad || !unidadValida(linea.unidad) ||
        !afectacion || typeof linea.cantidad !== 'number' || !Number.isFinite(linea.cantidad) || linea.cantidad <= 0 ||
        typeof linea.valor_unitario !== 'number' || !Number.isFinite(linea.valor_unitario) || linea.valor_unitario < 0 ||
        typeof linea.precio_unitario !== 'number' || !Number.isFinite(linea.precio_unitario) || linea.precio_unitario < 0 ||
        descuentos.length > 1 || descuentos.some((d) => (d.codigo !== '00' && d.codigo !== '01') || typeof d.monto !== 'number' || !Number.isFinite(d.monto) || d.monto < 0) ||
        (linea.icbper != null && (!Number.isFinite(linea.icbper) || linea.icbper < 0))) return null;
    const d = descuentos[0];
    resultado.push({ clave: nuevaClave(), codigo: linea.codigo ?? '', descripcion: linea.descripcion,
      unidad: linea.unidad, cantidad: linea.cantidad, valorUnitario: linea.valor_unitario,
      precioUnitario: linea.precio_unitario, codigoAfectacion: linea.afectacion, afectacionHeredada: true, unidadHeredada: true,
      afectacion, icbper: linea.icbper ?? 0,
      descuento: d ? { codigo: d.codigo as '00' | '01', monto: d.monto! } : null });
  }
  return resultado;
}
