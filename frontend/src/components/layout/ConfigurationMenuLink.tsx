import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
/** Administración reservada; la ruta existente y el servidor validan acceso. */
export function ConfigurationMenuLink() {
  const role = useAuthStore(s => s.user?.role);
  if (role !== 'ADMIN') return null;
  return <Link to="/invoices/configuracion" aria-label="Configuración" title="Configuración" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs"><Settings className="h-4 w-4"/><span className="hidden md:inline">Configuración</span></Link>;
}
