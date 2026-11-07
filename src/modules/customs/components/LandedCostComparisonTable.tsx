import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CheckCircle2, ArrowRight, BookOpen, Layers } from 'lucide-react';
import { type LandedCostSheetRecord, type CustomsDeclarationRecord } from '../types';

interface LandedCostComparisonTableProps {
  sheet?: LandedCostSheetRecord | null;
  activeDeclaration?: CustomsDeclarationRecord | null;
  totalLocalExpensesPen?: number;
  fallbackDescription?: string;
  onApplyKardex: () => Promise<unknown>;
  isApplying: boolean;
}

export const LandedCostComparisonTable: React.FC<LandedCostComparisonTableProps> = ({
  sheet,
  activeDeclaration,
  totalLocalExpensesPen = 0,
  fallbackDescription,
  onApplyKardex,
  isApplying,
}) => {
  // 1. Si existe desglose ya calculado por el servicio backend, usarlo
  let breakdown = sheet?.series_breakdown || [];
  let totalCifPen = Number(sheet?.total_cif_pen) || 0;
  let totalExpensesPen = Number(sheet?.total_local_expenses_pen) || Number(totalLocalExpensesPen) || 0;
  let totalCostPen = Number(sheet?.total_inventory_cost_pen) || (totalCifPen + totalExpensesPen);

  // 2. Si aún no se ha ejecutado el recálculo backend, proyectar en vivo desde la DAM oficial
  if (breakdown.length === 0 && activeDeclaration?.series && activeDeclaration.series.length > 0) {
    const totalFob = activeDeclaration.fob_total_usd || 1;
    totalCifPen = activeDeclaration.cif_total_pen || 0;
    totalCostPen = totalCifPen + totalExpensesPen;

    breakdown = activeDeclaration.series.map((s, idx) => {
      const fobRatio = (s.fob_usd || 0) / totalFob;
      const sCifPen = Number((totalCifPen * fobRatio).toFixed(2));
      const sAdValoremPen = Number((sCifPen * ((s.ad_valorem_rate || 0) / 100)).toFixed(2));
      const sExpPen = Number((totalExpensesPen * fobRatio).toFixed(2));
      const sTotalPen = sCifPen + sAdValoremPen + sExpPen;
      const qty = s.physical_quantity || 1;
      const unitCost = Number((sTotalPen / qty).toFixed(3));

      return {
        series_id: `series-${s.series_order || idx + 1}`,
        series_order: s.series_order || idx + 1,
        product_code: s.product_code || `SKU-${idx + 1}`,
        commercial_description: s.commercial_description || fallbackDescription || 'Mercancía nacionalizada',
        physical_quantity: qty,
        cif_pen: sCifPen,
        ad_valorem_pen: sAdValoremPen,
        allocated_local_expenses_pen: sExpPen,
        total_landed_cost_pen: sTotalPen,
        final_landed_cost_unit_pen: unitCost,
      };
    });
  }

  const shipmentRef = activeDeclaration?.shipment_id || sheet?.shipment_id || 'EXP';
  const damRef = activeDeclaration?.dua_number || 'DAM';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-primary" />
            Desglose Analítico de Adquisición Final (Landed Cost NIC 2)
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Excluye 100% créditos fiscales de IGV aduanero y local (NIC 2 — Párrafo 11).
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5 font-bold bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onApplyKardex}
          disabled={isApplying || breakdown.length === 0}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {isApplying ? 'Aprobando y Transmitiendo...' : 'Aprobar Costeo y Transmitir a Inventario'}
        </Button>
      </div>

      <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[80px] text-xs font-semibold">Serie</TableHead>
              <TableHead className="text-xs font-semibold">Producto Declarado</TableHead>
              <TableHead className="w-[80px] text-right text-xs font-semibold">Cant.</TableHead>
              <TableHead className="w-[120px] text-right text-xs font-semibold">CIF Base (PEN)</TableHead>
              <TableHead className="w-[110px] text-right text-xs font-semibold">Ad-Valorem</TableHead>
              <TableHead className="w-[120px] text-right text-xs font-semibold">Gastos Locales</TableHead>
              <TableHead className="w-[140px] text-right text-xs font-semibold text-primary">
                Costo Unit. Real (NIC 2)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {breakdown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-8 text-center text-xs text-muted-foreground">
                  No hay series aduaneras cargadas para costeo. Verifique la DAM vinculada.
                </TableCell>
              </TableRow>
            ) : (
              breakdown.map((row) => (
                <TableRow key={row.series_id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs font-semibold">N° {row.series_order}</TableCell>
                  <TableCell className="text-xs text-foreground">
                    <span className="font-semibold block">{row.commercial_description}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">SKU: {row.product_code}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right font-medium">
                    {row.physical_quantity} NIU
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-muted-foreground">
                    S/ {Number(row.cif_pen || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-muted-foreground">
                    S/ {Number(row.ad_valorem_pen || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-muted-foreground">
                    S/ {Number(row.allocated_local_expenses_pen || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right font-bold text-primary">
                    <div className="flex items-center justify-end gap-1">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">S/ {Number(row.final_landed_cost_unit_pen || 0).toFixed(3)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mapeo Contable Oficial PCGE 2019 de Liquidación de Tránsito a Almacén */}
      <Card className="p-3.5 border border-border/70 bg-muted/20 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wide">
              Mapeo Contable Oficial (PCGE 2019 — Asiento de Entrada a Almacén)
            </span>
          </div>
          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 font-mono">
            Cuadrado al Céntimo: S/ {totalCostPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Badge>
        </div>

        <div className="border rounded-md overflow-hidden bg-background">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted text-[11px] font-semibold border-b">
              <tr>
                <th className="p-2">Cuenta PCGE</th>
                <th className="p-2">Denominación Oficial</th>
                <th className="p-2 text-right">Debe (PEN)</th>
                <th className="p-2 text-right">Haber (PEN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-[11px]">
              <tr>
                <td className="p-2 font-mono font-bold text-primary">20111</td>
                <td className="p-2">Mercaderías manufacturadas — Costo (Almacén Central Callao)</td>
                <td className="p-2 text-right font-mono font-bold">
                  S/ {totalCostPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-2 text-right font-mono text-muted-foreground">-</td>
              </tr>
              <tr>
                <td className="p-2 font-mono text-muted-foreground">2811</td>
                <td className="p-2">Mercaderías en tránsito — Valor CIF Despacho DAM</td>
                <td className="p-2 text-right font-mono text-muted-foreground">-</td>
                <td className="p-2 text-right font-mono font-bold">
                  S/ {totalCifPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td className="p-2 font-mono text-muted-foreground">2812</td>
                <td className="p-2">Costos vinculados con compras del exterior (Gastos locales de desaduanaje)</td>
                <td className="p-2 text-right font-mono text-muted-foreground">-</td>
                <td className="p-2 text-right font-mono font-bold">
                  S/ {totalExpensesPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr className="bg-muted/40 font-bold border-t">
                <td colSpan={2} className="p-2 text-right text-foreground">SUMAS IGUALES:</td>
                <td className="p-2 text-right font-mono text-primary">
                  S/ {totalCostPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-2 text-right font-mono text-primary">
                  S/ {totalCostPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          Glosa: Por el ingreso formal al inventario permanente valorizado (Kardex PLE 13.1) y cancelación de las cuentas de mercaderías en tránsito (NIC 2 Párrafo 11) — Expediente {shipmentRef} / DAM {damRef}.
        </p>
      </Card>
    </div>
  );
};
