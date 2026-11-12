import { esAfectacionGratuita } from './sunatCatalogsQuery';

/** Evidencia completa de gratuidad declarada, compartida por creación y stock. */
export function esLineaGratuitaValida(linea: unknown): boolean {
  if (!linea || typeof linea !== 'object') return false;
  const l = linea as { afectacion?: unknown; cantidad?: number; valorUnitario?: number; precioUnitario?: number };
  return typeof l.afectacion === 'string' && esAfectacionGratuita(l.afectacion) &&
    typeof l.cantidad === 'number' && Number.isFinite(l.cantidad) && l.cantidad > 0 &&
    typeof l.valorUnitario === 'number' && Number.isFinite(l.valorUnitario) && l.valorUnitario > 0 && l.precioUnitario === 0;
}

/** El cero fiscal solo se admite con evidencia completa de gratuidad por línea. */
export function esDocumentoIntegramenteGratuito(tipo: string, lineas: unknown): boolean {
  return ['01', '03'].includes(tipo) && Array.isArray(lineas) && lineas.length > 0 && lineas.every(esLineaGratuitaValida);
}
