import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface QuickTariffCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickTariffCalculatorModal = ({
  isOpen,
  onClose,
}: QuickTariffCalculatorModalProps) => {
  const [fobUsd, setFobUsd] = useState<number>(50000);
  const [freightUsd, setFreightUsd] = useState<number>(1200);
  const [insuranceUsd, setInsuranceUsd] = useState<number>(375);
  const [adValoremRate, setAdValoremRate] = useState<number>(0);
  const [perceptionRate, setPerceptionRate] = useState<number>(0.035);
  const exchangeRate = 3.82;

  // Cálculos matemáticos en tiempo real
  const cifUsd = fobUsd + freightUsd + insuranceUsd;
  const cifPen = cifUsd * exchangeRate;

  const adValoremPen = cifPen * (adValoremRate / 100);
  const baseIgvPen = cifPen + adValoremPen;
  const igvPen = baseIgvPen * 0.16;
  const ipmPen = baseIgvPen * 0.02;

  const basePerceptionPen = baseIgvPen + igvPen + ipmPen;
  const perceptionPen = basePerceptionPen * perceptionRate;
  const totalDebtPen = adValoremPen + igvPen + ipmPen + perceptionPen;

  const handleApplyTpps = () => {
    setInsuranceUsd(Number((fobUsd * 0.0075).toFixed(2)));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl p-6 text-xs">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-primary">
            <Calculator className="h-5 w-5" />
            Simulador Rápido de Tributos y Deuda Aduanera (SUNAT)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cotización arancelaria instantánea antes de aperturar un expediente formal de importación.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-4">
          {/* Columna Izquierda: Parámetros de Entrada */}
          <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border">
            <h4 className="font-bold text-foreground uppercase tracking-wide text-[11px] pb-1 border-b border-border/50">
              Valores Declarados de Compra (USD)
            </h4>

            <div>
              <label className="text-muted-foreground block text-[11px] font-medium mb-1">
                Valor FOB Total (USD):
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-muted-foreground text-xs font-mono">$</span>
                <input
                  type="number"
                  value={fobUsd}
                  onChange={(e) => setFobUsd(Number(e.target.value))}
                  className="w-full h-8 pl-6 pr-2 border rounded-md font-mono text-xs bg-background"
                />
              </div>
            </div>

            <div>
              <label className="text-muted-foreground block text-[11px] font-medium mb-1">
                Flete Internacional (USD):
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-muted-foreground text-xs font-mono">$</span>
                <input
                  type="number"
                  value={freightUsd}
                  onChange={(e) => setFreightUsd(Number(e.target.value))}
                  className="w-full h-8 pl-6 pr-2 border rounded-md font-mono text-xs bg-background"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-muted-foreground text-[11px] font-medium">
                  Seguro Internacional:
                </label>
                <button
                  type="button"
                  onClick={handleApplyTpps}
                  className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Aplicar TPPS (0.75%)
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-muted-foreground text-xs font-mono">$</span>
                <input
                  type="number"
                  value={insuranceUsd}
                  onChange={(e) => setInsuranceUsd(Number(e.target.value))}
                  className="w-full h-8 pl-6 pr-2 border rounded-md font-mono text-xs bg-background"
                />
              </div>
            </div>

            <div>
              <label className="text-muted-foreground block text-[11px] font-medium mb-1">
                Arancel Ad-Valorem:
              </label>
              <select
                value={adValoremRate}
                onChange={(e) => setAdValoremRate(Number(e.target.value))}
                className="w-full h-8 px-2 border rounded-md text-xs bg-background font-medium"
              >
                <option value={0}>0% — Bienes TIC / Capital</option>
                <option value={6}>6% — Insumos / Materias Primas</option>
                <option value={11}>11% — Consumo Final</option>
              </select>
            </div>

            <div>
              <label className="text-muted-foreground block text-[11px] font-medium mb-1">
                Tasa de Percepción del IGV:
              </label>
              <select
                value={perceptionRate}
                onChange={(e) => setPerceptionRate(Number(e.target.value))}
                className="w-full h-8 px-2 border rounded-md text-xs bg-background font-medium"
              >
                <option value={0.035}>3.5% — Importador Frecuente</option>
                <option value={0.05}>5.0% — Primera Vez / Usado</option>
                <option value={0.1}>10.0% — No Habido / Suspendido</option>
              </select>
            </div>
          </div>

          {/* Columna Derecha: Liquidación Oficial Estimada */}
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <h4 className="font-bold text-primary uppercase tracking-wide text-[11px]">
                  Liquidación Estimada (PEN)
                </h4>
                <Badge variant="outline" className="text-[10px] py-0 font-mono">
                  T.C. S/ {exchangeRate}
                </Badge>
              </div>

              <div className="divide-y divide-border/40 text-xs py-1">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground">Valor CIF Aduanas:</span>
                  <span className="font-mono font-bold whitespace-nowrap text-foreground">
                    {formatCurrency(cifUsd, 'USD')}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground">CIF Nacionalizado:</span>
                  <span className="font-mono font-semibold whitespace-nowrap text-foreground">
                    {formatCurrency(cifPen, 'PEN')}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground">Ad-Valorem ({adValoremRate}%):</span>
                  <span className="font-mono whitespace-nowrap text-foreground">
                    {formatCurrency(adValoremPen, 'PEN')}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground">IGV (16%):</span>
                  <span className="font-mono whitespace-nowrap text-foreground">
                    {formatCurrency(igvPen, 'PEN')}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground">IPM (2%):</span>
                  <span className="font-mono whitespace-nowrap text-foreground">
                    {formatCurrency(ipmPen, 'PEN')}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                  <span>Percepción ({(perceptionRate * 100).toFixed(1)}%):</span>
                  <span className="font-mono whitespace-nowrap">
                    {formatCurrency(perceptionPen, 'PEN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border bg-background/60 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    TOTAL DEUDA ADUANERA:
                  </span>
                  <span className="text-[10px] text-muted-foreground">Pago en bancos con CDA (Cuotas 0010 + 0026)</span>
                </div>
                <span className="text-lg font-bold font-mono text-primary whitespace-nowrap">
                  {formatCurrency(totalDebtPen, 'PEN')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs px-4 h-8">
            Cerrar Simulador
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
