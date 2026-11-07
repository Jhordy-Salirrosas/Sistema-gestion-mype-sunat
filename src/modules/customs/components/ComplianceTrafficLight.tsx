import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface ComplianceAlertItem {
  id: string;
  title: string;
  reference: string;
  daysRemaining: number;
  severity: 'safe' | 'warning' | 'danger';
}

const DEFAULT_ALERTS: ComplianceAlertItem[] = [
  {
    id: 'a1',
    title: 'Regularización Despacho Anticipado (Art. B.3 PG.01)',
    reference: 'EXP-2026-00042',
    daysRemaining: 12,
    severity: 'safe',
  },
  {
    id: 'a2',
    title: 'Fecha Límite Pago con Garantía Art. 160 (Día 20)',
    reference: 'Cuota CDA 0010 Callao',
    daysRemaining: 4,
    severity: 'warning',
  },
  {
    id: 'a3',
    title: 'Plazo de Abandono Legal (30 días de descarga)',
    reference: 'DEP-TEMPORAL Callao',
    daysRemaining: 24,
    severity: 'safe',
  },
];

export const ComplianceTrafficLight: React.FC = () => {
  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Semáforo de Plazos Legales y Riesgos SUNAT
          </span>
          <Badge variant="outline" className="text-[11px] font-normal">
            DESPA-PG.01
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-2.5">
        {DEFAULT_ALERTS.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-muted/20 text-xs"
          >
            <div className="flex items-center gap-2.5">
              {alert.severity === 'danger' && (
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              )}
              {alert.severity === 'warning' && (
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              {alert.severity === 'safe' && (
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <div>
                <p className="font-medium text-foreground">{alert.title}</p>
                <p className="text-[11px] text-muted-foreground">{alert.reference}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span
                className={`font-semibold text-xs ${
                  alert.severity === 'danger'
                    ? 'text-red-600'
                    : alert.severity === 'warning'
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {alert.daysRemaining} días
              </span>
              <p className="text-[10px] text-muted-foreground">restantes</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
