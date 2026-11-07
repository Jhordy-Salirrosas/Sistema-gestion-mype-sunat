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
import { Eye, FileSpreadsheet } from 'lucide-react';
import { type CustomsShipmentSummary } from '../types';

interface ShipmentsDataTableProps {
  shipments: CustomsShipmentSummary[];
  onViewDetail: (id: string) => void;
  onOpenWizard?: (id: string) => void;
}

export const ShipmentsDataTable: React.FC<ShipmentsDataTableProps> = ({
  shipments,
  onViewDetail,
  onOpenWizard,
}) => {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[140px] text-xs font-semibold">Expediente</TableHead>
            <TableHead className="text-xs font-semibold">Proveedor</TableHead>
            <TableHead className="w-[90px] text-xs font-semibold">Incoterm</TableHead>
            <TableHead className="w-[100px] text-xs font-semibold">Vía</TableHead>
            <TableHead className="w-[100px] text-xs font-semibold">Aduana</TableHead>
            <TableHead className="w-[120px] text-xs font-semibold">Estado</TableHead>
            <TableHead className="w-[110px] text-xs font-semibold">ETA Estimada</TableHead>
            <TableHead className="w-[130px] text-right text-xs font-semibold">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-xs text-muted-foreground">
                No se encontraron expedientes de importación registrados.
              </TableCell>
            </TableRow>
          ) : (
            shipments.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell className="font-semibold text-xs text-foreground">
                  {s.shipment_number}
                </TableCell>
                <TableCell className="text-xs text-foreground truncate max-w-[200px]">
                  {s.supplier_name || 'Proveedor del exterior'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[11px] font-mono px-1.5 py-0">
                    {s.incoterm}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.transport_mode}</TableCell>
                <TableCell className="text-xs text-muted-foreground">Aduana {s.destination_customs}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      s.status === 'CON_LEVANTE' || s.status === 'CERRADO'
                        ? 'default'
                        : s.status === 'EN_DESPACHO'
                        ? 'secondary'
                        : 'outline'
                    }
                    className="text-[10px] uppercase font-medium"
                  >
                    {s.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {s.eta_date ? new Date(s.eta_date).toLocaleDateString('es-PE') : '—'}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    title="Ver Expediente 360°"
                    onClick={() => onViewDetail(s.id)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  {onOpenWizard && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] gap-1"
                      onClick={() => onOpenWizard(s.id)}
                    >
                      <FileSpreadsheet className="h-3 w-3" />
                      DAM
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
