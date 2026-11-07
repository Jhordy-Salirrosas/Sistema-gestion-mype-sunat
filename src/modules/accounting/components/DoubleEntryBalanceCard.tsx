import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { Scale, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  totalDebe: number;
  totalHaber: number;
}

export const DoubleEntryBalanceCard = ({ totalDebe, totalHaber }: Props) => {
  const isBalanced = Math.abs(totalDebe - totalHaber) < 0.01;

  return (
    <Card className={`border ${isBalanced ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isBalanced ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold block">Principio de Partida Doble (PCGE)</span>
            <span className="text-[11px] text-muted-foreground">
              {isBalanced ? 'El asiento contable está correctamente balanceado.' : 'Descuadre detectado en el asiento contable.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-semibold">
          <div>
            <span className="text-[10px] text-muted-foreground block">TOTAL DEBE</span>
            <span>{formatCurrency(totalDebe, 'PEN')}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">TOTAL HABER</span>
            <span>{formatCurrency(totalHaber, 'PEN')}</span>
          </div>
          <div className="flex items-center gap-1">
            {isBalanced ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4" /> Cuadrado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-destructive text-xs font-bold">
                <AlertTriangle className="h-4 w-4" /> Descuadre
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
