import { type CircuitBreakerMetrics } from '../types/resilience.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, ShieldAlert, ShieldCheck } from 'lucide-react';

interface Props {
  metrics?: CircuitBreakerMetrics;
}

export const CircuitBreakerWidget = ({ metrics }: Props) => {
  const state = metrics?.state || 'CLOSED';

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Estado del Circuit Breaker (SUNAT)
        </CardTitle>
        <Badge
          variant={state === 'CLOSED' ? 'outline' : state === 'OPEN' ? 'destructive' : 'secondary'}
          className={
            state === 'CLOSED'
              ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
              : ''
          }
        >
          {state === 'CLOSED' && <ShieldCheck className="h-3 w-3 mr-1" />}
          {state === 'OPEN' && <ShieldAlert className="h-3 w-3 mr-1" />}
          {state}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-muted/50 border">
            <span className="text-muted-foreground block text-[11px]">Tasa de Fallos</span>
            <span className="font-bold text-base">{metrics?.failureRate ?? 0}%</span>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/50 border">
            <span className="text-muted-foreground block text-[11px]">En Buffer Outbox</span>
            <span className="font-bold text-base text-blue-600 dark:text-blue-400">
              {metrics?.bufferedInvoicesCount ?? 0}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {state === 'OPEN'
            ? '⚠️ Tráfico retenido localmente. Los comprobantes se despacharán automáticamente cuando SUNAT se recupere.'
            : '✅ Comunicación directa y estable con los web services de SUNAT.'}
        </p>
      </CardContent>
    </Card>
  );
};
