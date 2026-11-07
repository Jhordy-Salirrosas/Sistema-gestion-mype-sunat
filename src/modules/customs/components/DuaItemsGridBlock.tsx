import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { type RegisterDuaItemPayload } from '../types/customs.types';
import { Plus, Trash2, PackageCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  items: RegisterDuaItemPayload[];
  targetFob: number;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, field: keyof RegisterDuaItemPayload, value: string | number) => void;
}

export const DuaItemsGridBlock = ({
  items,
  targetFob,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
}: Props) => {
  const sumItemsFob = items.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.fob_unit_usd) || 0),
    0
  );
  const diff = Number((targetFob - sumItemsFob).toFixed(2));
  const isBalanced = Math.abs(diff) <= 0.05 && targetFob > 0 && items.length > 0;

  return (
    <Card className="border-border shadow-xs">
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <PackageCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Bloque 3: Series Arancelarias & Mercancías Importadas
        </CardTitle>
        <div className="flex items-center gap-2">
          {isBalanced ? (
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 gap-1 text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              FOB Cuadrado ({formatCurrency(sumItemsFob, 'USD')})
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1 text-[11px]">
              <AlertCircle className="h-3.5 w-3.5" />
              Descuadre FOB: {diff > 0 ? `Faltan $${diff.toFixed(2)}` : `Sobran $${Math.abs(diff).toFixed(2)}`}
            </Badge>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAddItem}>
            <Plus className="h-3.5 w-3.5" />
            Agregar Serie
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {items.map((item, index) => {
          const itemTotal = (Number(item.quantity) || 0) * (Number(item.fob_unit_usd) || 0);
          return (
            <div key={index} className="p-3 rounded-lg border bg-muted/20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Serie #{index + 1}</span>
                {items.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => onRemoveItem(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-medium block mb-1">SKU</label>
                  <Input
                    placeholder="LAP-ASUS-01"
                    value={item.item_code || ''}
                    onChange={(e) => onUpdateItem(index, 'item_code', e.target.value)}
                    className="font-mono text-xs h-8"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-medium block mb-1">Subpartida (10 dígitos)</label>
                  <Input
                    placeholder="8471.30.00.00"
                    value={item.hs_code}
                    onChange={(e) => onUpdateItem(index, 'hs_code', e.target.value)}
                    className="font-mono text-xs h-8"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-medium block mb-1">Descripción Comercial</label>
                  <Input
                    placeholder="Laptop Gamer Intel Core i7"
                    value={item.commercial_description}
                    onChange={(e) => onUpdateItem(index, 'commercial_description', e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-medium block mb-1">Cantidad / Ud.</label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.quantity}
                      onChange={(e) => onUpdateItem(index, 'quantity', Number(e.target.value))}
                      className="font-mono text-xs h-8"
                    />
                    <Input
                      value={item.unit_code}
                      onChange={(e) => onUpdateItem(index, 'unit_code', e.target.value)}
                      className="font-mono text-xs h-8 w-14 uppercase"
                    />
                  </div>
                </div>
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-medium block mb-1">FOB Unit. ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.fob_unit_usd}
                    onChange={(e) => onUpdateItem(index, 'fob_unit_usd', Number(e.target.value))}
                    className="font-mono text-xs h-8"
                  />
                  <span className="text-[10px] text-muted-foreground block text-right mt-0.5 font-mono">
                    Tot: {formatCurrency(itemTotal, 'USD')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
