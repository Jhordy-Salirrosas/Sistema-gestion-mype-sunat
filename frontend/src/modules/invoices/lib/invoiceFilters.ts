import { clasificarBandeja } from './invoiceBandejaState';
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

const normalizar = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Aplica búsqueda, estado de presentación y rango de fechas. */
export const aplicarFiltros = (
  comprobantes: readonly ComprobanteDemo[],
  filtros: InvoiceFiltros,
): ComprobanteDemo[] => {
  const termino = normalizar(filtros.busqueda.trim());

  return comprobantes.filter((c) => {
    const documento = `${c.serie}-${c.correlativo}`;
    const terminoNumero = termino.replace(/^(\w+)-0*(\d+)$/, '$1-$2');
    const correlativoNumerico = /^\d+$/.test(termino)
      ? termino.replace(/^0+(?=\d)/, '')
      : null;
    const coincideTexto = /^\d{1,8}$/.test(termino)
      ? String(c.correlativo) === correlativoNumerico || (termino.length===8 && c.clienteRuc===termino)
      : !termino || normalizar(`${documento} ${c.clienteRuc} ${c.clienteRazonSocial}`).includes(termino) || normalizar(documento).includes(terminoNumero);
    const coincideEstado = filtros.estado === 'TODOS' || clasificarBandeja(c) === filtros.estado;

    const coincideDesde = !filtros.desde || c.fechaEmision >= filtros.desde;
    const coincideHasta = !filtros.hasta || c.fechaEmision <= filtros.hasta;

    return coincideTexto && coincideEstado && coincideDesde && coincideHasta;
  });
};
