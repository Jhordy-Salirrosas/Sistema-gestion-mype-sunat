/**
 * Filtrado del listado de comprobantes por apartado, búsqueda, estado y rango
 * de fechas. Se separa del componente para mantener el orquestador bajo el
 * límite de líneas y poder probarse de forma aislada.
 */
import type { ComprobanteDemo } from '../data/invoiceDemoSchema';
import {
  INVOICE_TABS,
  type InvoiceTabId,
} from '../components/InvoiceTabsNav';
import type { InvoiceFiltros } from '../components/InvoiceFiltersBar';

/** Devuelve los comprobantes que pertenecen al apartado activo. */
export const porApartado = (
  comprobantes: readonly ComprobanteDemo[],
  tab: InvoiceTabId,
): ComprobanteDemo[] => {
  const definicion = INVOICE_TABS.find((t) => t.id === tab);

  if (!definicion || tab === 'monitor') return [...comprobantes];

  return comprobantes.filter((c) => definicion.tipos.includes(c.tipo));
};

/** Aplica búsqueda, estado CDR y rango de fechas. */
export const aplicarFiltros = (
  comprobantes: readonly ComprobanteDemo[],
  filtros: InvoiceFiltros,
): ComprobanteDemo[] => {
  const termino = filtros.busqueda.trim().toLowerCase();

  return comprobantes.filter((c) => {
    const documento = `${c.serie}-${c.correlativo}`;
    const terminoNumero = termino.replace(/^(\w+)-0*(\d+)$/, '$1-$2');
    const correlativoNumerico = /^\d+$/.test(termino)
      ? termino.replace(/^0+(?=\d)/, '')
      : null;
    const coincideTexto =
      !termino ||
      `${documento} ${c.clienteRuc} ${c.clienteRazonSocial}`
        .toLowerCase()
        .includes(termino) || documento.toLowerCase().includes(terminoNumero) ||
      (correlativoNumerico !== null && String(c.correlativo) === correlativoNumerico);

    const coincideEstado =
      filtros.estado === 'TODOS' || c.estado === filtros.estado;

    const coincideDesde = !filtros.desde || c.fechaEmision >= filtros.desde;
    const coincideHasta = !filtros.hasta || c.fechaEmision <= filtros.hasta;

    return coincideTexto && coincideEstado && coincideDesde && coincideHasta;
  });
};
