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
import { Copy, CreditCard } from 'lucide-react';
import { type CustomsSettlementRecord } from '../types';

interface PendingSettlementsTableProps {
  settlements: CustomsSettlementRecord[];
  onOpenPayModal: (settlement: CustomsSettlementRecord) => void;
}

export const PendingSettlementsTable: React.FC<PendingSettlementsTableProps> = ({
  settlements,
  onOpenPayModal,
}) => {
  const copyCdaToClipboard = (cda: string) => {
    navigator.clipboard.writeText(cda);
  };

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[110px] text-xs font-semibold">Tipo Cuota</TableHead>
            <TableHead className="text-xs font-semibold">Código CDA (14 dígitos)</TableHead>
            <TableHead className="w-[120px] text-xs font-semibold">Monto (USD)</TableHead>
            <TableHead className="w-[130px] text-xs font-semibold">Monto (PEN)</TableHead>
            <TableHead className="w-[110px] text-xs font-semibold">Vencimiento</TableHead>
            <TableHead className="w-[100px] text-xs font-semibold">Estado</TableHead>
            <TableHead className="w-[120px] text-right text-xs font-semibold">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {settlements.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground">
                No existen liquidaciones aduaneras pendientes de pago.
              </TableCell>
            </TableRow>
          ) : (
            settlements.map((s) => {
              const cda = s.cda_number || `${s.settlement_number || '11826100104589'}`;
              return (
                <TableRow key={s.id} className="hover:bg-muted/30">
                  <TableCell className="font-semibold text-xs">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {s.settlement_type.includes('0010')
                        ? '0010 TRIBUTOS'
                        : s.settlement_type.includes('0026')
                        ? '0026 PERCEPCION'
                        : '0027 MULTA'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{cda}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        title="Copiar CDA para banca por internet"
                        onClick={() => copyCdaToClipboard(cda)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    ${s.amount_usd?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-primary">
                    S/ {s.amount_pen?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {new Date(s.due_date).toLocaleDateString('es-PE')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={s.status === 'PAGADA' ? 'default' : s.status === 'VENCIDA' ? 'destructive' : 'secondary'}
                      className="text-[10px] uppercase font-medium"
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {s.status !== 'PAGADA' && (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 px-2.5 font-bold"
                        onClick={() => onOpenPayModal(s)}
                      >
                        <CreditCard className="h-3 w-3" />
                        Pagar CDA
                      </Button>
                    )}
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
