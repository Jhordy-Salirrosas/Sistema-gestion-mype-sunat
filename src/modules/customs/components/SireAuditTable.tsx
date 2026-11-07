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
import { type SireAnnex8_4Record } from '../types';

interface SireAuditTableProps {
  records: SireAnnex8_4Record[];
}

export const SireAuditTable: React.FC<SireAuditTableProps> = ({ records }) => {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
            <TableHead className="w-[90px] font-semibold">Período</TableHead>
            <TableHead className="w-[90px] font-semibold">Aduana</TableHead>
            <TableHead className="w-[120px] font-semibold">N° Declaración DAM</TableHead>
            <TableHead className="w-[100px] font-semibold">Fecha Emisión</TableHead>
            <TableHead className="text-xs font-semibold">Proveedor Extranjero</TableHead>
            <TableHead className="w-[120px] text-right font-semibold">Base Imponible</TableHead>
            <TableHead className="w-[110px] text-right font-semibold">Crédito IGV</TableHead>
            <TableHead className="w-[110px] text-right font-semibold">Percepción</TableHead>
            <TableHead className="w-[120px] text-right font-semibold text-primary">Costo Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-xs text-muted-foreground">
                No existen registros aduaneros para la propuesta Anexo 8.4 del SIRE RCE.
              </TableCell>
            </TableRow>
          ) : (
            records.map((r, i) => (
              <TableRow key={i} className="hover:bg-muted/30 text-xs font-mono">
                <TableCell className="font-semibold text-foreground">{r.period}</TableCell>
                <TableCell className="text-muted-foreground">{r.customs_code}</TableCell>
                <TableCell className="font-bold text-foreground">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {r.customs_code}-{r.numeration_year}-10-{r.correlative_dua}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground font-sans">{r.document_issue_date}</TableCell>
                <TableCell className="text-foreground truncate max-w-[180px] font-sans">
                  {r.supplier_name}
                </TableCell>
                <TableCell className="text-right font-medium">
                  S/ {Number(r.taxable_base_pen ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                  S/ {Number(r.igv_ipm_pen ?? 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-amber-600 dark:text-amber-400">
                  S/ {Number(r.perception_pen ?? 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-bold text-primary">
                  S/ {Number(r.total_import_cost_pen ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
