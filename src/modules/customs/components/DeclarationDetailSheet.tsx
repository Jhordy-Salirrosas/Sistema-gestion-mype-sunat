import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDateToPeru } from '@/lib/formatters';
import { useCustomsDeclarationDetail } from '../hooks/useCustomsDeclarationDetail';
import { Loader2, Ship, ShieldCheck } from 'lucide-react';

interface Props {
  declarationId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DeclarationDetailSheet = ({ declarationId, isOpen, onClose }: Props) => {
  const { data: detail, isLoading } = useCustomsDeclarationDetail(declarationId);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between pr-6">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <Ship className="h-5 w-5 text-primary" />
              Póliza DAM N° {detail?.dua_number || 'Cargando...'}
            </SheetTitle>
            {detail && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300">
                {detail.status}
              </Badge>
            )}
          </div>
          <SheetDescription className="text-xs">
            Aduana: {detail?.customs_agency_code || '---'} | Régimen: {detail?.regime_code || '10'} | Fecha: {detail ? formatDateToPeru(detail.numeration_date) : '---'}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Cargando póliza aduanera y series...</span>
          </div>
        ) : !detail ? (
          <div className="p-4 text-center text-xs text-muted-foreground">No se encontró la declaración</div>
        ) : (
          <div className="space-y-6 pt-2 text-xs">
            {/* Resumen Impositivo y Liquidación */}
            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Liquidación Oficial SUNAT (Casilla 4)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">CIF Total USD</span>
                  <span className="font-semibold">{formatCurrency(detail.cif_value_usd, 'USD')}</span>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">Tipo de Cambio</span>
                  <span className="font-semibold font-mono">S/ {Number(detail.exchange_rate).toFixed(4)}</span>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">CIF Aduanero PEN</span>
                  <span className="font-semibold">{formatCurrency(detail.cif_value_pen, 'PEN')}</span>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">Ad-Valorem ({detail.ad_valorem_rate}%)</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(detail.ad_valorem_amount_pen, 'PEN')}</span>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">IGV / IPM (18%)</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(detail.igv_ipm_amount_pen, 'PEN')}</span>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">Percepción ({detail.perception_rate}%)</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(detail.perception_amount_pen, 'PEN')}</span>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-300 dark:border-amber-800 flex justify-between items-center">
                <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">Deuda Tributaria Total SUNAT</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400 font-mono">
                  {formatCurrency(detail.total_customs_taxes_pen, 'PEN')}
                </span>
              </div>
            </div>

            {/* Grilla de Series Arancelarias y Landed Cost */}
            <div className="space-y-2">
              <h4 className="font-semibold text-xs text-foreground">Series Arancelarias & Landed Cost Unitario (NIC 2)</h4>
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-semibold text-[11px]">N°</TableHead>
                      <TableHead className="font-semibold text-[11px]">Subpartida / SKU</TableHead>
                      <TableHead className="font-semibold text-[11px] text-right">Cant.</TableHead>
                      <TableHead className="font-semibold text-[11px] text-right">FOB Unit.</TableHead>
                      <TableHead className="font-semibold text-[11px] text-right">Costo Unit. (S/)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((it) => (
                      <TableRow key={it.item_order}>
                        <TableCell className="text-center font-mono text-[11px]">{it.item_order}</TableCell>
                        <TableCell className="text-[11px]">
                          <span className="font-mono font-medium block">{it.hs_code}</span>
                          <span className="text-muted-foreground truncate block max-w-[150px]">{it.commercial_description}</span>
                        </TableCell>
                        <TableCell className="text-right text-[11px] font-mono">
                          {it.quantity} {it.unit_code}
                        </TableCell>
                        <TableCell className="text-right text-[11px] font-mono">
                          {formatCurrency(it.fob_unit_usd, 'USD')}
                        </TableCell>
                        <TableCell className="text-right text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {it.landed_cost_unit_pen ? formatCurrency(it.landed_cost_unit_pen, 'PEN') : '---'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
