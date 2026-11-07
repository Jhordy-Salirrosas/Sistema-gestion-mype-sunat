import type { ReconcileScenario } from '../types/sire.types';

export const scenarioPresentation: Record<
  ReconcileScenario,
  { label: string; className: string }
> = {
  COINCIDENCIA_EXACTA: {
    label: 'Coincidencia exacta',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  },
  DIFERENCIA_MONTOS: {
    label: 'Diferencia de montos',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  },
  OMISION_LOCAL: {
    label: 'Falta en ERP local',
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-700',
  },
  OMISION_SUNAT: {
    label: 'No lo reconoce SUNAT',
    className: 'border-orange-500/30 bg-orange-500/10 text-orange-700',
  },
  DUPLICADO_LLAVE: {
    label: 'Llave duplicada · acción manual',
    className: 'border-red-500/30 bg-red-500/10 text-red-700',
  },
};
