import { type DuaCalculationResult } from '../types/customs.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { Calculator, CheckCircle2, TrendingUp } from 'lucide-react';

interface Props {
  result?: DuaCalculationResult | null;
}

export const DuaSummaryCard = ({ result }: Props) => {
  if (!result) return null;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          Liquidación de Tributos Aduaneros (Casilla 4 DAM)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-2.5 text-xs">
        <div className="flex justify-between py-1 border-b border-muted">
          <span className="text-muted-foreground">Valor CIF (USD)</span>
          <span className="font-semibold">{formatCurrency(result.cif_value_usd, 'USD')}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-muted">
          <span className="text-muted-foreground">Base CIF Nacionalizado (PEN)</span>
          <span className="font-semibold">{formatCurrency(result.cif_value_pen, 'PEN')}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-muted">
          <span className="text-muted-foreground">Derechos Arancelarios (Ad-Valorem)</span>
          <span className="font-semibold">{formatCurrency(result.ad_valorem_amount_pen, 'PEN')}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-muted">
          <span className="text-muted-foreground">IGV (16%) + IPM (2%)</span>
          <span className="font-semibold">{formatCurrency(result.igv_ipm_amount_pen, 'PEN')}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-muted text-amber-600 dark:text-amber-400">
          <span>Percepción del IGV SUNAT</span>
          <span className="font-semibold">{formatCurrency(result.perception_amount_pen, 'PEN')}</span>
        </div>
        <div className="flex justify-between py-2 text-sm font-bold text-primary pt-2 border-t">
          <span>Total Deuda Tributaria SUNAT</span>
          <span className="text-base">{formatCurrency(result.total_customs_taxes_pen, 'PEN')}</span>
        </div>

        {/* Cajas informativas NIC 2 */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
            <div className="flex items-center gap-1 font-semibold mb-0.5">
              <TrendingUp className="h-3 w-3" />
              <span>Entra a Kardex (NIC 2)</span>
            </div>
            <p className="font-bold text-xs">{formatCurrency(result.landed_cost_total_pen, 'PEN')}</p>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <div className="flex items-center gap-1 font-semibold mb-0.5">
              <CheckCircle2 className="h-3 w-3" />
              <span>Crédito Fiscal</span>
            </div>
            <p className="font-bold text-xs">{formatCurrency(result.fiscal_credit_pen, 'PEN')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
