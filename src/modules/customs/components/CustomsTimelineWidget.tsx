import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle2, History } from 'lucide-react';
import { type CustomsEventRecord } from '../types';

interface CustomsTimelineWidgetProps {
  events: CustomsEventRecord[];
  onOpenAddEvent: () => void;
}

export const CustomsTimelineWidget: React.FC<CustomsTimelineWidgetProps> = ({
  events,
  onOpenAddEvent,
}) => {
  return (
    <Card className="border-border/60 shadow-xs bg-card">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Bitácora de Trazabilidad y Eventos Oficiales
        </CardTitle>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onOpenAddEvent}>
          <Plus className="h-3.5 w-3.5" />
          Registrar Hito
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {events.length === 0 ? (
          <div className="h-28 flex flex-col items-center justify-center border border-dashed border-border/50 rounded-lg text-xs text-muted-foreground gap-1.5">
            <p>No se han registrado hitos en la travesía aduanera.</p>
            <Button size="sm" variant="link" className="text-xs h-auto p-0" onClick={onOpenAddEvent}>
              Registrar Zarpe o Arribo
            </Button>
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {events.map((ev) => (
              <div key={ev.id} className="relative text-xs">
                <div className="absolute -left-6 top-0.5 h-4 w-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    {ev.event_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {new Date(ev.event_timestamp).toLocaleString('es-PE')}
                  </span>
                </div>
                {ev.event_value && (
                  <div className="mt-1">
                    <Badge
                      variant={
                        ev.event_value === 'VERDE'
                          ? 'default'
                          : ev.event_value === 'NARANJA'
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-[10px] font-mono"
                    >
                      {ev.event_value}
                    </Badge>
                  </div>
                )}
                {ev.reference_code && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Ref: {ev.reference_code}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
