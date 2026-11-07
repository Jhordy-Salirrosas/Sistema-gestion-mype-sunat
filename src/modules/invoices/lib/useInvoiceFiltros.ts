import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import type { InvoiceFiltros } from '../components/InvoiceFiltersBar';

const iniciales: InvoiceFiltros = { busqueda: '', estado: 'TODOS', desde: '', hasta: '' };
const clave = (tenant: string) => `m1:fechas:${tenant}`;

function cargar(tenant: string | null): InvoiceFiltros {
  if (!tenant) return { ...iniciales };
  try {
    const fechas = JSON.parse(sessionStorage.getItem(clave(tenant)) ?? '{}') as Record<string, unknown>;
    const fecha = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
    return { ...iniciales, desde: fecha(fechas.desde), hasta: fecha(fechas.hasta) };
  } catch {
    return { ...iniciales };
  }
}

/** El rango sobrevive a la navegación de la sesión, aislado por empresa. */
export function useInvoiceFiltros() {
  const tenant = useAuthStore((s) => s.activeCompany?.tenantId ?? null);
  const [estado, setEstado] = useState(() => ({ tenant, filtros: cargar(tenant) }));
  const filtros = estado.tenant === tenant ? estado.filtros : cargar(tenant);
  const actualizar = (nuevo: InvoiceFiltros) => {
    if (tenant) {
      try { sessionStorage.setItem(clave(tenant), JSON.stringify({ desde: nuevo.desde, hasta: nuevo.hasta })); } catch { /* almacenamiento no disponible */ }
    }
    setEstado({ tenant, filtros: nuevo });
  };
  return [filtros, actualizar] as const;
}
