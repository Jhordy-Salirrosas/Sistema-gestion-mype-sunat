import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Ship, Clock, DollarSign, ShieldCheck } from 'lucide-react';
import { type CustomsShipmentSummary } from '../types';

interface CustomsKpiGridProps {
  shipments: CustomsShipmentSummary[];
  pendingSettlementsCount?: number;
  totalCifUsd?: number;
  exchangeRate?: number;
}

export const CustomsKpiGrid: React.FC<CustomsKpiGridProps> = ({
  shipments,
  pendingSettlementsCount = 2,
  totalCifUsd = 51500,
  exchangeRate = 3.82,
}) => {
  const activeShipments = shipments.filter(
    (s) => s.status !== 'CERRADO' && s.status !== 'CANCELADO'
  ).length;

  const inTransitCount = shipments.filter(
    (s) => s.status === 'EN_TRANSITO' || s.status === 'BORRADOR' || s.status === 'EN_DESPACHO'
  ).length;

  const cifPen = totalCifUsd * exchangeRate;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total CIF Importado</p>
            <h4 className="text-lg font-bold tracking-tight mt-1">
              ${totalCifUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              ≈ S/ {cifPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Despachos Activos</p>
            <h4 className="text-lg font-bold tracking-tight mt-1">{activeShipments}</h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">{inTransitCount} en travesía o activos</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Ship className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Liquidaciones CDA Pendientes</p>
            <h4 className="text-lg font-bold tracking-tight mt-1">{pendingSettlementsCount}</h4>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
              {pendingSettlementsCount > 0 ? 'Exigen pago bancario' : 'Al día con SUNAT'}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Canales de Control SUNAT</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                🟢 1 Verde
              </span>
              <span className="font-bold text-xs text-amber-600 dark:text-amber-400">
                🟠 1 Naranja
              </span>
              <span className="font-bold text-xs text-rose-600 dark:text-rose-400">
                🔴 0 Rojo
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Levante automático y revisión</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
