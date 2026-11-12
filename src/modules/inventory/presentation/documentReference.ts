/** Solo representación PLE: no modifica el número completo persistido. */
export function numeroDocumentoSinSerie(serie?: string | null, numero?: string | null): string {
  const valor = numero ?? '';
  const prefijo = serie ? `${serie}-` : '';
  return prefijo && valor.startsWith(prefijo) ? valor.slice(prefijo.length) : valor;
}
