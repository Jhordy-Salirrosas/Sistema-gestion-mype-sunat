import { esCodigoGratuito, validarItems, type ItemBorrador } from './invoiceItems';
import { liquidarDescuentoGlobal, type DescuentoGlobal } from './invoiceDescuentoGlobal';

/** Misma excepción de creación fiscal: solo 01/03 íntegramente gratuitas válidas. */
export function esDocumentoIntegramenteGratuito(tipo: string, items: readonly ItemBorrador[]): boolean {
  return ['01', '03'].includes(tipo) && items.length > 0 && items.every(item =>
    item.afectacion === 'GRATUITA' && esCodigoGratuito(item.codigoAfectacion) &&
    Number.isFinite(item.cantidad) && item.cantidad > 0 &&
    Number.isFinite(item.valorUnitario) && item.valorUnitario > 0 && item.precioUnitario === 0,
  );
}

/** Validación común anterior al POST de página, modal y notas. */
export function problemasContenidoEmision(input: {
  tipo: string; clienteRazonSocial: string; items: readonly ItemBorrador[];
  descuentoGlobal?: DescuentoGlobal | null;
}): string[] {
  const errores: string[] = [];
  if (!input.clienteRazonSocial.trim()) errores.push('Falta la razón social del cliente.');
  if (Array.from(input.clienteRazonSocial).length > 1500) errores.push('La razón social del cliente admite como máximo 1500 caracteres.');
  for (const error of validarItems(input.items)) {
    errores.push(...error.motivos.map(m => `${error.indice >= 0 ? `Línea ${error.indice + 1}` : 'Detalle'}: ${m}`));
  }
  const nota = ['07', '08'].includes(input.tipo);
  input.items.forEach((item, i) => {
    if (item.afectacion === 'GRATUITA') return;
    const precio = item.precioUnitario ?? item.valorUnitario;
    if ((!nota && !(item.valorUnitario > 0)) || !Number.isFinite(precio) || !(precio > 0)) {
      errores.push(`Línea ${i + 1}: el valor y el precio de una línea onerosa deben ser mayores que cero.`);
    }
  });
  const liquidacion = liquidarDescuentoGlobal(input.items, input.descuentoGlobal);
  if (liquidacion.error) errores.push(liquidacion.error);
  if (!nota && !(liquidacion.total > 0) && !esDocumentoIntegramenteGratuito(input.tipo, input.items)) {
    errores.push('El total cero solo se admite en documentos íntegramente gratuitos con referencias positivas.');
  }
  return errores;
}
