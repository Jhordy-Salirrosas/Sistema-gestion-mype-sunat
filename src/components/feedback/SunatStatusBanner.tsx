import { useUiStore } from '@/stores/uiStore';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * SunatStatusBanner: Reflejo visual del Circuit Breaker del backend (El Sello del Proyecto).
 * Garantiza el cumplimiento de la norma ISO 9241-110 (Autoexplicación y Tolerancia a Fallos).
 * Informa al usuario sobre la disponibilidad de los servicios web de SUNAT sin bloquear su operativa.
 */
export const SunatStatusBanner = () => {
  const { sunatCircuitBreakerStatus } = useUiStore();

  if (sunatCircuitBreakerStatus === 'CLOSED') {
    return null; // SUNAT está 100% operativa, no ocupa espacio visual
  }

  if (sunatCircuitBreakerStatus === 'OPEN') {
    return (
      <aside
        role="alert"
        aria-live="assertive"
        className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
            <span>
              <strong>Alerta de Resiliencia SUNAT:</strong> Servicios web oficiales de SUNAT con intermitencia.
              Tus comprobantes se están emitiendo y resguardando en el <strong>Buffer Local / Outbox</strong>.
            </span>
          </div>
          <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            Buffer Activo
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="w-full bg-blue-500/15 border-b border-blue-500/30 text-blue-900 dark:text-blue-200 px-4 py-2 text-xs sm:text-sm font-medium"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 animate-spin" />
          <span>Probando reconexión y estabilidad con los servidores de SUNAT...</span>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-700 dark:text-blue-300">
          Half-Open
        </span>
      </div>
    </aside>
  );
};
