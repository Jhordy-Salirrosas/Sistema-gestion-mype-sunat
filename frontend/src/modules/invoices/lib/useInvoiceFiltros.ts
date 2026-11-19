import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { FILTROS_ESTADO, type InvoiceFiltros } from '../components/InvoiceFiltersBar';
const iniciales: InvoiceFiltros = { busqueda: '', estado: 'TODOS', desde: '', hasta: '' };
const clave = (tenant: string) => `m1:fechas:${tenant}`;
const keys = ['busqueda', 'estado', 'desde', 'hasta'] as const;
function leer(valores: Record<string, unknown>): InvoiceFiltros {
 const fecha = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
 return { busqueda: typeof valores.busqueda === 'string' ? valores.busqueda : '',
  estado: FILTROS_ESTADO.some(f => f.value === valores.estado) ? valores.estado as InvoiceFiltros['estado'] : 'TODOS',
  desde: fecha(valores.desde), hasta: fecha(valores.hasta) };
}
function cargar(tenant: string | null) {
 try { return tenant ? leer(JSON.parse(sessionStorage.getItem(clave(tenant)) ?? '{}')) : { ...iniciales }; }
 catch { return { ...iniciales }; }
}
/** URL navegable; respaldo de sesión aislado por empresa, sin nuevas llamadas. */
export function useInvoiceFiltros() {
 const tenant = useAuthStore(s => s.activeCompany?.tenantId ?? null);
 const [params, setParams] = useSearchParams();
 const [respaldo, setRespaldo] = useState(() => ({ tenant, filtros: cargar(tenant) }));
 const filtros = respaldo.tenant !== tenant ? cargar(tenant) : params.has('m1') || keys.some(k => params.has(k))
  ? leer(Object.fromEntries(params)) : respaldo.filtros;
 const actualizar = (nuevo: InvoiceFiltros, limpiarTodo = false) => {
  if (tenant) try { sessionStorage.setItem(clave(tenant), JSON.stringify(nuevo)); } catch { /* Modo privado: la URL conserva filtros. */ }
  setRespaldo({ tenant, filtros: nuevo });
  setParams(prev => { const next = new URLSearchParams(prev); next.set('m1', '1'); if(limpiarTodo)next.delete('incluir_notas');
   for (const key of keys) { const value = nuevo[key]; if (value && value !== 'TODOS') next.set(key, value); else next.delete(key); }
   return next;
  }, { replace: true });
 };
 return [filtros, actualizar] as const;
}
