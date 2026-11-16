/** Las mismas cuentas de tesorería usadas por CollectionsService.
 * Los medios bancarios admiten mapeo específico COBRO_<MEDIO>; si no existe,
 * usan la primera regla COBRO de la empresa. No se inventan subcuentas PCGE.
 */
export function invoicePaymentAccount(forma: string | undefined, medio: string | undefined,
  reglas: readonly { line_order: number; account_code: string }[],
  mappings: readonly { role_code: string; account_code: string }[]) {
  if (forma !== 'Contado' || !medio) return undefined;
  const specific = mappings.find(m => m.role_code === `COBRO_${medio}`)?.account_code;
  const code = specific ?? (medio === 'EFECTIVO' ? '1011' : reglas.find(r => r.line_order === 1)?.account_code);
  if (!code || !/^10\d+$/.test(code)) throw new Error('Configure una cuenta de tesorería 10 para el medio de pago.');
  return { codigo: code, nombre: `Cobro ${medio}` };
}
