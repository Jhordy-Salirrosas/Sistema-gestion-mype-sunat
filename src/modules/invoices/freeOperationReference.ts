import { multiplicarMoneda, redondearMoneda } from './money';
import { esAfectacionGratuita, tributoDeAfectacion } from './sunatCatalogsQuery';
import type { LineaDetalle } from './xmlNodesHelper';

/** Referencia no onerosa: se declara, pero no incrementa el importe por cobrar. */
export function referenciaGratuita(linea: LineaDetalle) {
  const base = multiplicarMoneda(linea.cantidad, linea.valorUnitario);
  return { base, igv: tributoDeAfectacion(linea.afectacion) === '1000' ? multiplicarMoneda(base, 0.18) : 0 };
}
export function totalesGratuitos(lineas: LineaDetalle[]) {
  const referencias = lineas.filter(l => esAfectacionGratuita(l.afectacion)).map(referenciaGratuita);
  return { gratuito: redondearMoneda(referencias.reduce((s, r) => s + r.base, 0)),
    igvGratuito: redondearMoneda(referencias.reduce((s, r) => s + r.igv, 0)) };
}
