import { roundDetraccion } from './invoiceRetentions';
import { round2 } from './invoiceTaxes';
/** Solo presentación bancaria; nunca usar para cuotas, payload o XML. */
export function pagoSegunDeposito(total: number, detraccion: number, retencion = 0) {
 const depositoBn = roundDetraccion(detraccion);
 return { depositoBn, pagoDirecto: round2(total - depositoBn - retencion) };
}
