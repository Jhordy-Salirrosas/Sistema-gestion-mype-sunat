const series: Record<string, RegExp> = {
  '01': /^(?:F|E)(?![CD])(?:[A-Z0-9]{3})$/,
  '03': /^(?:B[A-Z0-9]{3}|EB[A-Z0-9]{2})$/,
  '07': /^(?:FC|BC)[A-Z0-9]{2}$/,
  '08': /^(?:FD|BD)[A-Z0-9]{2}$/,
};
export function errorSerie(tipo: string, serie: string, inicial: string): string | undefined {
  if (!series[tipo]?.test(serie.trim().toUpperCase())) return 'La serie no corresponde al tipo de comprobante.';
  if (!inicial.trim() || !Number.isSafeInteger(Number(inicial)) || Number(inicial) < 0 || Number(inicial) > 99999999)
    return 'El último correlativo debe ser entero entre 0 y 99999999.';
}
export function errorConfiguracionFiscal(fiscal: Record<string, string>): string | undefined {
  for (const [campo, maximo] of [['domicilio_fiscal', 200], ['departamento_fiscal', 30], ['provincia_fiscal', 30], ['distrito_fiscal', 30]] as const) {
    if ((fiscal[campo] ?? '').length > maximo) return `${campo}: máximo ${maximo} caracteres.`;
  }
  for (const [campo, digitos] of [['ubigeo_fiscal', 6], ['local_anexo', 4]] as const) {
    const valor = fiscal[campo]?.trim();
    if (valor && !new RegExp(`^[0-9]{${digitos}}$`).test(valor)) return `${campo}: debe contener ${digitos} dígitos.`;
  }
}
