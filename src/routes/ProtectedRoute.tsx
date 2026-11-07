import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useAuthContextOptional } from '@/context/AuthContext';

/**
 * Guardián de rutas protegidas.
 *
 * POR QUÉ MIRA `isLoading`
 *
 * Al recargar la página, la sesión viaja en `localStorage` y `persist` de
 * zustand la hidrata DESPUÉS del primer render. Con la comprobación ingenua
 * (`if (!isAuthenticated) return <Navigate to="/login" />`) el primer render
 * ocurría con el store vacío y la app mandaba a /login teniendo una sesión
 * válida guardada. Solo se entraba pulsando el botón de login, porque ahí el
 * store ya tenía el token antes de navegar.
 *
 * Mientras la hidratación o el refresco silencioso están en curso se muestra el
 * cargador en lugar de decidir: redirigir es una decisión irreversible para el
 * usuario y no debe tomarse con información incompleta.
 *
 * POR QUÉ USA EL CONTEXTO SI ESTÁ DISPONIBLE
 *
 * La fuente de verdad de la sesión es el `AuthContext` (que es quien restaura
 * con el backend). El store de zustand se consulta como respaldo para que el
 * guardián funcione también montado sin `AuthProvider` —es el caso de las
 * pruebas de navegación—, sin obligar a montar medio árbol de la aplicación.
 */
export const ProtectedRoute = () => {
  const contexto = useAuthContextOptional();
  const tokenStore = useAuthStore((s) => s.token);
  const location = useLocation();

  // Con contexto: manda el contexto. Sin él: manda el store.
  const autenticado = contexto ? contexto.isAuthenticated : Boolean(tokenStore);
  const cargando = contexto ? contexto.isLoading : false;
  const tieneSesion = autenticado || Boolean(tokenStore);

  if (!tieneSesion && cargando) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-xs font-medium">Restaurando la sesión…</span>
      </div>
    );
  }

  if (!tieneSesion) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};
