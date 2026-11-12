import { fechaIsoValida } from './invoiceFecha';
export function errorRangoFechas(desde: string, hasta: string): string | undefined {
  if ((desde && !fechaIsoValida(desde)) || (hasta && !fechaIsoValida(hasta))) return 'Indique fechas válidas.';
  if (desde && hasta && desde > hasta) return 'La fecha Desde no puede ser posterior a Hasta.';
}
