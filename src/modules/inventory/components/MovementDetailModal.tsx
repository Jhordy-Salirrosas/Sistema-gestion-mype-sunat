import { formatearReferenciaDocumento } from '../lib/documentReference';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Badge,
} from '@/components/ui';
import type { InventoryMovement } from '../types/inventory.types';

const money = (n: number) =>
  `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function MovementDetailModal({
  movement,
  onClose,
}: {
  movement: InventoryMovement | null;
  onClose: () => void;
}) {
  if (!movement) return null;
  const entrada = movement.direction === 'ENTRADA';

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle del movimiento {movement.movementNumber}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Fecha</p><p>{new Date(movement.movementDate).toLocaleString('es-PE')}</p></div>
          <div><p className="text-xs text-muted-foreground">Almacén</p><p>{movement.warehouseCode}</p></div>
          <div><p className="text-xs text-muted-foreground">Operación</p><p>{movement.operationTypeCode}</p></div>
          <div><p className="text-xs text-muted-foreground">Documento</p><p>{movement.documentNumber ? formatearReferenciaDocumento(movement.documentSerial, movement.documentNumber) : `${movement.documentSerial || ''}—`}</p></div>
          <div><p className="text-xs text-muted-foreground">SKU</p><p className="font-mono">{movement.sku}</p></div>
          <div><p className="text-xs text-muted-foreground">Producto</p><p>{movement.description}</p></div>
          <div><p className="text-xs text-muted-foreground">Sentido</p><Badge variant={entrada ? 'outline' : 'destructive'}>{movement.direction}</Badge></div>
          <div><p className="text-xs text-muted-foreground">Cantidad</p><p>{movement.quantity}</p></div>
          <div><p className="text-xs text-muted-foreground">Costo unitario</p><p>{money(movement.unitCost)}</p></div>
          <div><p className="text-xs text-muted-foreground">Costo total</p><p>{money(movement.totalCost)}</p></div>
          <div><p className="text-xs text-muted-foreground">Stock anterior</p><p>{movement.previousStock}</p></div>
          <div><p className="text-xs text-muted-foreground">Stock resultante</p><p>{movement.resultingStock}</p></div>
          <div><p className="text-xs text-muted-foreground">Costo promedio resultante</p><p>{money(movement.resultingAverageCost)}</p></div>
          <div><p className="text-xs text-muted-foreground">Valor total resultante</p><p>{money(movement.resultingTotalValue)}</p></div>
          <div className="col-span-2"><p className="text-xs text-muted-foreground">Referencia de origen</p><p>{movement.sourceReferenceId || '—'}</p></div>
          <div className="col-span-2"><p className="text-xs text-muted-foreground">Notas</p><p>{movement.notes || '—'}</p></div>
        </div>

        {entrada && (
          <div className="mt-4 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-2">
              Desglose Comercial y Fiscal del Ingreso
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="bg-card p-2.5 rounded border border-border/60">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Subtotal (Valor Neto)</p>
                <p className="font-bold text-foreground font-mono mt-0.5">{money(movement.totalCost)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Base computable al Kardex (NIC 2)</p>
              </div>
              <div className="bg-card p-2.5 rounded border border-border/60">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">IGV Crédito Fiscal (18%)</p>
                <p className="font-bold text-emerald-600 font-mono mt-0.5">{money(movement.totalCost * 0.18)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Crédito fiscal SUNAT no capitalizable</p>
              </div>
              <div className="bg-card p-2.5 rounded border border-border/60">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Importe Total Comprobante</p>
                <p className="font-bold text-primary font-mono mt-0.5">{money(movement.totalCost * 1.18)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Total a pagar al proveedor (CxP)</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
