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
import { Button } from '@/components/ui/button';
import { Plus, Receipt } from 'lucide-react';
import { type LocalExpenseInvoiceRecord } from '../types';

interface LocalExpensesTableProps {
  expenses: LocalExpenseInvoiceRecord[];
  onOpenAddModal: () => void;
}

const formatConcept = (c: string) => {
  if (c.includes('ALMACENAJE')) return 'Almacenaje Portuario';
  if (c.includes('AGENTE')) return 'Agente de Aduanas';
  if (c.includes('FLETE') || c.includes('TRANSPORTE')) return 'Flete Local Puerto-Almacén';
  if (c.includes('CUADRILLA') || c.includes('DESCARGA')) return 'Estiba y Cuadrilla';
  return c;
};

const formatProration = (p: string) => {
  if (p === 'PESO_BRUTO') return 'Por Peso Bruto (kg)';
  if (p === 'VALOR_FOB') return 'Por Valor FOB ($)';
  return p;
};

export const LocalExpensesTable: React.FC<LocalExpensesTableProps> = ({
  expenses,
  onOpenAddModal,
}) => {
  const totalBase = expenses.reduce((acc, e) => acc + (Number(e.net_amount_pen) || 0), 0);
  const totalIgv = expenses.reduce((acc, e) => acc + (Number(e.igv_amount_pen) || 0), 0);
  const totalFacturas = expenses.reduce((acc, e) => acc + (Number(e.total_amount_pen) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Receipt className="h-4 w-4 text-primary" />
          Comprobantes de Gastos Locales de Desaduanaje (NIC 2)
        </h4>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onOpenAddModal}>
          <Plus className="h-3.5 w-3.5" />
          Registrar Factura Local
        </Button>
      </div>

      <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[140px] text-xs font-semibold">Concepto</TableHead>
              <TableHead className="text-xs font-semibold">Proveedor Local</TableHead>
              <TableHead className="w-[110px] text-xs font-semibold">Comprobante</TableHead>
              <TableHead className="w-[120px] text-right text-xs font-semibold">Base (Al Costo NIC 2)</TableHead>
              <TableHead className="w-[120px] text-right text-xs font-semibold">IGV (Crédito Fiscal)</TableHead>
              <TableHead className="w-[110px] text-right text-xs font-semibold">Total Factura</TableHead>
              <TableHead className="w-[130px] text-xs font-semibold">Criterio Prorrateo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-xs text-muted-foreground">
                  No se han registrado facturas locales (almacenaje, agente, transporte).
                </TableCell>
              </TableRow>
            ) : (
              <>
                {expenses.map((e) => (
                  <TableRow key={e.id} className="hover:bg-muted/30">
                    <TableCell className="font-semibold text-xs text-foreground">
                      {formatConcept(e.expense_concept)}
                    </TableCell>
                    <TableCell className="text-xs text-foreground truncate max-w-[200px]">
                      {e.supplier_name}
                      <span className="block text-[10px] text-muted-foreground font-mono">{e.supplier_ruc}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {e.invoice_serial_number}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right font-bold text-primary">
                      S/ {Number(e.net_amount_pen ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right text-emerald-600 dark:text-emerald-400">
                      S/ {Number(e.igv_amount_pen ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right text-muted-foreground">
                      S/ {Number(e.total_amount_pen ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {formatProration(e.proration_method)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-bold border-t">
                  <TableCell colSpan={3} className="text-xs text-right text-foreground">
                    TOTAL GASTOS VINCULADOS:
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-primary">
                    S/ {totalBase.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-emerald-600 dark:text-emerald-400">
                    S/ {totalIgv.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-foreground">
                    S/ {totalFacturas.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-[10px] text-muted-foreground font-normal">
                    Solo la base va al costo
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
