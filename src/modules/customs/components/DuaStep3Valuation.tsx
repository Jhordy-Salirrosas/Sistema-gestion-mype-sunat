import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Calculator } from 'lucide-react';
import { type RegisterDuaWizardPayload } from '../types';

interface DuaStep3ValuationProps {
  data: Partial<RegisterDuaWizardPayload>;
  onChange: (partial: Partial<RegisterDuaWizardPayload>) => void;
  calculatedTppsInsurance: number;
}

export const DuaStep3Valuation: React.FC<DuaStep3ValuationProps> = ({
  data,
  onChange,
  calculatedTppsInsurance,
}) => {
  const fob = data.fob_total_usd || 0;
  const freight = data.freight_total_usd || 0;
  const insurance = (data.insurance_total_usd ?? 0) > 0 ? (data.insurance_total_usd ?? 0) : calculatedTppsInsurance;
  const tc = data.exchange_rate || 3.82;

  const cifUsd = fob + freight + insurance;
  const cifPen = cifUsd * tc;
  const adValorem = 0; // Desgravación por TLC
  const baseIgv = cifPen + adValorem;
  const igv = baseIgv * 0.16;
  const ipm = baseIgv * 0.02;
  const totalDuties = adValorem + igv + ipm;
  const basePerception = cifPen + totalDuties;
  const perception = basePerception * 0.035;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
      <Card className="border-border/60 shadow-xs bg-card">
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Parámetros de Flete y Seguro Internacional
          </h4>

          <div>
            <label className="font-semibold text-foreground block mb-1">Flete Internacional Total (USD)</label>
            <Input
              type="number"
              value={data.freight_total_usd || 0}
              onChange={(e) => onChange({ freight_total_usd: parseFloat(e.target.value) || 0 })}
              className="h-8 text-xs font-mono font-bold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-foreground">Prima de Seguro Internacional (USD)</label>
              {(data.insurance_total_usd ?? 0) === 0 && (
                <Badge variant="secondary" className="text-[10px] gap-1 font-mono">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  TPPS SUNAT: ${calculatedTppsInsurance}
                </Badge>
              )}
            </div>
            <Input
              type="number"
              value={data.insurance_total_usd || 0}
              onChange={(e) => onChange({ insurance_total_usd: parseFloat(e.target.value) || 0 })}
              placeholder="0 para aplicar seguro de tabla"
              className="h-8 text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Si se declara $0.00, el sistema aplica la alícuota supletoria de la Tabla de Seguro de SUNAT (0.75%).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-xs bg-primary/5 border-primary/20">
        <CardContent className="p-4 space-y-2">
          <h4 className="font-bold text-foreground text-sm border-b border-border/40 pb-2">
            Liquidación Oficial SUNAT en Vivo (0 ms)
          </h4>

          <div className="space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor CIF (USD):</span>
              <span className="font-bold text-foreground">${cifUsd.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor CIF (PEN) a TC {tc}:</span>
              <span className="font-bold text-foreground">S/ {cifPen.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ad-Valorem (TLC 0%):</span>
              <span>S/ {adValorem.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IGV (16%):</span>
              <span>S/ {igv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IPM (2%):</span>
              <span>S/ {ipm.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-border/40 font-bold text-primary">
              <span>Cuota 0010 (Tributos):</span>
              <span>S/ {totalDuties.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-amber-600 dark:text-amber-400">
              <span>Cuota 0026 (Percepción 3.5%):</span>
              <span>S/ {perception.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
