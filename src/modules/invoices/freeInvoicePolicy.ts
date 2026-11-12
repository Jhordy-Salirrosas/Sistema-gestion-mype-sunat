import { esAfectacionGratuita } from './sunatCatalogsQuery';

/** El cero fiscal solo se admite con evidencia completa de gratuidad por línea. */
export function esDocumentoIntegramenteGratuito(tipo: string, lineas: unknown): boolean {
  return ['01', '03'].includes(tipo) && Array.isArray(lineas) && lineas.length > 0 && lineas.every(l =>
    l && typeof l.afectacion === 'string' && esAfectacionGratuita(l.afectacion) &&
    Number.isFinite(l.cantidad) && l.cantidad > 0 && Number.isFinite(l.valorUnitario) && l.valorUnitario > 0 && l.precioUnitario === 0);
}
