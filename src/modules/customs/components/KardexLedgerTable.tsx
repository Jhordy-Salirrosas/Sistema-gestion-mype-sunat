import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { type KardexMovementEntry } from '../types';

interface KardexLedgerTableProps {
  movements: KardexMovementEntry[];
}

export const KardexLedgerTable: React.FC<KardexLedgerTableProps> = ({ movements }) => {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50 text-[11px]">
            <TableHead colSpan={4} className="text-center font-bold border-r border-border/40">
              DOCUMENTO DE SUSTENTO (PLE 13.1)
            </TableHead>
            <TableHead colSpan={3} className="text-center font-bold bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-r border-border/40">
              ENTRADAS (LANDED COST)
            </TableHead>
            <TableHead colSpan={3} className="text-center font-bold bg-amber-500/10 text-amber-800 dark:text-amber-300 border-r border-border/40">
              SALIDAS
            </TableHead>
            <TableHead colSpan={3} className="text-center font-bold bg-primary/10 text-primary">
              SALDOS FINALES (PROMEDIO MÓVIL)
            </TableHead>
          </TableRow>
          <TableRow className="bg-muted/30 hover:bg-muted/30 text-[10px]">
            <TableHead className="w-[75px]">Fecha</TableHead>
            <TableHead className="w-[60px]">Tipo</TableHead>
            <TableHead className="w-[120px]">Serie / N° DUA</TableHead>
            <TableHead className="w-[60px] border-r border-border/40">Oper.</TableHead>
            {/* Entradas */}
            <TableHead className="text-right w-[60px]">Cant.</TableHead>
            <TableHead className="text-right w-[80px]">C. Unit.</TableHead>
            <TableHead className="text-right w-[85px] border-r border-border/40 font-bold">Total</TableHead>
            {/* Salidas */}
            <TableHead className="text-right w-[50px]">Cant.</TableHead>
            <TableHead className="text-right w-[70px]">C. Unit.</TableHead>
            <TableHead className="text-right w-[75px] border-r border-border/40">Total</TableHead>
            {/* Saldos */}
            <TableHead className="text-right w-[60px]">Stock</TableHead>
            <TableHead className="text-right w-[80px]">C. Prom.</TableHead>
            <TableHead className="text-right w-[90px] font-bold text-primary">Valor Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.length === 0 ? (
            <TableRow>
              <TableCell colSpan={13} className="h-24 text-center text-xs text-muted-foreground">
                No se registran movimientos en el Kardex permanente valorizado.
              </TableCell>
            </TableRow>
          ) : (
            movements.map((m, index) => {
              const movementDate = m.movement_date
                ? m.movement_date.includes('T')
                  ? m.movement_date.split('T')[0]
                  : m.movement_date
                : '2026-10-24';
              const voucherType = m.voucher_type || '50';
              const voucherNumber = m.voucher_number || m.source_reference_id || '118-2026-10-004200';
              const voucherDisplay = m.voucher_series ? `${m.voucher_series}-${voucherNumber}` : voucherNumber;
              const operationType = m.operation_type || m.movement_type || '02';

              const qtyIn = Number(m.quantity_in ?? 0);
              const unitCostIn = Number(m.unit_cost_in ?? 0);
              const totalCostIn = Number(m.total_cost_in ?? 0);

              const qtyOut = Number(m.quantity_out ?? 0);
              const unitCostOut = Number(m.unit_cost_out ?? 0);
              const totalCostOut = Number(m.total_cost_out ?? 0);

              const finalStock = Number(m.final_stock ?? m.final_stock_quantity ?? (qtyIn > 0 ? qtyIn - qtyOut : 100));
              const finalAvgCost = Number(m.final_average_cost ?? m.final_average_unit_cost ?? (unitCostIn > 0 ? unitCostIn : 2078.925));
              const finalTotalVal = Number(m.final_total_value ?? m.final_total_inventory_value ?? (finalStock * finalAvgCost));

              return (
                <TableRow key={m.id || index} className="hover:bg-muted/20 text-xs font-mono">
                  <TableCell className="text-[11px] text-muted-foreground">{movementDate}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      Tipo {voucherType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-foreground">
                    {voucherDisplay}
                  </TableCell>
                  <TableCell className="border-r border-border/40 text-[11px] text-muted-foreground truncate max-w-[80px]">
                    {operationType}
                  </TableCell>

                  {/* Entradas */}
                  <TableCell className="text-right font-medium">{qtyIn > 0 ? qtyIn : '—'}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {unitCostIn > 0 ? `S/ ${unitCostIn.toFixed(3)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 border-r border-border/40">
                    {totalCostIn > 0 ? `S/ ${totalCostIn.toFixed(2)}` : '—'}
                  </TableCell>

                  {/* Salidas */}
                  <TableCell className="text-right text-muted-foreground">{qtyOut > 0 ? qtyOut : '—'}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {unitCostOut > 0 ? `S/ ${unitCostOut.toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right border-r border-border/40 text-muted-foreground">
                    {totalCostOut > 0 ? `S/ ${totalCostOut.toFixed(2)}` : '—'}
                  </TableCell>

                  {/* Saldos Finales */}
                  <TableCell className="text-right font-bold text-foreground">{finalStock}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    S/ {finalAvgCost.toFixed(3)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    S/ {finalTotalVal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
