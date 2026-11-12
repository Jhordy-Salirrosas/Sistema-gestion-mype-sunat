/** Presentación compatible con números completos y correlativos sueltos. */
export function formatearReferenciaDocumento(serie?: string | null, numero?: string | null): string {
  const valor = numero ?? '';
  if (!serie || valor.startsWith(`${serie}-`) || valor.includes('-')) return valor;
  return `${serie}-${valor}`;
}
export function numeroDocumentoSinSerie(serie?: string | null, numero?: string | null): string {
  const valor = numero ?? '';
  const prefijo = serie ? `${serie}-` : '';
  return prefijo && valor.startsWith(prefijo) ? valor.slice(prefijo.length) : valor;
}
