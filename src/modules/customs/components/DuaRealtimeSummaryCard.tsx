import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { calculateCustomsTaxes } from '../lib/customsCalculations';
import { Calculator, CheckCircle2, ShieldCheck, Box, Coins } from 'lucide-react';

interface Props {
  values: {
    fob_value_usd: number;
    freight_value_usd: number;
    insurance_value_usd: number;
    exchange_rate: number;
    ad_valorem_rate: number;
    perception_rate: number;
  };
  isBalanced: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export const DuaRealtimeSummaryCard = ({
  values,
  isBalanced,
  isSubmitting,
  onSubmit,
}: Props) => {
  const taxes = calculateCustomsTaxes(values);

  return (
    <Card className="border-border shadow-md sticky top-6">
      <CardHeader className="pb-3 border-b bg-muted/30">
        <CardTitle className="text-sm font-bold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Liquidación Tributaria SUNAT
          </span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            Latencia 0 ms
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-4 text-xs">
        {/* Desglose de Valores Aduaneros */}
        <div className="space-y-1.5 border-b pb-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor CIF (USD)</span>
            <span className="font-semibold">{formatCurrency(taxes.cif_value_usd, 'USD')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base Imponible Aduanera CIF (PEN)</span>
            <span className="font-semibold">{formatCurrency(taxes.cif_value_pen, 'PEN')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Arancel Ad-Valorem ({values.ad_valorem_rate}%)</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {formatCurrency(taxes.ad_valorem_amount_pen, 'PEN')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IGV (16%) + IPM (2%)</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {formatCurrency(taxes.igv_ipm_amount_pen, 'PEN')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Percepción IGV ({values.perception_rate}%)</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {formatCurrency(taxes.perception_amount_pen, 'PEN')}
            </span>
          </div>
        </div>

        {/* Total Deuda Tributaria */}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-300 dark:border-amber-800 flex justify-between items-center">
          <div>
            <span className="text-xs font-bold text-amber-950 dark:text-amber-200 block">
              Deuda Tributaria SUNAT (Casilla 4)
            </span>
            <span className="text-[10px] text-amber-800 dark:text-amber-400">
              Monto a liquidar y pagar en Soles
            </span>
          </div>
          <span className="text-base font-extrabold font-mono text-amber-700 dark:text-amber-400">
            {formatCurrency(taxes.total_customs_taxes_pen, 'PEN')}
          </span>
        </div>

        {/* Cajas Didácticas Académicas NIC 2 */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="p-2.5 rounded-lg border bg-card space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
              <Box className="h-3.5 w-3.5" />
              <span>Costo Total a Kardex</span>
            </div>
            <span className="text-xs font-bold font-mono block">
              {formatCurrency(taxes.landed_cost_total_pen, 'PEN')}
            </span>
            <span className="text-[10px] text-muted-foreground block">
              NIC 2 (CIF + Ad-Valorem)
            </span>
          </div>

          <div className="p-2.5 rounded-lg border bg-card space-y-1">
            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-semibold text-[11px]">
              <Coins className="h-3.5 w-3.5" />
              <span>Crédito Fiscal</span>
            </div>
            <span className="text-xs font-bold font-mono block">
              {formatCurrency(taxes.fiscal_credit_pen, 'PEN')}
            </span>
            <span className="text-[10px] text-muted-foreground block">
              IGV + Percepción (Recuperable)
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-2 border-t">
        <Button
          onClick={onSubmit}
          disabled={!isBalanced || isSubmitting}
          className="w-full h-10 gap-2 font-semibold shadow-sm"
        >
          {isSubmitting ? (
            'Registrando y Afectando Kardex...'
          ) : isBalanced ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Liquidar DAM y Aplicar a Kardex
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Cuadre FOB Requerido para Liquidar
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
