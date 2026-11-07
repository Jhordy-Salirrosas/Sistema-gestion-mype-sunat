/**
 * Navegación por los apartados oficiales del módulo de Facturación (M1).
 *
 * Pestañas accesibles (Radix Tabs) con badge de conteo por apartado:
 *  1. Facturas y Boletas (01 y 03).
 *  2. Bajas y Resúmenes Diarios (RA y RC).
 *  3. Monitor Outbox y Auditoría CDR.
 */
import { Badge, TabsList, TabsTrigger } from '@/components/ui';
import type { ComprobanteDemo } from '../data/invoiceDemoSchema';

/** Identificadores de los cuatro apartados. */
export type InvoiceTabId =
  | 'comprobantes'
  | 'notas'
  | 'bajas'
  | 'monitor';

/** Ruta del menú lateral asociada a cada apartado. */
export const RUTA_POR_TAB: Record<InvoiceTabId, string> = {
  comprobantes: '/invoices/facturas',
  notas: '/invoices/notas',
  bajas: '/invoices/bajas',
  monitor: '/invoices/monitor',
};

/**
 * Traduce el tramo final de la URL a su apartado.
 *
 * `/invoices` sin sufijo abre la pestaña de facturas y boletas.
 */
export const tabDesdeRuta = (pathname: string): InvoiceTabId => {
  const entrada = Object.entries(RUTA_POR_TAB).find(
    ([, ruta]) => ruta === pathname,
  );
  return (entrada?.[0] as InvoiceTabId) ?? 'comprobantes';
};

/** Definición de cada apartado y sus tipos de comprobante. */
export const INVOICE_TABS: ReadonlyArray<{
  id: InvoiceTabId;
  label: string;
  tipos: ReadonlyArray<ComprobanteDemo['tipo']>;
}> = [
  {
    id: 'comprobantes',
    label: 'Facturas y Boletas',
    tipos: ['01', '03'],
  },
  {
    id: 'notas',
    label: 'Notas',
    tipos: ['07', '08'],
  },
  {
    id: 'bajas',
    label: 'Bajas y Resúmenes Diarios',
    tipos: ['RA', 'RC'],
  },
  {
    id: 'monitor',
    label: 'Monitor Outbox y Auditoría CDR',
    tipos: [],
  },
];

/** Cuenta los comprobantes que pertenecen a cada apartado. */
export const contarPorTab = (
  comprobantes: readonly ComprobanteDemo[],
): Record<InvoiceTabId, number> => {
  const conteo = {} as Record<InvoiceTabId, number>;

  INVOICE_TABS.forEach((tab) => {
    conteo[tab.id] =
      tab.id === 'monitor'
        ? comprobantes.length
        : comprobantes.filter((c) => tab.tipos.includes(c.tipo)).length;
  });

  return conteo;
};

interface InvoiceTabsNavProps {
  conteo: Record<InvoiceTabId, number>;
}

/** Lista de pestañas con su badge de conteo. */
export const InvoiceTabsNav = ({ conteo }: InvoiceTabsNavProps) => {
  return (
    <TabsList aria-label="Apartados del módulo de facturación">
      {/* Notas conserva su ruta y contenido desde el menú lateral. */}
      {INVOICE_TABS.filter((tab) => tab.id !== 'notas').map((tab) => (
        <TabsTrigger key={tab.id} value={tab.id}>
          {tab.label}
          <Badge variant="secondary" className="ml-1.5 text-[10px]">
            {conteo[tab.id]}
          </Badge>
        </TabsTrigger>
      ))}
    </TabsList>
  );
};
