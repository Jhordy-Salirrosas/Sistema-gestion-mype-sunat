import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { SunatStatusBanner } from '@/components/feedback/SunatStatusBanner';
import { ErrorBoundaryGlobal } from '@/components/feedback/ErrorBoundaryGlobal';
import { OfflineIndicator } from '@/components/feedback/OfflineIndicator';
import { useUiStore } from '@/stores/uiStore';

export const AppLayout = () => {
  const location = useLocation();
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);

  useEffect(() => {
    const closeMobileSidebar = () => {
      if (window.matchMedia('(max-width: 639px)').matches) setSidebarCollapsed(true);
    };

    closeMobileSidebar();
    window.addEventListener('resize', closeMobileSidebar);
    return () => window.removeEventListener('resize', closeMobileSidebar);
  }, [location.pathname, setSidebarCollapsed]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Sello de Resiliencia: Banner de alerta cuando SUNAT está caída */}
      <SunatStatusBanner />

      <div className="relative flex-1 flex overflow-hidden">
        {/* Barra lateral de navegación por módulos */}
        <Sidebar />

        {/* Contenido principal */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <Navbar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <ErrorBoundaryGlobal key={location.pathname}>
              <Outlet />
            </ErrorBoundaryGlobal>
          </main>
        </div>
      </div>

      {/* Indicador flotante cuando no hay conexión a internet */}
      <OfflineIndicator />
    </div>
  );
};
