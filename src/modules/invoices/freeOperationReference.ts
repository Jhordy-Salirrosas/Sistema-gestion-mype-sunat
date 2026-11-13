import { multiplicarMoneda, redondearMoneda } from './money';
import { esAfectacionGratuita, tributoDeAfectacion } from './sunatCatalogsQuery';
import type { LineaDetalle } from './xmlNodesHelper';

type Referencia = { base: number; igv: number };
// Metadato exclusivo del XML: un JSON recibido o persistido no puede introducir este símbolo.
const REFERENCIA_XML = Symbol('referenciaGratuitaXml');
type LineaXml = LineaDetalle & { [REFERENCIA_XML]?: Referencia };

/** Conserva el residuo de redondeo en la partición, sin cambiar el valor unitario. */
export const conReferenciaGratuitaXml = (linea: LineaDetalle, referencia: Referencia): LineaXml =>
  ({ ...linea, [REFERENCIA_XML]: referencia });

/** Referencia no onerosa: se declara, pero no incrementa el importe por cobrar. */
export function referenciaGratuita(linea: LineaDetalle) {
  const referencia = (linea as LineaXml)[REFERENCIA_XML];
  if (referencia) return referencia;
  const base = multiplicarMoneda(linea.cantidad, linea.valorUnitario);
  return { base, igv: tributoDeAfectacion(linea.afectacion) === '1000' ? multiplicarMoneda(base, 0.18) : 0 };
}
export function totalesGratuitos(lineas: LineaDetalle[]) {
  const referencias = lineas.filter(l => esAfectacionGratuita(l.afectacion)).map(referenciaGratuita);
  return { gratuito: redondearMoneda(referencias.reduce((s, r) => s + r.base, 0)),
    igvGratuito: redondearMoneda(referencias.reduce((s, r) => s + r.igv, 0)) };
}
