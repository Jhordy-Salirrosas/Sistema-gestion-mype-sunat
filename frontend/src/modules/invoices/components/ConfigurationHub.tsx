import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/axios';
/** Administración reservada: la lista viene de un endpoint ADMIN. */
export function ConfigurationHub() {
  const user = useAuthStore(s => s.user); const company = useAuthStore(s => s.activeCompany?.tenantId);
  const allowed = user?.role === 'ADMIN';
  const query = useQuery({ queryKey: ['configuration-links', company, user?.id], enabled: allowed, retry: false,
    queryFn: async () => { const data = (await apiClient.get<Array<{ label: string; path: string }>>('/configuration/links')).data; if (!Array.isArray(data) || data.some(link => typeof link.label !== 'string' || typeof link.path !== 'string' || !link.path.startsWith('/') || link.path.startsWith('//'))) throw Error('Catálogo de configuración inválido'); return data; } });
  if (!allowed) return null;
  return <section aria-label="Configuración global" className="space-y-3 rounded-md border p-4"><h2 className="font-semibold">Configuración</h2>
    {query.isError ? <p role="alert">No se pudieron leer los accesos de configuración.</p> : query.isPending ? <p role="status">Consultando configuración…</p> : <nav aria-label="Configuración"><ul className="grid gap-2 sm:grid-cols-2">{query.data.map(link => <li key={link.label}><a className="text-sm text-primary underline" href={link.path}>{link.label}</a></li>)}</ul></nav>}
  </section>;
}
