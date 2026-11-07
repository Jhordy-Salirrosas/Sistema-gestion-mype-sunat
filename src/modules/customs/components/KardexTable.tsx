import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDateToPeru } from '@/lib/formatters';
import { type KardexMovementRecord } from '../types/customs.types';
import { Layers, Loader2 } from 'lucide-react';

interface Props {
  movements: KardexMovementRecord[];
  isLoading: boolean;
  searchQuery: string;
}

export const KardexTable = ({ movements, isLoading, searchQuery }: Props) => {
  const filtered = movements.filter((m) => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    const itemCode = String(m.item_code || (m as any).itemCode || '').toLowerCase();
    const desc = String(m.description || '').toLowerCase();
    const sourceRef = String(
      m.source_reference_id || (m as any).sourceReferenceId || ''
    ).toLowerCase();
    return (
      itemCode.includes(q) ||
      desc.includes(q) ||
      (sourceRef && sourceRef.includes(q))
    );
  });

  if (isLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground border rounded-xl bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-xs">Cargando movimientos del Kardex Permanente...</span>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground border rounded-xl bg-card">
        <Layers className="h-8 w-8 text-muted-foreground/60" />
        <span className="text-sm font-medium">No hay registros en el Kardex Valorizado</span>
        <span className="text-xs text-muted-foreground/80">
          {searchQuery ? 'Ningún SKU coincide con el filtro' : 'Los ingresos de importación se reflejarán automáticamente al liquidar una DAM'}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="font-semibold text-xs">Fecha</TableHead>
            <TableHead className="font-semibold text-xs">Tipo / Origen</TableHead>
            <TableHead className="font-semibold text-xs">SKU & Mercadería</TableHead>
            <TableHead className="font-semibold text-xs text-right">Cant. Ingreso</TableHead>
            <TableHead className="font-semibold text-xs text-right">Landed Cost Unit.</TableHead>
            <TableHead className="font-semibold text-xs text-right">Total Ingreso (S/)</TableHead>
            <TableHead className="font-semibold text-xs text-right">Stock Final</TableHead>
            <TableHead className="font-semibold text-xs text-right">Costo Promedio (S/)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item) => (
            <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDateToPeru(item.movement_date)}
              </TableCell>
              <TableCell className="text-xs">
                <div className="flex flex-col gap-0.5">
                  <Badge variant="outline" className="w-fit text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300">
                    {item.movement_type}
                  </Badge>
                  {item.source_reference_id && (
                    <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[130px]">
                      Ref: {item.source_reference_id}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-xs max-w-[200px]">
                <span className="font-mono font-semibold text-foreground block">{item.item_code}</span>
                <span className="text-[11px] text-muted-foreground truncate block">{item.description}</span>
              </TableCell>
              <TableCell className="text-xs text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                +{Number(item.quantity_in).toFixed(2)}
              </TableCell>
              <TableCell className="text-xs text-right font-medium">
                {formatCurrency(item.unit_cost_in, 'PEN')}
              </TableCell>
              <TableCell className="text-xs text-right font-medium">
                {formatCurrency(item.total_cost_in, 'PEN')}
              </TableCell>
              <TableCell className="text-xs text-right font-mono font-semibold">
                {Number(item.final_stock_quantity).toFixed(2)}
              </TableCell>
              <TableCell className="text-xs text-right font-semibold text-primary">
                {formatCurrency(item.final_average_unit_cost, 'PEN')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
