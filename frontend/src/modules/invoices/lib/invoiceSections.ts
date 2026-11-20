import type { ComprobanteDemo } from '../data/invoiceDemoSchema';

/** Identificación por ruta y agrupación de documentos; sin navegación visual. */
export type InvoiceSectionId = 'comprobantes' | 'notas' | 'bajas' | 'monitor';

export const INVOICE_SECTION_ROUTES: Record<InvoiceSectionId, string> = {
  comprobantes: '/invoices/facturas',
  notas: '/invoices/notas',
  bajas: '/invoices/bajas',
  monitor: '/invoices/monitor',
};

export const INVOICE_SECTION_TYPES: Record<InvoiceSectionId, readonly ComprobanteDemo['tipo'][]> = {
  comprobantes: ['01', '03'],
  notas: ['07', '08'],
  bajas: ['RA', 'RC'],
  monitor: [],
};

export function sectionFromPath(pathname: string): InvoiceSectionId {
  return (Object.entries(INVOICE_SECTION_ROUTES).find(([, ruta]) => ruta === pathname)?.[0] as InvoiceSectionId | undefined) ?? 'comprobantes';
}
