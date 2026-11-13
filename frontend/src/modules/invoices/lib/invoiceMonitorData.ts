import { invoicesApi, type FiltrosInvoices } from '../services/invoicesApi';
/** La membresía DLQ es volátil: el Monitor consulta la red y todas las páginas. */
export async function cargarPaginasMonitor(filtros: FiltrosInvoices) {
  const primera = await invoicesApi.getInvoices(1, filtros, true);
  const restantes = await Promise.all(Array.from({ length: Math.max(0, primera.totalPages - 1) }, (_, i) => invoicesApi.getInvoices(i + 2, filtros, true)));
  return [...primera.data, ...restantes.flatMap(p => p.data)];
}
