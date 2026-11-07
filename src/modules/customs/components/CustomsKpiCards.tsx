import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { type CustomsDeclarationSummary } from '../types/customs.types';
import { FileText, DollarSign, Landmark } from 'lucide-react';

interface Props {
  declarations: CustomsDeclarationSummary[];
}

export const CustomsKpiCards = ({ declarations }: Props) => {
  const totalDeclarations = declarations.length;

  const totalCifUsd = declarations.reduce(
    (acc, item) => acc + (Number(item.cif_value_usd) || 0),
    0
  );

  const totalTaxesPen = declarations.reduce(
    (acc, item) => acc + (Number(item.total_customs_taxes_pen) || 0),
    0
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="border-border shadow-xs hover:shadow-sm transition-shadow">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block font-medium">
              Total Importaciones
            </span>
            <span className="text-xl font-bold tracking-tight">{totalDeclarations} DAMs</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-xs hover:shadow-sm transition-shadow">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block font-medium">
              Total CIF Importado (USD)
            </span>
            <span className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {formatCurrency(totalCifUsd, 'USD')}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-xs hover:shadow-sm transition-shadow">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block font-medium">
              Tributos SUNAT Pagados (PEN)
            </span>
            <span className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {formatCurrency(totalTaxesPen, 'PEN')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
