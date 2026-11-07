import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sliders, Scale } from 'lucide-react';

interface ProrationSimulatorProps {
  totalExpensePen: number;
  totalWeightKg?: number;
  totalFobUsd?: number;
}

export const ProrationSimulator: React.FC<ProrationSimulatorProps> = ({
  totalExpensePen,
  totalWeightKg = 0,
  totalFobUsd = 0,
}) => {
  const safeTotalPen = Number(totalExpensePen) || 0;
  // Desglose bivariado oficial NIC 2 Párrafo 11: 66% peso (almacenaje, estiba), 34% valor FOB (agenciamiento)
  const weightExpensePen = safeTotalPen * 0.66;
  const fobExpensePen = safeTotalPen * 0.34;

  const factorByWeight = totalWeightKg > 0 ? weightExpensePen / totalWeightKg : 0;
  const factorByFob = totalFobUsd > 0 ? fobExpensePen / totalFobUsd : 0;

  return (
    <Card className="border-border/60 shadow-xs bg-card">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            Simulador de Prorrateos Bivariados (NIC 2 — Párrafo 11)
          </span>
          <Badge variant="outline" className="text-[10px] gap-1 font-mono text-emerald-600 border-emerald-300">
            <Scale className="h-3 w-3" />
            Cuadre al Céntimo: S/ {safeTotalPen.toFixed(2)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3 text-xs">
        {safeTotalPen === 0 ? (
          <div className="p-3 text-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed text-xs">
            No se han registrado facturas locales de desaduanaje aún. Pulse <strong>+ Registrar Factura Local</strong> para ingresar fletes locales, almacenaje o agenciamiento.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border/40 bg-muted/20 space-y-1">
              <div className="flex justify-between items-center">
                <p className="font-bold text-foreground">Factor por Peso Bruto (Fletes y Almacenaje)</p>
                <Badge variant="secondary" className="text-[9px]">S/ {weightExpensePen.toFixed(2)}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Gastos de manipulación y tracción: S/ {weightExpensePen.toFixed(2)} ÷ {totalWeightKg || 1} kg
              </p>
              <p className="text-sm font-mono font-bold text-primary pt-1">
                F_peso = S/ {factorByWeight.toFixed(4)} / kg
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border/40 bg-muted/20 space-y-1">
              <div className="flex justify-between items-center">
                <p className="font-bold text-foreground">Factor por Valor FOB (Agente y Despacho)</p>
                <Badge variant="secondary" className="text-[9px]">S/ {fobExpensePen.toFixed(2)}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Honorarios de agenciamiento aduanero: S/ {fobExpensePen.toFixed(2)} ÷ ${Number(totalFobUsd || 1).toLocaleString()}
              </p>
              <p className="text-sm font-mono font-bold text-primary pt-1">
                F_fob = S/ {factorByFob.toFixed(6)} / USD
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
